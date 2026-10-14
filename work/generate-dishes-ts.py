# -*- coding: utf-8 -*-
"""把 dishes.json 生成 App 用的 src/data/dishes.ts。"""
import json
import zlib
from pathlib import Path

# 脚本在 <项目>\work\ 下，dishes.json 读这里，dishes.ts 写到上一级的 src\data\
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

SOURCE = str(HERE / "dishes.json")
TARGET = str(ROOT / "src" / "data" / "dishes.ts")

# 注意：103 道菜现在**每道都有封面**了（assets/dishes/dish-001.jpg … dish-103.jpg，
# 编号 = 图片合集里的编号 = 菜谱顺序）。
#   1) work/import-dish-images.ps1 把「家常菜图片合集」里的原图压成 dish-0NN.jpg
#   2) 本脚本生成 dishes.ts 之后，再跑一次
#        node work/wire-dish-covers.mjs
#      把 103 道菜的 cover 都接上（这个脚本只认下面这 13 张旧图，跑完会被覆盖掉）
COVER_MAP = {
    "红烧肉": "hongshaorou",
    "回锅肉": "huiguorou",
    "鱼香肉丝": "yuxiang",
    "糖醋里脊": "sweetsourPork",
    "宫保鸡丁": "kungpao",
    "麻婆豆腐": "mapoTofu",
    "地三鲜": "disanxian",
    "可乐鸡翅": "colaWings",
    "蛋炒饭": "eggFriedRice",
    "冬瓜排骨汤": "wintermelonSoup",
    "番茄鸡蛋汤": "tomatoSoup",
    "西红柿炒蛋": "tomatoEgg",
    "香菇青菜": "bokchoy",
}

CATEGORY_TAGLINE = {
    "猪肉类": "家常硬菜",
    "牛肉类": "炖一锅香的",
    "鸡肉类": "鲜嫩下饭",
    "鱼虾海鲜": "鲜味当家",
    "素菜类": "清爽解腻",
    "素菜/蛋类": "快手小炒",
    "素菜/豆类": "素菜也下饭",
    "凉菜类": "开胃凉菜",
    "汤品类": "热乎一碗",
    "主食类": "主食担当",
}

GROUP_ORDER = ["蔬菜", "肉禽蛋", "豆制品", "调味", "主食"]


def js_number(value):
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def weight_of(item):
    """按用量估个权重：论克/毫升的按量算，论个/根的按 30 克估，适量给 20 克。"""
    amount = item["amount"] or 0
    if amount <= 0:
        return 20
    if item["unit"] in ("克", "毫升"):
        return amount
    return amount * 30


def split_price(total, items):
    """参考价按用量权重摊到每样要买的食材上，最后按 0.5 元对齐。"""
    if not items:
        return {}
    weights = [weight_of(item) for item in items]
    total_weight = sum(weights) or 1
    shares = [total * weight / total_weight for weight in weights]
    rounded = [max(0.5, round(share * 2) / 2) for share in shares]
    # 把误差补回权重最大的那样，保证加起来还是整道菜的参考价
    biggest = weights.index(max(weights))
    rounded[biggest] = round(max(0.5, rounded[biggest] + total - sum(rounded)), 1)
    return {id(item): price for item, price in zip(items, rounded)}


with open(SOURCE, encoding="utf-8") as handle:
    dishes = json.load(handle)

lines = [
    "// 菜谱数据：来自「家常菜大全100道.xlsx」",
    "// 由 work/extract-dishes.py + work/generate-dishes-ts.py 生成；要改菜谱请改 Excel 后重新生成。",
    "import type { Dish } from '../types';",
    "",
]

used_covers = sorted({COVER_MAP[d["name"]] for d in dishes if d["name"] in COVER_MAP})
asset_path = {
    "hongshaorou": "hongshaorou",
    "huiguorou": "huiguorou",
    "yuxiang": "yuxiang",
    "sweetsourPork": "sweetsour-pork",
    "kungpao": "kungpao",
    "mapoTofu": "mapo-tofu",
    "disanxian": "disanxian",
    "colaWings": "cola-wings",
    "eggFriedRice": "egg-fried-rice",
    "wintermelonSoup": "wintermelon-soup",
    "tomatoSoup": "tomato-soup",
    "tomatoEgg": "tomato-egg",
    "bokchoy": "bokchoy",
}
for name in used_covers:
    lines.append(f"import {name} from '../../assets/dishes/{asset_path[name]}.jpg';")

lines += ["", "export const DISHES: Dish[] = ["]

for index, dish in enumerate(dishes):
    minutes = dish["minutes"] or 30
    difficulty = "零失败" if minutes <= 15 else "容易" if minutes <= 45 else "有点难"
    tags = [dish["category"]]
    if minutes <= 20:
        tags.append("快手")
    if minutes >= 60:
        tags.append("慢炖")
    popularity = 55 + zlib.crc32(dish["name"].encode("utf-8")) % 41

    ingredients = dish["ingredients"]
    buyable = [item for item in ingredients if not item["staple"]]
    price_of = split_price(dish["costYuan"], buyable)

    cover = COVER_MAP.get(dish["name"])
    lines.append("  {")
    lines.append(f"    id: 'dish-{dish['sourceIndex'] or index + 1}',")
    lines.append(f"    name: {json.dumps(dish['name'], ensure_ascii=False)},")
    if cover:
        lines.append(f"    cover: {cover},")
    lines.append(f"    category: {json.dumps(dish['category'], ensure_ascii=False)},")
    lines.append(
        f"    tagline: {json.dumps(dish['category'] + ' · ' + CATEGORY_TAGLINE.get(dish['category'], '家常做法'), ensure_ascii=False)},"
    )
    lines.append(f"    tags: {json.dumps(tags, ensure_ascii=False)},")
    lines.append(f"    costYuan: {js_number(dish['costYuan'])},")
    lines.append(f"    minutes: {minutes},")
    lines.append(f"    difficulty: {json.dumps(difficulty, ensure_ascii=False)},")
    lines.append(f"    popularity: {popularity},")
    lines.append("    baseServings: 2,")
    lines.append("    ingredients: [")
    for item in ingredients:
        price = price_of.get(id(item), 0)
        staple = "true" if item["staple"] else "false"
        lines.append(
            "      { "
            f"name: {json.dumps(item['name'], ensure_ascii=False)}, "
            f"amount: {js_number(item['amount'])}, "
            f"unit: {json.dumps(item['unit'], ensure_ascii=False)}, "
            f"group: {json.dumps(item['group'], ensure_ascii=False)}, "
            f"price: {js_number(price)}, staple: {staple} "
            "},"
        )
    lines.append("    ],")
    lines.append("    steps: [")
    for step in dish["steps"]:
        lines.append(f"      {{ text: {json.dumps(step, ensure_ascii=False)} }},")
    lines.append("    ],")
    lines.append("    tips: [],")
    lines.append("  },")

lines += [
    "];",
    "",
    "export function getDishById(id: string): Dish | undefined {",
    "  return DISHES.find((dish) => dish.id === id);",
    "}",
    "",
    "export function popularDishes(limit = 6): Dish[] {",
    "  return [...DISHES].sort((a, b) => b.popularity - a.popularity).slice(0, limit);",
    "}",
    "",
]

with open(TARGET, "w", encoding="utf-8", newline="\n") as handle:
    handle.write("\n".join(lines))

print("dishes:", len(dishes))
print("with-cover:", sum(1 for d in dishes if d["name"] in COVER_MAP))
print("ingredients:", sum(len(d["ingredients"]) for d in dishes))
print("steps:", sum(len(d["steps"]) for d in dishes))
print("target:", TARGET)
