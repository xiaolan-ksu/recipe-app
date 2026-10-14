'use strict';

/**
 * 数据层：一个 SQLite 文件 + 一点「操作合并」逻辑。
 *
 * 为什么存「操作」而不是让客户端整份覆盖：两个人可能同时改，
 * 整份覆盖会把对方刚做的改动抹掉。按操作合并就不会（比如两人同时
 * 从菜谱加同一道菜，数量会累加而不是互相覆盖）。
 */

const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'data.db');

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA busy_timeout = 5000');
db.exec(`
  CREATE TABLE IF NOT EXISTS families (
    id TEXT PRIMARY KEY,
    code TEXT,
    code_expires_at INTEGER,
    rev INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS members (
    token TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS docs (
    family_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (family_id, kind)
  );
  CREATE INDEX IF NOT EXISTS idx_families_code ON families (code);
  CREATE INDEX IF NOT EXISTS idx_members_family ON members (family_id);
`);

const CODE_TTL_MS = 24 * 60 * 60 * 1000; // 家庭码 24 小时有效

const emptyState = () => ({ shopping: [], pantry: [], pantryExpiry: {}, dishes: [] });

/** 自己加的菜最多共存这么多道，免得哪天被塞爆 */
const MAX_SHARED_DISHES = 200;

// ---------- 小工具 ----------

const text = (value, max = 200) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed * 100) / 100;
};

const bool = (value) => value === true;

const idList = (value) => (Array.isArray(value) ? value.filter((v) => typeof v === 'string').slice(0, 200) : []);

