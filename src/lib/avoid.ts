/**
 * 忌口匹配。
 *
 * 为什么不能只靠字符串互含：食材名和忌口项对不上。
 *  - 忌口写「牛肉」，菜谱里写的是「牛腩」「牛里脊」→ 一道都挡不住；
 *  - 忌口写「葱」，`includes('葱')` 会连带挡掉「洋葱」→ 误伤。
 *
 * 所以这里显式声明「一个忌口项对应哪些食材写法」，再用例外表把
 * 语义无关的食材（洋葱、蒜苔、牛奶）摘出去。
 */
import { AVOID_EXCEPTIONS, AVOID_GROUPS } from '../constants';
import type { Dish } from '../types';

/** 单个食材名是否命中某个忌口项 */
export function ingredientHitsAvoid(ingredientName: string, avoidTag: string): boolean {
  const exceptions = AVOID_EXCEPTIONS[avoidTag] ?? [];
  if (exceptions.some((word) => ingredientName.includes(word))) return false;

  const group = AVOID_GROUPS[avoidTag] ?? [avoidTag];
  return group.some((word) => ingredientName.includes(word));
}

/** 这道菜是否含被忌口的食材 */
export function dishHitsAvoid(dish: Dish, avoid: string[]): boolean {
  if (avoid.length === 0) return false;
  return dish.ingredients.some((ing) => avoid.some((tag) => ingredientHitsAvoid(ing.name, tag)));
}

export interface AvoidFilterResult {
  /** 忌口过滤后剩下的菜 */
  dishes: Dish[];
  /** 因为忌口被挡掉的菜 */
  blocked: Dish[];
  /**
   * 过滤后一道不剩——调用方必须把这件事告诉用户，
   * 不能像以前那样偷偷把忌口的菜放回来。
   */
  empty: boolean;
}

/**
 * 按忌口过滤。
 * 注意两点：
 * 1. **不会**在结果为空时回退到未过滤的列表。忌口是硬约束，
 *    是否放宽由用户决定（界面给「查看全部」入口），不由代码替用户决定。
 * 2. 返回的 `dishes` **永远是新的数组**，调用方可以直接 sort 而不会
 *    把传进来的原数组（往往来自 store）改掉。
 */
export function filterByAvoid(dishes: Dish[], avoid: string[]): AvoidFilterResult {
  if (avoid.length === 0) return { dishes: [...dishes], blocked: [], empty: false };

  const kept: Dish[] = [];
  const blocked: Dish[] = [];
  dishes.forEach((dish) => {
    if (dishHitsAvoid(dish, avoid)) blocked.push(dish);
    else kept.push(dish);
  });

  return { dishes: kept, blocked, empty: kept.length === 0 && blocked.length > 0 };
}
