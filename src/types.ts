import type { ImageSourcePropType } from 'react-native';

export type Category =
  | '猪肉类'
  | '牛肉类'
  | '鸡肉类'
  | '鱼虾海鲜'
  | '素菜类'
  | '素菜/蛋类'
  | '素菜/豆类'
  | '凉菜类'
  | '汤品类'
  | '主食类';

export type CategoryFilter = '全部' | Category;

export type IngredientGroup = '蔬菜' | '肉禽蛋' | '豆制品' | '调味' | '主食';

export interface DishIngredient {
  name: string;
  /** 用料量，按 baseServings 人份计算 */
  amount: number;
  unit: string;
  group: IngredientGroup;
  /** 这项食材的大致花费（按 baseServings 人份） */
  price: number;
  /** 家里常备的调味料，买菜清单里默认不勾选 */
  staple?: boolean;
}

export interface DishStep {
  text: string;
  tip?: string;
}

export interface Dish {
  id: string;
  name: string;
  /** 自己加的菜可能没配图，没有时界面用渐变占位 */
  cover?: ImageSourcePropType;
  category: Category;
  /** 卡片上那行小字，例如「快手菜 · 家的味道」 */
  tagline: string;
  /** 一句话描述；菜谱数据里没有就留空，界面会自动不显示 */
  description?: string;
  tags: string[];
  costYuan: number;
  minutes: number;
  difficulty: string;
  popularity: number;
  /** 菜谱用量对应几人份 */
  baseServings: number;
  ingredients: DishIngredient[];
  steps: DishStep[];
  tips: string[];
  /** 这道菜是用户自己加的 */
  isCustom?: boolean;
  createdAt?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  group: IngredientGroup;
  price: number;
  checked: boolean;
  fromDishIds: string[];
}

export interface CookingLog {
  id: string;
  dishId: string;
  date: string;
  rating: number;
  note?: string;
}
