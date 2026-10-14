import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import { DISHES } from '../data/dishes';
import { dishHitsAvoid, filterByAvoid } from '../lib/avoid';
import type { Coords } from '../lib/geocode';
import { addDays, groupOf, missingOf, buildPantryCatalog, shelfLifeDays } from '../lib/pantry';
import { pickRandom, today } from '../lib/recommend';
import type { ShareOp, ShareSession, SharedDish } from '../lib/share';
import { dishPhotoUrl } from '../lib/share';
import { CATEGORY_FILTERS } from '../constants';
import type { CategoryFilter, CookingLog, Dish, DishIngredient, DishStep, ShoppingItem } from '../types';

export type LocationSource = 'none' | 'gps' | 'manual';

/** 没自己起名字时显示的昵称 */
export const DEFAULT_PROFILE_NAME = '家里的掌勺人';

/** 待提交的操作最多留这么多条（长时间离线时的兜底，正常用不到） */
const MAX_SHARE_OUTBOX = 500;

interface AppState {
  /** 位置与家庭情况 */
  location: string;
  /** 这个地址是怎么来的：没定位 / 手机定位 / 自己填的 */
  locationSource: LocationSource;
  /** 定位到的经纬度，拿不到地名时用来兜底显示 */
  locationCoords: Coords | null;
  /** 是否已经弹过定位权限申请，避免每次启动都弹 */
  locationAsked: boolean;
  familySize: number;

  /** 我的资料：自己起的昵称 + 头像照片（存在本机上的路径，没有就用默认头像） */
  profileName: string;
  profileAvatar: string | null;

  /** 筛选偏好：忌口 */
  avoid: string[];

  /** 收藏、吃饭记录、家里现有的食材 */
  favorites: string[];
  logs: CookingLog[];
  pantry: string[];
  /** 每样食材的到期日，用来提醒该先吃什么 */
  pantryExpiry: Record<string, string>;

  /** 自己加的菜 */
  customDishes: Dish[];

  /** 已经传到服务器、两个人共用的那些自己加的菜 */
  sharedDishIds: string[];

  /** 买菜清单 */
  shopping: ShoppingItem[];

  /** 共享清单：跟谁同步、同步到哪一版、还有哪些改动没提交上去 */
  shareToken: string | null;
  shareFamilyId: string | null;
  shareRev: number;
  shareOutbox: ShareOp[];
  shareSyncedAt: number;

  /** 首页推荐状态 */
  activeCategory: CategoryFilter;
  currentDishId: string;
  seenDishIds: string[];

  setActiveCategory: (category: CategoryFilter) => void;
  nextDish: () => void;
  showDish: (dishId: string) => void;

  toggleFavorite: (dishId: string) => void;
  setFamilySize: (size: number) => void;
  setProfileName: (name: string) => void;
  setProfileAvatar: (uri: string | null) => void;
  toggleAvoid: (tag: string) => void;
  setLocation: (location: string, source?: LocationSource) => void;
  setLocationCoords: (coords: Coords | null) => void;
  markLocationAsked: () => void;

  togglePantry: (ingredient: string) => void;
  addPantryItems: (ingredients: string[]) => void;
  clearPantry: () => void;
  setPantryExpiry: (ingredient: string, expiry: string) => void;
  shiftPantryExpiry: (ingredient: string, days: number) => void;

  addCustomDish: (input: CustomDishInput, id?: string) => string;
  updateCustomDish: (id: string, input: CustomDishInput) => void;
  /** 删掉自己加的菜（菜谱自带的那 103 道不给删） */
  removeCustomDish: (id: string) => void;
  /** 把一道自己加的菜传到服务器（照片由界面先传好，这里只记有没有图） */
  uploadDish: (id: string, photo?: { hasPhoto: boolean }) => void;
  /** 取消共享：对方那边也会消失 */
  unshareDish: (id: string) => void;

