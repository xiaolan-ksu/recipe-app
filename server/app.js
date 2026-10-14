'use strict';

/**
 * 「今天吃什么」共享清单后端
 *
 * 就干一件事：让两台手机看到同一份买菜清单和同一份冰箱库存。
 * 数据存在同目录的 data/data.db 里，备份就是拷这一个文件。
 */

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const store = require('./db');
const updates = require('./updates');

/** 自己加的菜的照片，按家庭分目录存：data/dishes/<家庭>/<菜 id>.<后缀> */
const DISH_PHOTO_DIR = path.join(store.dataDir, 'dishes');

const PORT = Number(process.env.PORT || 8080);
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'server.log');
const MAX_LOG_BYTES = 5 * 1024 * 1024;

// ---------- 日志（同时打到控制台和文件，出问题好查） ----------

fs.mkdirSync(LOG_DIR, { recursive: true });
try {
  if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > MAX_LOG_BYTES) {
    fs.renameSync(LOG_FILE, path.join(LOG_DIR, 'server.log.1'));
  }
} catch {
  // 日志轮转失败不影响服务
}

function log(...parts) {
  const line = `${new Date().toISOString()} ${parts.join(' ')}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // 磁盘写不了就算了，不能因为这个把服务弄挂
  }
}

// ---------- 简单限流：防止有人拿家庭码在那儿猜 ----------

const joinAttempts = new Map();
function joinAllowed(ip) {
  const now = Date.now();
  const entry = joinAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    joinAttempts.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 20;
}

// ---------- 应用 ----------

const app = express();
app.disable('x-powered-by');

// 挂在宝塔 Nginx 后面时，req.ip 会变成 127.0.0.1（家庭码限流会失效）、
// req.protocol 会变成 http（更新地址会发错）。信任一层代理才能读到真实的
// X-Forwarded-For / X-Forwarded-Proto。直连不经过反代时把 TRUST_PROXY 设成 0。
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

app.use(express.json({ limit: '256kb' }));

// 手机上的 App 不需要跨域，但电脑上的网页预览需要，顺手放开
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });
  next();
});

function auth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : typeof req.query.token === 'string'
      ? req.query.token
      : '';
  const familyId = store.familyOfToken(token);
  if (!familyId) {
    res.status(401).json({ error: 'unauthorized', message: '令牌无效，请重新配对' });
    return;
  }
  req.familyId = familyId;
  next();
}

// ---------- 首页：用浏览器打开就能看到服务状态，方便你自己确认 ----------

app.get('/', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>共享清单后端</title>
<style>body{font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif;max-width:640px;margin:48px auto;padding:0 20px;color:#2E2622;line-height:1.7}
h1{font-size:22px}.ok{color:#3f8f3f;font-weight:700}code{background:#f3efe9;padding:2px 6px;border-radius:6px}</style></head>
<body><h1>「今天吃什么」共享清单后端</h1>
<p class="ok">服务正在运行。</p>
<p>数据库文件：<code>${path.relative(__dirname, store.dbFile)}</code>（备份就拷这个文件）</p>
<p>启动时间：${new Date().toLocaleString('zh-CN')}</p>
<p>健康检查：<a href="/api/health">/api/health</a></p>
</body></html>`);
});

app.get('/api/health', (req, res) => {
  res.json({ service: 'recipe-share', status: 'running', time: new Date().toISOString() });
});

// ---------- 配对 ----------

app.post('/api/family/create', (req, res) => {
  const created = store.createFamily();
  log(`family created: ${created.familyId}`);
  res.json({
    familyId: created.familyId,
    code: created.code,
    token: created.token,
    codeExpiresInHours: 24,
  });
});

app.post('/api/family/join', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!joinAllowed(ip)) {
    res.status(429).json({ error: 'too_many_attempts', message: '试得有点多，过一会儿再试' });
    return;
  }
  const result = store.joinFamily(req.body && req.body.code);
  if (result.error === 'code_expired') {
    res.status(410).json({ error: 'code_expired', message: '这个家庭码过期了，让对方重新生成一个' });
    return;
  }
  if (result.error) {
    res.status(404).json({ error: 'code_invalid', message: '家庭码不对，检查一下有没有输错' });
    return;
  }
  log(`member joined family ${result.familyId}`);
  res.json({ familyId: result.familyId, token: result.token });
});

app.post('/api/family/code', auth, (req, res) => {
  const code = store.issueCode(req.familyId);
  res.json({ code, codeExpiresInHours: 24 });
});

// ---------- 共享数据 ----------

app.get('/api/state', auth, (req, res) => {
  const since = Number(req.query.since);
  const state = store.stateOf(req.familyId);
  if (Number.isFinite(since) && since === state.rev) {
    res.json({ unchanged: true, rev: state.rev });
    return;
  }
  res.json(state);
});

app.post('/api/ops', auth, (req, res) => {
  const ops = req.body && req.body.ops;
  if (!Array.isArray(ops)) {
    res.status(400).json({ error: 'bad_request', message: 'ops 必须是一个数组' });
    return;
  }
  const state = store.applyOps(req.familyId, ops);
  // 取消共享的菜，照片也一起清掉，别在磁盘上留垃圾
  ops
    .filter((op) => op && op.kind === 'dish' && op.action === 'remove')
    .forEach((op) => removeDishPhoto(req.familyId, op.id));
  res.json(state);
});

