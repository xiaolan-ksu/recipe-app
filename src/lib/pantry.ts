import { INGREDIENT_GROUPS } from '../constants';
import { DISHES } from '../data/dishes';
import type { Dish, DishIngredient, IngredientGroup } from '../types';

/** 「家里有什么」里的一项食材 */
export interface PantryCatalogItem {
  name: string;
  group: IngredientGroup;
  /** 有几道菜会用到它，用来提示哪样食材最解锁 */
  dishCount: number;
}

/**
 * 食材清单直接从菜谱数据里反推。
 * 这样勾了「鸡蛋」，就一定匹配得上用鸡蛋的菜，不会出现名字对不上的情况。
 * 盐、生抽、食用油这类「家里常备」的调味料不进清单，默认算有。
 */
export function buildPantryCatalog(dishList: Dish[] = DISHES): PantryCatalogItem[] {
  const map = new Map<string, PantryCatalogItem>();

  dishList.forEach((dish) => {
    dish.ingredients.forEach((ing) => {
      if (ing.staple) return;
      const exist = map.get(ing.name);
      if (exist) {
        exist.dishCount += 1;
        return;
      }
      map.set(ing.name, {
        name: ing.name,
        group: ing.group,
        dishCount: 1,
      });
    });
  });

  const all = [...map.values()];
  return INGREDIENT_GROUPS.flatMap((group) =>
    all.filter((item) => item.group === group).sort((a, b) => b.dishCount - a.dishCount),
  );
}

export function groupOf(catalog: PantryCatalogItem[], name: string): IngredientGroup {
  return catalog.find((item) => item.name === name)?.group ?? '调味';
}

/** 判断家里有没有某样食材：完全同名，或者一方包含另一方（「大蒜」≈「蒜」） */
export function pantryHas(pantry: string[], name: string): boolean {
  return pantry.some((have) => have === name || have.includes(name) || name.includes(have));
}

/** 这道菜还缺哪些非「常备」食材 */
export function missingOf(dish: Dish, pantry: string[]): DishIngredient[] {
  return dish.ingredients.filter((ing) => !ing.staple && !pantryHas(pantry, ing.name));
}

export interface DishCookability {
  dish: Dish;
  /** 还差的食材（不含家里常备的调味料） */
  missing: DishIngredient[];
  /** 家里现有的食材里，有几样这道菜用得上 */
  hits: number;
  /** 材料齐了，现在就能做 */
  ready: boolean;
}

/**
 * 反推能做什么菜：只要用得上家里现有的一样食材就会被列出来。
 * 排序：现在就能做的排最前，然后差得越少越靠前，最后看受欢迎程度。
 */
export function cookableDishes(pantry: string[], dishList: Dish[] = DISHES): DishCookability[] {
  return dishList
    .map((dish) => {
      const missing = missingOf(dish, pantry);
      // 只算真正要买的食材：常备调料人人都有，不能靠它把菜全列出来
      const hits = dish.ingredients.filter((ing) => !ing.staple && pantryHas(pantry, ing.name)).length;
      return { dish, missing, hits, ready: missing.length === 0 };
    })
    .filter((item) => item.hits > 0)
    .sort((a, b) => {
      if (a.ready !== b.ready) return a.ready ? -1 : 1;
      if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
      if (a.hits !== b.hits) return b.hits - a.hits;
      return b.dish.popularity - a.dish.popularity;
    });
}

/** 各类食材默认能放几天 */
export const SHELF_LIFE_DAYS: Record<IngredientGroup, number> = {
  蔬菜: 5,
  肉禽蛋: 3,
  豆制品: 2,
  调味: 45,
  主食: 30,
};

/** 个别食材按自己的脾气来，不走分类默认值 */
export const SHELF_LIFE_OVERRIDE: Record<string, number> = {
  米饭: 1,
  干香菇: 180,
  木耳: 180,
  花生米: 150,
  熟白芝麻: 120,
  冰糖: 365,
  八角: 365,
  香叶: 365,
  花椒: 365,
  花椒粉: 365,
  干辣椒: 365,
  豆豉: 180,
  豆瓣酱: 180,
  泡椒: 120,
  番茄酱: 180,
  可乐: 180,
};

export function shelfLifeDays(name: string, group: IngredientGroup): number {
  return SHELF_LIFE_OVERRIDE[name] ?? SHELF_LIFE_DAYS[group] ?? 7;
}

export type ExpiryTone = 'fresh' | 'soon' | 'today' | 'expired';

export interface ExpiryInfo {
  /** 距离到期还有几天，负数表示已经过期 */
  days: number;
  tone: ExpiryTone;
  label: string;
}

export function expiryInfo(expiry: string | undefined, today: string): ExpiryInfo | null {
  if (!expiry) return null;
  const days = daysBetween(today, expiry);
  if (days < 0) return { days, tone: 'expired', label: `过期 ${-days} 天` };
  if (days === 0) return { days, tone: 'today', label: '今天到期' };
  if (days <= 2) return { days, tone: 'soon', label: `还剩 ${days} 天` };
  return { days, tone: 'fresh', label: `还能放 ${days} 天` };
}

export interface PantryEntry {
  name: string;
  group: IngredientGroup;
  expiry: string | undefined;
  info: ExpiryInfo | null;
}

/** 冰箱里的东西按「快过期」排好，提醒和管理都用它 */
export function pantryOverview(
  pantry: string[],
  expiry: Record<string, string>,
  today: string,
  catalog: PantryCatalogItem[] = buildPantryCatalog(),
): PantryEntry[] {
  return pantry
    .map((name) => ({
      name,
      group: groupOf(catalog, name),
      expiry: expiry[name],
      info: expiryInfo(expiry[name], today),
    }))
    .sort((a, b) => {
      const left = a.info?.days ?? Number.MAX_SAFE_INTEGER;
      const right = b.info?.days ?? Number.MAX_SAFE_INTEGER;
      return left - right;
    })
}

export function addDays(date: string, days: number): string {
  const target = new Date(`${date}T00:00:00`);
  target.setDate(target.getDate() + days);
  const y = target.getFullYear();
  const m = `${target.getMonth() + 1}`.padStart(2, '0');
  const d = `${target.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86400000));
}

/** 买菜清单里按超市区域展示的先后顺序 */
export const SHOP_GROUP_ORDER: IngredientGroup[] = ['蔬菜', '肉禽蛋', '豆制品', '主食', '调味'];