  addDishToShopping: (dishId: string) => number;
  addMissingToShopping: (dishId: string) => number;
  toggleShoppingItem: (id: string) => void;
  adjustShoppingAmount: (id: string, direction: 1 | -1) => void;
  removeShoppingItem: (id: string) => void;
  clearCheckedShopping: () => void;
  clearShopping: () => void;

  addLog: (dishId: string, rating: number, note?: string) => void;
  removeLog: (id: string) => void;

  /** 共享清单 */
  setShareSession: (session: ShareSession | null) => void;
  enqueueShareOps: (ops: ShareOp[]) => void;
  confirmShareOpsSent: (sentCount: number) => void;
  markShareSynced: () => void;
  applySharedState: (state: {
    rev: number;
    shopping: ShoppingItem[];
    pantry: string[];
    pantryExpiry: Record<string, string>;
    dishes?: SharedDish[];
  }) => void;

  resetAll: () => void;
}

/** 自己加菜时填的内容 */
export interface CustomDishInput {
  name: string;
  category: Dish['category'];
  coverUri?: string;
  description: string;
  costYuan: number;
  minutes: number;
  difficulty: string;
  tags: string[];
  baseServings: number;
  ingredients: DishIngredient[];
  steps: DishStep[];
  tips: string[];
}

/**
 * 按当前分类和忌口算出可以推荐的菜。
 *
 * 忌口是硬约束：这里**不会**在过滤结果为空时把忌口的菜放回来，
 * 空池由界面显示「这一类都被忌口挡掉了」，由用户自己决定要不要放宽。
 */
export function recommendPool(
  category: CategoryFilter,
  avoid: string[],
  dishList: Dish[] = DISHES,
): Dish[] {
  const inCategory = dishList.filter((dish) => category === '全部' || dish.category === category);
  return filterByAvoid(inCategory, avoid).dishes;
}

/** 这道菜还差哪些食材（家里已有的不算） */
export function missingIngredients(dish: Dish, pantry: string[]): string[] {
  return missingOf(dish, pantry).map((ing) => ing.name);
}

/**
 * 往买菜清单里合并一道菜的用料；同一道菜重复加不会重复计数。
 * 同时产出要提交给服务器的操作——服务器用「累加」语义合并，
 * 所以这里只提交这一份增量，两个人同时加不会互相覆盖。
 */
function mergeDishIngredients(
  shopping: ShoppingItem[],
  dish: Dish,
  ratio: number,
  dishId: string,
  onlyNames?: string[],
): { next: ShoppingItem[]; added: number; ops: ShareOp[] } {
  const next = [...shopping];
  const ops: ShareOp[] = [];
  let added = 0;

  dish.ingredients.forEach((ing) => {
    if (ing.staple) return; // 家里常备的调味料不进买菜清单
    if (onlyNames && !onlyNames.includes(ing.name)) return;

    const id = `${ing.name}-${ing.unit}`;
    const amount = Math.round(ing.amount * ratio * 10) / 10;
    const price = Math.round(ing.price * ratio * 10) / 10;
    const shareItem: ShoppingItem = {
      id,
      name: ing.name,
      amount,
      unit: ing.unit,
      group: ing.group,
      price,
      checked: false,
      fromDishIds: [dishId],
    };
    const existing = next.findIndex((item) => item.id === id);

    if (existing >= 0) {
      const item = next[existing];
      if (item.fromDishIds.includes(dishId)) return; // 这道菜已经算过一遍了
      next[existing] = {
        ...item,
        amount: Math.round((item.amount + amount) * 10) / 10,
        price: Math.round((item.price + price) * 10) / 10,
        checked: false,
        fromDishIds: [...item.fromDishIds, dishId],
      };
      ops.push({ kind: 'shopping', action: 'addAmount', item: shareItem });
      return;
    }

    next.push(shareItem);
    ops.push({ kind: 'shopping', action: 'addAmount', item: shareItem });
    added += 1;
  });

  return { next, added, ops };
}