// ---------- 自己加的菜：照片上传 / 读取 ----------

/** 按文件头判断格式，不信客户端报的类型 */
function imageKindOf(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

/** 菜 id 是客户端生成的，卡死格式，别让 ../ 跑出去 */
function safeDishId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(value) ? value : '';
}

function dishPhotoDir(familyId) {
  return path.join(DISH_PHOTO_DIR, familyId);
}

/** 同一道菜换过图片（比如 jpg 换成 png），把旧的删掉 */
function removeDishPhoto(familyId, rawId) {
  const id = safeDishId(rawId);
  if (!id) return;
  ['jpg', 'png', 'webp'].forEach((ext) => {
    try {
      fs.rmSync(path.join(dishPhotoDir(familyId), `${id}.${ext}`), { force: true });
    } catch {
      // 删不掉就算了，不影响功能
    }
  });
}

app.post('/api/dish/photo', auth, express.raw({ type: () => true, limit: '8mb' }), (req, res) => {
  const dishId = safeDishId(req.query.dish);
  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!dishId || buffer.length === 0) {
    res.status(400).json({ error: 'bad_request', message: '缺少 dish 参数或图片内容' });
    return;
  }
  const kind = imageKindOf(buffer);
  if (!kind) {
    res.status(415).json({ error: 'unsupported_type', message: '只收 jpg / png / webp' });
    return;
  }

  removeDishPhoto(req.familyId, dishId);
  fs.mkdirSync(dishPhotoDir(req.familyId), { recursive: true });
  fs.writeFileSync(path.join(dishPhotoDir(req.familyId), `${dishId}.${kind.ext}`), buffer);
  log(`dish photo saved: ${dishId} ${kind.ext} ${buffer.length}B`);
  res.json({ ok: true, size: buffer.length });
});

/** 手机上的 expo-image 直接按 URL 取图，所以 token 走 query */
app.get('/api/dish/photo', auth, (req, res) => {
  const dishId = safeDishId(req.query.dish);
  if (!dishId) {
    res.status(400).json({ error: 'bad_request' });
    return;
  }
  for (const ext of ['jpg', 'png', 'webp']) {
    const file = path.join(dishPhotoDir(req.familyId), `${dishId}.${ext}`);
    if (fs.existsSync(file)) {
      // 图片可能被重新上传（改配图），所以缓存给短一点
      res.setHeader('cache-control', 'private, max-age=300');
      res.type(ext === 'jpg' ? 'image/jpeg' : `image/${ext}`);
      res.sendFile(file);
      return;
    }
  }
  res.status(404).json({ error: 'not_found' });
});

// ---------- 微信服务器域名校验文件 ----------
// 在小程序后台添加「服务器域名」时，微信会要求你放一个形如 xxxxxxxx.txt 的校验文件，
// 并且能通过 https://你的域名/xxxxxxxx.txt 直接读到内容（不能是跳转、不能要登录）。
// 把微信给的文件原样丢进本目录的 wechat-verify/ 就行，不用去动 Nginx。

const VERIFY_DIR = path.join(__dirname, 'wechat-verify');
fs.mkdirSync(VERIFY_DIR, { recursive: true });

app.get('/:file', (req, res, next) => {
  const name = req.params.file;
  // 只接管「安全字符 + .txt」的单段路径，其它请求继续往下走
  if (!/^[A-Za-z0-9_-]{1,64}\.txt$/.test(name)) {
    next();
    return;
  }
  const full = path.join(VERIFY_DIR, name);
  if (!fs.existsSync(full)) {
    next();
    return;
  }
  res.type('text/plain').send(fs.readFileSync(full, 'utf8'));
});

// ---------- 兜底 ----------

// 云更新：给手机发新的 JS 包，另外提供最新安装包的信息（要放在兜底 404 之前）
updates.attach(app, log);

app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.originalUrl });
});

app.use((error, req, res, next) => {
  log(`ERROR ${req.method} ${req.originalUrl}: ${error && error.stack ? error.stack : error}`);
  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(500).json({ error: 'server_error', message: '服务端出错了，看看 logs/server.log' });
});

// ---------- 启动 ----------

const server = app.listen(PORT, '0.0.0.0', () => {
  log(`listening on http://0.0.0.0:${PORT}`);
  log(`public origin: ${process.env.PUBLIC_ORIGIN || '(未设置，按请求头推断)'}`);
  log(`trust proxy: ${app.get('trust proxy')}`);
  log(`wechat verify dir: ${VERIFY_DIR}`);
  log(`db file: ${store.dbFile}`);
});

server.on('error', (error) => {
  log(`failed to start: ${error.message}`);
  process.exit(1);
});

// 进程别因为一个未捕获的异常就整个挂掉
process.on('uncaughtException', (error) => log(`uncaughtException: ${error.stack || error}`));
process.on('unhandledRejection', (reason) => log(`unhandledRejection: ${reason}`));

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    log(`${signal} received, closing...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000);
  });
});