const strList = (value, maxItems, maxLength) =>
  (Array.isArray(value) ? value : [])
    .map((item) => text(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);

/** 生成一个 6 位数字家庭码，保证当前没有别人在用 */
function makeCode() {
  const now = Date.now();
  const taken = db.prepare('SELECT 1 FROM families WHERE code = ? AND code_expires_at > ?');
  for (let i = 0; i < 50; i += 1) {
    const code = String(crypto.randomInt(100000, 1000000));
    if (!taken.get(code, now)) return code;
  }
  // 极端情况：把已过期的码清掉再来
  db.prepare('UPDATE families SET code = NULL WHERE code_expires_at <= ?').run(now);
  return String(crypto.randomInt(100000, 1000000));
}

const makeToken = () => crypto.randomBytes(24).toString('hex');

// ---------- 家庭与成员 ----------

function createFamily() {
  const id = crypto.randomUUID();
  const code = makeCode();
  const now = Date.now();
  db.prepare('INSERT INTO families (id, code, code_expires_at, rev, created_at) VALUES (?, ?, ?, 0, ?)').run(
    id,
    code,
    now + CODE_TTL_MS,
    now,
  );
  const token = addMember(id);
  return { familyId: id, code, token };
}

function addMember(familyId) {
  const token = makeToken();
  db.prepare('INSERT INTO members (token, family_id, created_at) VALUES (?, ?, ?)').run(token, familyId, Date.now());
  return token;
}

/** 用家庭码加入；码是一次性的，加入成功就作废 */
function joinFamily(rawCode) {
  const code = text(rawCode, 12);
  if (!/^\d{6}$/.test(code)) return { error: 'code_invalid' };

  const family = db.prepare('SELECT id, code_expires_at FROM families WHERE code = ?').get(code);
  if (!family) return { error: 'code_invalid' };
  if (Number(family.code_expires_at) < Date.now()) return { error: 'code_expired' };

  db.prepare('UPDATE families SET code = NULL, code_expires_at = NULL WHERE id = ?').run(family.id);
  const token = addMember(family.id);
  return { familyId: family.id, token };
}

/** 家庭成员重新生成一个邀请码（换手机、重新配对时用） */
function issueCode(familyId) {
  const code = makeCode();
  db.prepare('UPDATE families SET code = ?, code_expires_at = ? WHERE id = ?').run(
    code,
    Date.now() + CODE_TTL_MS,
    familyId,
  );
  return code;
}

function familyOfToken(token) {
  if (typeof token !== 'string' || token.length < 20) return null;
  const row = db.prepare('SELECT family_id FROM members WHERE token = ?').get(token);
  return row ? row.family_id : null;
}

// ---------- 共享数据 ----------

function readJson(familyId, kind, fallback) {
  const row = db.prepare('SELECT json FROM docs WHERE family_id = ? AND kind = ?').get(familyId, kind);
  if (!row) return fallback;
  try {
    return JSON.parse(row.json);
  } catch {
    return fallback;
  }
}

function writeJson(familyId, kind, value) {
  db.prepare(
    `INSERT INTO docs (family_id, kind, json, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (family_id, kind) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
  ).run(familyId, kind, JSON.stringify(value), Date.now());
}

function stateOf(familyId) {
  const shopping = readJson(familyId, 'shopping', []);
  const pantryDoc = readJson(familyId, 'pantry', { names: [], expiry: {} });
  const dishes = readJson(familyId, 'dishes', []);
  const row = db.prepare('SELECT rev FROM families WHERE id = ?').get(familyId);
  return {
    rev: row ? Number(row.rev) : 0,
    shopping: Array.isArray(shopping) ? shopping : [],
    pantry: Array.isArray(pantryDoc.names) ? pantryDoc.names : [],
    pantryExpiry: pantryDoc.expiry && typeof pantryDoc.expiry === 'object' ? pantryDoc.expiry : {},
    dishes: Array.isArray(dishes) ? dishes : [],
  };
}

/**
 * 「自己加的菜」要过一遍白名单 + 长度限制：
 * 手机传上来的东西一律当不可信，别让哪次误传把库写坏或者把别人界面撑爆。
 */
function normalizeDish(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id, 80);
  const name = text(raw.name, 40);
  if (!id || !name) return null;

  const ingredients = (Array.isArray(raw.ingredients) ? raw.ingredients.slice(0, 40) : [])
    .map((item) => {
      const itemName = text(item && item.name, 40);
      if (!itemName) return null;
      return {
        name: itemName,
        amount: num(item.amount, 0),
        unit: text(item.unit, 12) || '份',
        group: text(item.group, 12) || '蔬菜',
        price: num(item.price, 0),
        staple: bool(item.staple),
      };
    })
    .filter(Boolean);

  const steps = (Array.isArray(raw.steps) ? raw.steps.slice(0, 40) : [])
    .map((item) => {
      const stepText = text(item && item.text, 300);
      if (!stepText) return null;
      const tip = text(item.tip, 120);
      return tip ? { text: stepText, tip } : { text: stepText };
    })
    .filter(Boolean);

  if (ingredients.length === 0 && steps.length === 0) return null;

  return {
    id,
    name,
    category: text(raw.category, 12) || '素菜类',
    tagline: text(raw.tagline, 40),
    description: text(raw.description, 200),
    tags: strList(raw.tags, 8, 12),
    costYuan: num(raw.costYuan, 0),
    minutes: Math.max(0, Math.round(num(raw.minutes, 0))),
    difficulty: text(raw.difficulty, 12) || '容易',
    popularity: Math.min(99, Math.max(1, Math.round(num(raw.popularity, 60)))),
    baseServings: Math.min(8, Math.max(1, Math.round(num(raw.baseServings, 2)))),
    ingredients,
    steps,
    tips: strList(raw.tips, 10, 120),
    isCustom: true,
    hasPhoto: bool(raw.hasPhoto),
    createdAt: text(raw.createdAt, 40) || new Date().toISOString(),
  };
}

/** 上传 / 更新一道自己加的菜（按 id 覆盖，保持两个人看到的是一致的） */
function opUpsertDish(state, op) {
  const dish = normalizeDish(op.dish);
  if (!dish) return;
  const existing = state.dishes.find((entry) => entry.id === dish.id);
  if (existing) {
    Object.assign(existing, dish);
    return;
  }
  if (state.dishes.length >= MAX_SHARED_DISHES) return;
  state.dishes.unshift(dish);
}

function opRemoveDish(state, op) {
  const id = text(op.id, 80);
  state.dishes = state.dishes.filter((entry) => entry.id !== id);
}

function normalizeItem(raw) {
  const unit = text(raw && raw.unit, 12) || '份';
  return {
    id: text(raw && raw.id, 80) || `${text(raw && raw.name, 40)}-${unit}`,
    name: text(raw && raw.name, 40),
    amount: num(raw && raw.amount, 0),
    unit,
    group: text(raw && raw.group, 12) || '蔬菜',
    price: num(raw && raw.price, 0),
    checked: bool(raw && raw.checked),
    fromDishIds: idList(raw && raw.fromDishIds),
  };
}

/** 从菜谱加菜：同一份食材按「累加」而不是「覆盖」，两个同时加不会互相吃掉 */
function opAddAmount(state, op) {
  const incoming = normalizeItem(op.item);
  if (!incoming.name) return;
  const existing = state.shopping.find((entry) => entry.id === incoming.id);
  if (!existing) {
    state.shopping.push(incoming);
    return;
  }
  existing.amount = num(existing.amount, 0) + incoming.amount;
  existing.price = num(existing.price, 0) + incoming.price;
  existing.checked = false;
  existing.unit = incoming.unit;
  existing.group = incoming.group;
  existing.name = incoming.name;
  existing.fromDishIds = [...new Set([...(existing.fromDishIds || []), ...incoming.fromDishIds])];
}

function opPatchItem(state, op) {
  const id = text(op.id, 80);
  const existing = state.shopping.find((entry) => entry.id === id);
  if (!existing) return;
  const patch = op.patch && typeof op.patch === 'object' ? op.patch : {};
  if ('checked' in patch) existing.checked = bool(patch.checked);
  if ('amount' in patch) existing.amount = num(patch.amount, existing.amount);
  if ('price' in patch) existing.price = num(patch.price, existing.price);
  if ('name' in patch) existing.name = text(patch.name, 40) || existing.name;
  if ('unit' in patch) existing.unit = text(patch.unit, 12) || existing.unit;
  if ('group' in patch) existing.group = text(patch.group, 12) || existing.group;
}

function opRemoveItem(state, op) {
  const id = text(op.id, 80);
  state.shopping = state.shopping.filter((entry) => entry.id !== id);
}

function opAddPantry(state, op) {
  const names = idList(op.names).map((name) => text(name, 40)).filter(Boolean);
  const expiry = op.expiry && typeof op.expiry === 'object' ? op.expiry : {};
  names.forEach((name) => {
    if (!state.pantry.includes(name)) state.pantry.push(name);
    const date = text(expiry[name], 20);
    if (date) state.pantryExpiry[name] = date;
  });
}

function opRemovePantry(state, op) {
  const name = text(op.name, 40);
  state.pantry = state.pantry.filter((entry) => entry !== name);
  delete state.pantryExpiry[name];
}

function opSetPantryExpiry(state, op) {
  const name = text(op.name, 40);
  if (!name) return;
  const date = text(op.date, 20);
  if (date) state.pantryExpiry[name] = date;
  else delete state.pantryExpiry[name];
}

/**
 * 应用一批操作。先在内存里全做完再落库：中途出错的话数据库不会被写坏。
 * 返回最新的整份状态，客户端拿到就能直接替换本地缓存，不用再拉一次。
 */
function applyOps(familyId, ops) {
  const state = stateOf(familyId);
  let touched = false;

  for (const op of Array.isArray(ops) ? ops.slice(0, 500) : []) {
    if (!op || typeof op !== 'object') continue;
    const kind = text(op.kind, 12);
    const action = text(op.action, 24);
    touched = true;

    if (kind === 'shopping') {
      if (action === 'addAmount') opAddAmount(state, op);
      else if (action === 'patch') opPatchItem(state, op);
      else if (action === 'remove') opRemoveItem(state, op);
      else if (action === 'clearChecked') state.shopping = state.shopping.filter((entry) => !entry.checked);
      else if (action === 'clearAll') state.shopping = [];
    } else if (kind === 'pantry') {
      if (action === 'add') opAddPantry(state, op);
      else if (action === 'remove') opRemovePantry(state, op);
      else if (action === 'setExpiry') opSetPantryExpiry(state, op);
      else if (action === 'clearAll') {
        state.pantry = [];
        state.pantryExpiry = {};
      }
    } else if (kind === 'dish') {
      if (action === 'upsert') opUpsertDish(state, op);
      else if (action === 'remove') opRemoveDish(state, op);
    }
  }

  if (!touched) return stateOf(familyId);

  writeJson(familyId, 'shopping', state.shopping);
  writeJson(familyId, 'pantry', { names: state.pantry, expiry: state.pantryExpiry });
  writeJson(familyId, 'dishes', state.dishes);
  db.prepare('UPDATE families SET rev = rev + 1 WHERE id = ?').run(familyId);
  return stateOf(familyId);
}

module.exports = {
  dbFile: DB_FILE,
  dataDir: DATA_DIR,
  createFamily,
  joinFamily,
  issueCode,
  familyOfToken,
  stateOf,
  applyOps,
  emptyState,
};