/** 买菜页里加减数量时，按单位决定一次改多少 */
function amountStep(unit: string): number {
  if (unit === '克' || unit === '毫升') return 50;
  return 1;
}

/** 内置菜 + 自己加的菜 */
function allDishesOf(state: Pick<AppState, 'customDishes'>): Dish[] {
  return [...state.customDishes, ...DISHES];
}

function findDishOf(state: Pick<AppState, 'customDishes'>, dishId: string): Dish | undefined {
  return state.customDishes.find((dish) => dish.id === dishId) ?? DISHES.find((dish) => dish.id === dishId);
}

/** 新买回来的食材，按分类默认保质期算一个到期日 */
function defaultExpiry(state: Pick<AppState, 'customDishes'>, names: string[]): Record<string, string> {
  const catalog = buildPantryCatalog(allDishesOf(state));
  const stamp = today();
  const result: Record<string, string> = {};
  names.forEach((name) => {
    result[name] = addDays(stamp, shelfLifeDays(name, groupOf(catalog, name)));
  });
  return result;
}

/** 本地这道菜 → 传给服务器的样子（照片单独传，这里只说有没有图） */
function sharedDishOf(dish: Dish, hasPhoto: boolean): SharedDish {
  return {
    id: dish.id,
    name: dish.name,
    category: dish.category,
    tagline: dish.tagline,
    description: dish.description ?? '',
    tags: dish.tags,
    costYuan: dish.costYuan,
    minutes: dish.minutes,
    difficulty: dish.difficulty,
    popularity: dish.popularity,
    baseServings: dish.baseServings,
    ingredients: dish.ingredients,
    steps: dish.steps.map((step) => (step.tip ? { text: step.text, tip: step.tip } : { text: step.text })),
    tips: dish.tips,
    hasPhoto,
    createdAt: dish.createdAt,
  };
}

/** 服务器上的菜 → 手机上显示的样子（有照片就指向服务器的取图地址） */
function sharedDishToLocal(dish: SharedDish, token: string | null): Dish {
  return {
    id: dish.id,
    name: dish.name,
    cover: dish.hasPhoto && token ? { uri: dishPhotoUrl(dish.id, token) } : undefined,
    category: dish.category as Dish['category'],
    tagline: dish.tagline || `${dish.category} · 我加的菜`,
    description: dish.description,
    tags: dish.tags,
    costYuan: dish.costYuan,
    minutes: dish.minutes,
    difficulty: dish.difficulty,
    popularity: dish.popularity ?? 60,
    baseServings: dish.baseServings,
    ingredients: dish.ingredients,
    steps: dish.steps,
    tips: dish.tips,
    isCustom: true,
    createdAt: dish.createdAt,
  };
}

function dishFromInput(id: string, input: CustomDishInput): Dish {
  return {
    id,
    name: input.name.trim(),
    cover: input.coverUri ? { uri: input.coverUri } : undefined,
    category: input.category,
    tagline: `${input.category} · 我加的菜`,
    description: input.description.trim(),
    tags: input.tags,
    costYuan: input.costYuan,
    minutes: input.minutes,
    difficulty: input.difficulty,
    popularity: 60,
    baseServings: input.baseServings,
    ingredients: input.ingredients,
    steps: input.steps,
    tips: input.tips,
    isCustom: true,
    createdAt: today(),
  };
}

