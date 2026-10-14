import type { Category, CategoryFilter, IngredientGroup } from './types';

/** 菜谱数据里的分类，菜谱页和首页的分类胶囊用的就是这一份 */
export const CATEGORIES: Category[] = [
  '猪肉类',
  '牛肉类',
  '鸡肉类',
  '鱼虾海鲜',
  '素菜类',
  '素菜/蛋类',
  '素菜/豆类',
  '凉菜类',
  '汤品类',
  '主食类',
];

export const CATEGORY_FILTERS: CategoryFilter[] = ['全部', ...CATEGORIES];

export const INGREDIENT_GROUPS: IngredientGroup[] = ['蔬菜', '肉禽蛋', '豆制品', '调味', '主食'];

/** 买菜清单按超市里的区域分组 */
export const GROUP_LABEL: Record<IngredientGroup, string> = {
  蔬菜: '蔬菜区',
  肉禽蛋: '肉禽蛋区',
  豆制品: '豆制品区',
  调味: '调味区',
  主食: '主食区',
};

/** 忌口选项，勾上以后推荐和菜谱都会避开含这些食材的菜 */
export const AVOID_OPTIONS = ['辣椒', '香菜', '葱', '姜', '蒜', '牛肉', '羊肉', '虾', '内脏'];

/**
 * 每个忌口项对应菜谱里的哪些食材写法。
 *
 * 不能只靠 `食材名.includes(忌口词)`：忌口写「牛肉」，菜谱里写的是
 * 「牛腩」「牛里脊」，字符串对不上，一道都挡不住。所以这里显式列出来。
 */
export const AVOID_GROUPS: Record<string, string[]> = {
  辣椒: ['辣椒', '泡椒', '剁椒', '小米辣', '麻辣香锅', '火锅底料'],
  香菜: ['香菜'],
  葱: ['葱'],
  姜: ['姜'],
  蒜: ['蒜'],
  牛肉: ['牛'],
  羊肉: ['羊'],
  // 虾皮也是虾，过敏的人一样要避开，所以不设例外
  虾: ['虾'],
  内脏: ['猪肝', '百叶', '肥肠', '腰花', '猪肚', '猪心', '猪肺', '黄喉', '毛肚', '胗'],
};

/**
 * 名字里带那个字、其实是另一样东西的食材，要放过。
 * 例如「洋葱」不是葱、「牛奶」不是牛肉、「蒜苔」不是蒜。
 */
export const AVOID_EXCEPTIONS: Record<string, string[]> = {
  葱: ['洋葱'],
  蒜: ['蒜苔'],
  牛肉: ['牛奶'],
};