const initialState = {
  location: '',
  locationSource: 'none' as LocationSource,
  locationCoords: null as Coords | null,
  locationAsked: false,
  familySize: 2,
  profileName: DEFAULT_PROFILE_NAME,
  profileAvatar: null as string | null,
  avoid: [] as string[],
  favorites: [] as string[],
  logs: [] as CookingLog[],
  pantry: [] as string[],
  pantryExpiry: {} as Record<string, string>,
  customDishes: [] as Dish[],
  sharedDishIds: [] as string[],
  shopping: [] as ShoppingItem[],
  shareToken: null as string | null,
  shareFamilyId: null as string | null,
  shareRev: 0,
  shareOutbox: [] as ShareOp[],
  shareSyncedAt: 0,
  activeCategory: '全部' as CategoryFilter,
  currentDishId: DISHES[0]?.id ?? '',
  seenDishIds: [] as string[],
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setActiveCategory: (category) => {
        set({ activeCategory: category });
        get().nextDish();
      },

      showDish: (dishId) => set({ currentDishId: dishId }),

      nextDish: () => {
        const state = get();
        const { activeCategory, avoid, seenDishIds, favorites, currentDishId, pantry } = state;
        // 忌口挡掉了这一类里的全部菜时，pool 会是空的：保持现状，由界面提示用户
        const pool = recommendPool(activeCategory, avoid, allDishesOf(state));
        if (pool.length === 0) return;

        // 优先：没看过、且不是收藏过的
        const fresh = pool.filter((dish) => !seenDishIds.includes(dish.id) && dish.id !== currentDishId);
        const freshNotFavorite = fresh.filter((dish) => !favorites.includes(dish.id));

        // 其次：没看过（收藏过的也可以）
        const fallback = pool.filter((dish) => dish.id !== currentDishId);
        const fallbackNotFavorite = fallback.filter((dish) => !favorites.includes(dish.id));

        // 优先挑家里食材能对上的
        const matched = freshNotFavorite.filter((dish) =>
          dish.ingredients.some((ing) => pantry.some((have) => ing.name.includes(have) || have.includes(ing.name))),
        );

        const next =
          pickRandom(matched) ??
          pickRandom(freshNotFavorite) ??
          pickRandom(fresh) ??
          pickRandom(fallbackNotFavorite) ??
          pickRandom(fallback);

        if (!next) return;

        // 兜不住的时候（换了一整圈）重置已看过列表
        const exhausted = fresh.length === 0;
        set({
          currentDishId: next.id,
          seenDishIds: exhausted ? [next.id] : [...seenDishIds, next.id],
        });
      },

      toggleFavorite: (dishId) => {
        const { favorites } = get();
        set({
          favorites: favorites.includes(dishId)
            ? favorites.filter((id) => id !== dishId)
            : [...favorites, dishId],
        });
      },

      setFamilySize: (size) => set({ familySize: Math.min(8, Math.max(1, size)) }),

      setProfileName: (name) => {
        const trimmed = name.trim();
        set({ profileName: trimmed.length > 0 ? trimmed : DEFAULT_PROFILE_NAME });
      },

      setProfileAvatar: (uri) => set({ profileAvatar: uri }),

      toggleAvoid: (tag) => {
        const { avoid, currentDishId } = get();
        const next = avoid.includes(tag) ? avoid.filter((t) => t !== tag) : [...avoid, tag];
        set({ avoid: next });
        // 刚勾上的忌口可能正好挡住首屏那道菜：换成还能吃的一道，
        // 否则用户会看到自己刚说「不吃」的东西还摆在大卡片上。
        const current = findDishOf(get(), currentDishId);
        if (current && dishHitsAvoid(current, next)) get().nextDish();
      },

      setLocation: (location, source = 'manual') => set({ location, locationSource: source }),

      setLocationCoords: (coords) => set({ locationCoords: coords }),

      markLocationAsked: () => set({ locationAsked: true }),

      togglePantry: (ingredient) => {
        const { pantry, pantryExpiry } = get();
        if (pantry.includes(ingredient)) {
          const nextExpiry = { ...pantryExpiry };
          delete nextExpiry[ingredient];
          set({ pantry: pantry.filter((n) => n !== ingredient), pantryExpiry: nextExpiry });
          get().enqueueShareOps([{ kind: 'pantry', action: 'remove', name: ingredient }]);
          return;
        }
        const expiry = defaultExpiry(get(), [ingredient]);
        set({ pantry: [...pantry, ingredient], pantryExpiry: { ...pantryExpiry, ...expiry } });
        get().enqueueShareOps([{ kind: 'pantry', action: 'add', names: [ingredient], expiry }]);
      },

      /** 买菜回来一键入库：已经在冰箱里的不重复记到期日 */
      addPantryItems: (ingredients) => {
        const state = get();
        const { pantry, pantryExpiry } = state;
        const fresh = ingredients.filter((name) => !pantry.includes(name));
        if (fresh.length === 0) return;
        const expiry = defaultExpiry(state, fresh);
        set({ pantry: [...pantry, ...fresh], pantryExpiry: { ...pantryExpiry, ...expiry } });
        get().enqueueShareOps([{ kind: 'pantry', action: 'add', names: fresh, expiry }]);
      },

      clearPantry: () => {
        set({ pantry: [], pantryExpiry: {} });
        get().enqueueShareOps([{ kind: 'pantry', action: 'clearAll' }]);
      },

      setPantryExpiry: (ingredient, expiry) => {
        set({ pantryExpiry: { ...get().pantryExpiry, [ingredient]: expiry } });
        get().enqueueShareOps([{ kind: 'pantry', action: 'setExpiry', name: ingredient, date: expiry }]);
      },

      /** 保质期加减几天（不能减到今天以前太久，最少放到今天） */
      shiftPantryExpiry: (ingredient, days) => {
        const state = get();
        const current = state.pantryExpiry[ingredient] ?? defaultExpiry(state, [ingredient])[ingredient];
        const stamp = today();
        const next = addDays(current, days);
        const value = next < stamp ? stamp : next;
        set({ pantryExpiry: { ...state.pantryExpiry, [ingredient]: value } });
        get().enqueueShareOps([{ kind: 'pantry', action: 'setExpiry', name: ingredient, date: value }]);
      },

      addCustomDish: (input, id) => {
        const dishId = id ?? `custom-${Date.now()}`;
        const dish = dishFromInput(dishId, input);
        set({ customDishes: [dish, ...get().customDishes] });
        return dishId;
      },

      updateCustomDish: (id, input) => {
        set({
          customDishes: get().customDishes.map((dish) =>
            dish.id === id ? { ...dishFromInput(id, input), createdAt: dish.createdAt } : dish,
          ),
        });
      },

      removeCustomDish: (id) => {
        const state = get();
        const wasShared = (state.sharedDishIds ?? []).includes(id);
        set({
          customDishes: state.customDishes.filter((dish) => dish.id !== id),
          favorites: state.favorites.filter((favoriteId) => favoriteId !== id),
          seenDishIds: state.seenDishIds.filter((seenId) => seenId !== id),
          sharedDishIds: (state.sharedDishIds ?? []).filter((sharedId) => sharedId !== id),
        });
        // 共享过的菜删掉时，对方那边也跟着消失
        if (wasShared) get().enqueueShareOps([{ kind: 'dish', action: 'remove', id }]);
      },

      /** 上传（或更新）一道自己加的菜 */
      uploadDish: (id, photo) => {
        const state = get();
        const dish = state.customDishes.find((entry) => entry.id === id);
        if (!dish) return;
        set({ sharedDishIds: [...new Set([...(state.sharedDishIds ?? []), id])] });
        get().enqueueShareOps([
          { kind: 'dish', action: 'upsert', dish: sharedDishOf(dish, photo?.hasPhoto ?? false) },
        ]);
      },

      unshareDish: (id) => {
        const state = get();
        set({ sharedDishIds: (state.sharedDishIds ?? []).filter((entry) => entry !== id) });
        get().enqueueShareOps([{ kind: 'dish', action: 'remove', id }]);
      },

      addDishToShopping: (dishId) => {
        const dish = findDishOf(get(), dishId);
        if (!dish) return 0;
        const { shopping, familySize } = get();
        const ratio = familySize / dish.baseServings;
        const { next, added, ops } = mergeDishIngredients(shopping, dish, ratio, dishId);
        set({ shopping: next });
        get().enqueueShareOps(ops);
        return added;
      },

      /** 食材页用：只把家里还没有的那几样加进清单 */
      addMissingToShopping: (dishId) => {
        const dish = findDishOf(get(), dishId);
        if (!dish) return 0;
        const { shopping, familySize, pantry } = get();
        const ratio = familySize / dish.baseServings;
        const missingNames = missingOf(dish, pantry).map((ing) => ing.name);
        if (missingNames.length === 0) return 0;
        const { next, added, ops } = mergeDishIngredients(shopping, dish, ratio, dishId, missingNames);
        set({ shopping: next });
        get().enqueueShareOps(ops);
        return added;
      },

      toggleShoppingItem: (id) => {
        const target = get().shopping.find((item) => item.id === id);
        if (!target) return;
        const checked = !target.checked;
        set({
          shopping: get().shopping.map((item) =>
            item.id === id ? { ...item, checked } : item,
          ),
        });
        get().enqueueShareOps([{ kind: 'shopping', action: 'patch', id, patch: { checked } }]);
      },

      /** 数量加减：价格按比例一起改，最后的总价才准 */
      adjustShoppingAmount: (id, direction) => {
        let patch: { amount: number; price: number } | null = null;
        set({
          shopping: get().shopping.map((item) => {
            if (item.id !== id) return item;
            const step = amountStep(item.unit) * direction;
            const amount = Math.max(amountStep(item.unit), Math.round((item.amount + step) * 10) / 10);
            const unitPrice = item.amount > 0 ? item.price / item.amount : 0;
            const next = {
              ...item,
              amount,
              price: Math.round(unitPrice * amount * 10) / 10,
            };
            patch = { amount: next.amount, price: next.price };
            return next;
          }),
        });
        if (patch) get().enqueueShareOps([{ kind: 'shopping', action: 'patch', id, patch }]);
      },

      removeShoppingItem: (id) => {
        set({ shopping: get().shopping.filter((item) => item.id !== id) });
        get().enqueueShareOps([{ kind: 'shopping', action: 'remove', id }]);
      },

      clearCheckedShopping: () => {
        set({ shopping: get().shopping.filter((item) => !item.checked) });
        get().enqueueShareOps([{ kind: 'shopping', action: 'clearChecked' }]);
      },

      clearShopping: () => {
        set({ shopping: [] });
        get().enqueueShareOps([{ kind: 'shopping', action: 'clearAll' }]);
      },

      addLog: (dishId, rating, note) => {
        const log: CookingLog = {
          id: `${dishId}-${Date.now()}`,
          dishId,
          date: today(),
          rating,
          note,
        };
        set({ logs: [log, ...get().logs] });
      },

      removeLog: (id) => set({ logs: get().logs.filter((log) => log.id !== id) }),

      /** 配对成功 / 取消配对 */
      setShareSession: (session) => {
        if (!session) {
          set({ shareToken: null, shareFamilyId: null, shareRev: 0, shareOutbox: [], shareSyncedAt: 0 });
          return;
        }
        set({
          shareToken: session.token,
          shareFamilyId: session.familyId,
          shareRev: 0,
          shareOutbox: [],
          shareSyncedAt: 0,
        });
      },

      /** 本地改动排进待提交队列；没配对时就当普通本地应用，不排队 */
      enqueueShareOps: (ops) => {
        if (ops.length === 0) return;
        const { shareToken, shareOutbox } = get();
        if (!shareToken) return;
        const next = [...shareOutbox, ...ops];
        // 万一长时间离线，队列也不能无限涨
        set({ shareOutbox: next.length > MAX_SHARE_OUTBOX ? next.slice(next.length - MAX_SHARE_OUTBOX) : next });
      },

      /** 这批操作已经提交成功，从队列里去掉 */
      confirmShareOpsSent: (sentCount) => {
        set({ shareOutbox: get().shareOutbox.slice(sentCount) });
      },

      markShareSynced: () => set({ shareSyncedAt: Date.now() }),

      /** 把服务器上的最新状态落到本地 */
      applySharedState: (state) => {
        const current = get();
        const token = current.shareToken;
        const sharedDishes = (state.dishes ?? []).map((dish) => sharedDishToLocal(dish, token));
        const sharedIds = sharedDishes.map((dish) => dish.id);
        // 没上传过的那些自己加的菜只在这台手机上，服务器不知道，原样留着；
        // 上传过的以服务器为准（对方改了/删了都能体现出来）
        const localOnly = current.customDishes.filter(
          (dish) => !sharedIds.includes(dish.id) && !(current.sharedDishIds ?? []).includes(dish.id),
        );
        set({
          shareRev: state.rev,
          shareSyncedAt: Date.now(),
          shopping: state.shopping,
          pantry: state.pantry,
          pantryExpiry: state.pantryExpiry,
          customDishes: [...sharedDishes, ...localOnly],
          sharedDishIds: sharedIds,
        });
      },

      resetAll: () => set({ ...initialState }),
    }),
    {
      name: 'recipe-app-v1',
      version: 4,
      storage: createJSONStorage(() => AsyncStorage),
      // 老版本存的是「放进冰箱的日期」，这里换算成「到期日」
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<AppState> & {
          pantrySince?: Record<string, string>;
          tasteTags?: string[];
        };
        if (version < 2 && state.pantrySince) {
          const catalog = buildPantryCatalog();
          const expiry: Record<string, string> = { ...(state.pantryExpiry ?? {}) };
          Object.entries(state.pantrySince).forEach(([name, since]) => {
            if (!expiry[name]) expiry[name] = addDays(since, shelfLifeDays(name, groupOf(catalog, name)));
          });
          state.pantryExpiry = expiry;
          delete state.pantrySince;
        }
        if (version < 3) {
          // 菜谱数据换了一整套，菜 id 全变了：旧的收藏、浏览记录先清掉，避免出现空白项
          const known = new Set([
            ...DISHES.map((dish) => dish.id),
            ...(state.customDishes ?? []).map((dish) => dish.id),
          ]);
          state.favorites = (state.favorites ?? []).filter((id) => known.has(id));
          state.seenDishIds = (state.seenDishIds ?? []).filter((id) => known.has(id));
          state.shopping = (state.shopping ?? []).map((item) => ({
            ...item,
            fromDishIds: item.fromDishIds.filter((id) => known.has(id)),
          }));
          if (state.currentDishId && !known.has(state.currentDishId)) {
            state.currentDishId = DISHES[0]?.id ?? '';
          }
        }
        if (version < 4) {
          // 口味偏好已下线（原来存了也没人用），把老数据清掉，别一直留在本机
          delete state.tasteTags;
        }
        return state as AppState;
      },
    },
  ),
);

export const selectAllDishes = (state: AppState): Dish[] => allDishesOf(state);

/** 内置菜 + 自己加的菜，一起用 */
export const useAllDishes = (): Dish[] => useAppStore(useShallow(selectAllDishes));

export const useDishById = (dishId: string): Dish | undefined =>
  useAppStore((state) => findDishOf(state, dishId));

export const selectCurrentDish = (state: AppState): Dish =>
  findDishOf(state, state.currentDishId) ?? DISHES[0];

export const selectShoppingTotal = (state: AppState): number =>
  state.shopping.reduce((sum, item) => sum + (item.checked ? 0 : item.price), 0);

export const selectPopular = (state: AppState, limit = 6): Dish[] =>
  allDishesOf(state)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit);

export const CATEGORIES = CATEGORY_FILTERS;
