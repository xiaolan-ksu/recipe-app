# -*- coding: utf-8 -*-
"""把「家常菜大全100道.xlsx」转成 App 用的 JSON（菜名、分类、价格、时间、食材、步骤）。"""
import json
import re
from pathlib import Path

import pandas as pd

# 脚本在 <项目>\work\ 下，产物也写在这里，项目整体移动后无需改路径
HERE = Path(__file__).resolve().parent

PATH = r"D:\下载\家常菜大全100道.xlsx"
OUT = str(HERE / "dishes.json")

UNIT_PATTERN = (
    "千克|公斤|kg|毫升|ml|克|g|大勺|小勺|汤匙|茶匙|勺|寸|斤|两|片|个|只|根|条|大把|把|颗|瓣|块|段|碗|朵|杯|滴|撮|扎|张|头|棵|穗|包|盒|罐|听|袋|节|倍|瓶"
)
UNIT_ALIASES = {
    "g": "克",
    "G": "克",
    "kg": "千克",
    "ml": "毫升",
    "ML": "毫升",
    "大勺": "汤匙",
    "茶匙": "小勺",
    "斤": "克",
    "两": "克",
    "勺": "汤匙",
    "张": "张",
    "大把": "把",
}

CHINESE_NUMBERS = {
    "半": 0.5,
    "一": 1,
    "二": 2,
    "两": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
    "十": 10,
}
STAPLE_WORDS = [
    "盐",
    "生抽",
    "老抽",
    "酱油",
    "食用油",
    "油",
    "白糖",
    "白胡椒粉",
    "胡椒粉",
    "料酒",
    "淀粉",
    "鸡精",
    "味精",
    "香醋",
    "陈醋",
    "醋",
    "蚝油",
    "香油",
    "芝麻油",
    "清水",
]

# 这些不是食材，直接不记
SKIP_WORDS = ["清水", "温水", "开水", "热水", "冰水", "凉水", "冷水", "水"]

# 同一个东西的不同写法，合并成一种（只合并等价的写法，不合并不同食材）
SYNONYMS = {
    "西红柿": "番茄",
    "带皮五花肉": "五花肉",
    "五花肉/瘦肉": "五花肉",
    "猪小排": "排骨",
    "前腿肉": "猪肉",
    "牛柳": "牛里脊",
    "鸡腿肉": "鸡腿",
    "鸡腿肉/鸡胸": "鸡腿",
    "鸡块": "鸡肉",
    "土鸡/鸡腿": "土鸡",
    "鸡翅中": "鸡翅",
    "虾仁": "虾",
    "鲜虾": "虾",
    "干木耳": "木耳",
    "干香菇": "香菇",
    "鲜香菇": "香菇",
    "香菇末": "香菇",
    "榛蘑/香菇": "香菇",
    "长茄子": "茄子",
    "青红椒": "青椒",
    "青尖椒": "青椒",
    "尖椒/杭椒": "青椒",
    "杭椒": "青椒",
    "紫洋葱": "洋葱",
    "洋葱丝": "洋葱",
    "胡萝卜丝": "胡萝卜",
    "胡萝卜丁": "胡萝卜",
    "青椒丝": "青椒",
    "土豆丝": "土豆",
    "土豆条": "土豆",
    "土豆/红薯": "土豆",
    "藕片": "莲藕",
    "莲藕片": "莲藕",
    "黄瓜丝": "黄瓜",
    "姜片": "姜",
    "姜丝": "姜",
    "蒜末": "蒜",
    "蒜蓉": "蒜",
    "蒜泥": "蒜",
    "蒜片": "蒜",
    "葱花": "小葱",
    "葱": "小葱",
    "葱白丝": "大葱",
    "青蒜苗": "青蒜",
    "蛋清": "鸡蛋",
    "郫县豆瓣酱": "豆瓣酱",
    "泡椒/豆瓣酱": "泡椒",
    "香醋": "醋",
    "白醋": "醋",
    "白醋糖": "醋",
    "陈醋": "醋",
    "白胡椒": "白胡椒粉",
    "糖": "白糖",
    "热油": "食用油",
    "淀粉水": "淀粉",
    "淀粉糊": "淀粉",
    "熟芝麻": "白芝麻",
    "八角桂皮": "八角",
    "包菜/圆白菜": "包菜",
    "娃娃菜/生菜": "娃娃菜",
    "油麦菜/菜心/菠菜": "青菜",
    "西兰花等自选": "西兰花",
    "海鲜菇等共": "海鲜菇",
    "嫩/内酯豆腐": "嫩豆腐",
    "皮带面/面条": "面条",
    "三黄鸡半只": "三黄鸡",
    "鲜虾仁": "虾",
    "北豆腐": "豆腐",
    "细面": "面条",
    "剩米饭": "米饭",
    "甜玉米": "玉米",
    "玉米粒": "玉米",
    "芝麻": "白芝麻",
}

# 这些是调料/酱料，先按名单挑出来，免得「鱼香汁」因为带个鱼字被当成海鲜
SEASONING_NAMES = {
    "鱼香汁",
    "糖醋汁",
    "姜葱蘸料",
    "蘸料",
    "香醋蘸料",
    "黑椒酱",
    "腐乳汁",
    "蒸肉米粉",
    "火锅底料",
    "麻辣香锅底料",
    "蒸鱼豉油",
    "芝麻酱",
    "咖喱块",
    "孜然粉",
    "辣椒粉",
    "花椒粉",
    "小苏打",
    "料酒",
    "蚝油",
    "香油",
    "食用油",
    "葱油",
    "醋",
    "白糖",
    "冰糖",
    "八角",
    "花椒",
    "干辣椒",
    "白芝麻",
    "花生碎",
    "炸花生米",
}

GROUP_RULES = [
    ("肉禽蛋", ["肉", "猪", "里脊", "排骨", "鸡", "鸭", "牛", "羊", "蛋", "培根", "火腿", "腊", "肠", "丸", "虾", "蟹", "鱼", "贝", "蛤", "鱿", "墨鱼", "海参"]),
    ("豆制品", ["豆腐", "豆干", "香干", "豆皮", "千张", "腐竹", "素鸡", "油豆"]),
    ("主食", ["米饭", "面条", "面", "粉丝", "粉", "馒头", "米", "年糕", "饺", "粮", "花生米"]),
    ("蔬菜", ["菜", "葱", "姜", "蒜", "椒", "萝卜", "瓜", "菇", "笋", "藕", "茄", "豆", "芹", "韭", "薯", "芋", "番茄", "西红柿", "土豆", "玉米", "木耳", "银耳", "山药", "菠菜", "生菜", "白菜", "莴", "荠", "苋", "芦笋", "西兰花", "花菜", "芽", "苗", "叶"]),
]


def clean_name(raw: str) -> str:
    name = raw.strip()
    name = re.sub(r"[（(].*?[)）]", "", name)
    name = re.sub(r"^[约近大概]{1,2}", "", name)
    name = re.sub(r"^(量|几)", "", name) if len(name) > 2 else name
    name = re.sub(r"(适量|少许|若干|一点|一些|各|左右|约|多量|大量|足量|垫底)+$", "", name)
    name = name.strip("．.。·、,， ")
    return name


def group_of(name: str) -> str:
    if name in SEASONING_NAMES:
        return "调味"
    for group, words in GROUP_RULES:
        if any(word in name for word in words):
            return group
    return "调味"


def refine_name(name: str, amount, unit):
    """名字尾巴上还挂着「半只」「1 罐」这类量词时，把它挪到数量上。"""
    name = re.sub(r"(可选|自选|等|等共)+$", "", name)
    name = re.sub(r"[\d/]+$", "", name)
    match = re.search(
        rf"(?P<num>\d+(?:\.\d+)?|[半一二两三四五六七八九十]{{1,2}})\s*(?P<unit>{UNIT_PATTERN})$",
        name,
    )
    if not match:
        return re.sub(r"[/\s]+$", "", name), amount, unit

    head = name[: match.start()].strip(" /")
    if not head:
        return name, amount, unit

    if unit == "适量":
        raw = match.group("num")
        value = float(raw) if re.fullmatch(r"\d+(?:\.\d+)?", raw) else float(CHINESE_NUMBERS.get(raw, 1))
        amount = int(value) if float(value).is_integer() else value
        tail_unit = UNIT_ALIASES.get(match.group("unit"), match.group("unit"))
        return head, amount, tail_unit
    return head, amount, unit


def to_grams(amount: float, unit: str) -> tuple:
    if unit == "斤":
        return amount * 500, "克"
    if unit == "两":
        return amount * 50, "克"
    return amount, unit


def parse_ingredient(chunk: str) -> dict | None:
    text = re.sub(r"[（(].*?[)）]", "", chunk).strip()
    text = text.replace("：", ":").strip("．.。·、 ")
    if not text:
        return None

    amount = None
    unit = None
    name = ""

    match = re.match(rf"^(?P<name>.*?)(?P<amount>\d+(?:\.\d+)?)\s*(?P<unit>{UNIT_PATTERN})?$", text)
    if match and clean_name(match.group("name")):
        amount = float(match.group("amount"))
        unit = match.group("unit")
        name = clean_name(match.group("name"))
    else:
        match = re.match(
            rf"^(?P<name>.*?)(?P<amount>[半一二两三四五六七八九十])\s*(?P<unit>{UNIT_PATTERN})?$",
            text,
        )
        if match and clean_name(match.group("name")) and match.group("unit"):
            amount = float(CHINESE_NUMBERS[match.group("amount")])
            unit = match.group("unit")
            name = clean_name(match.group("name"))
        else:
            name = clean_name(text)
            amount, unit = 0, "适量"

    unit = UNIT_ALIASES.get(unit or "", unit or "份")
    amount, unit = to_grams(amount, unit)
    if float(amount).is_integer():
        amount = int(amount)

    if not name:
        return None

    if name in SKIP_WORDS:
        return None

    name, amount, unit = refine_name(name, amount, unit)
    if not name or name in SKIP_WORDS:
        return None
    name = SYNONYMS.get(name, name)

    return {
        "name": name,
        "amount": amount,
        "unit": unit,
        "group": group_of(name),
        "staple": any(word in name for word in STAPLE_WORDS) and len(name) <= 6,
    }


def parse_ingredients(raw: str) -> list:
    text = str(raw)
    chunks = re.split(r"[、，,;；]", text)
    items = []
    seen = set()
    for chunk in chunks:
        item = parse_ingredient(chunk)
        if not item:
            continue
        key = (item["name"], item["unit"])
        if key in seen:
            continue
        seen.add(key)
        items.append(item)
    return items


def parse_steps(raw: str) -> list:
    text = re.sub(r"\s+", "", str(raw))
    text = text.replace("...", "。").replace("……", "。").replace("→", "。").replace("；", "。")
    segments = [part.strip("。.，, ") for part in text.split("。") if part.strip("。.，, ")]

    steps = []
    for segment in segments:
        if len(segment) <= 24:
            steps.append(segment)
            continue
        parts = [part.strip("，, ") for part in re.split(r"[，,]", segment) if part.strip("，, ")]
        buffer = ""
        for part in parts:
            candidate = f"{buffer}，{part}" if buffer else part
            if buffer and len(candidate) > 16:
                steps.append(buffer)
                buffer = part
            else:
                buffer = candidate
        if buffer:
            steps.append(buffer)
    return steps[:10]


frame = pd.read_excel(PATH).fillna("")

dishes = []
seen_names = set()
for _, row in frame.iterrows():
    name = str(row["菜名"]).strip()
    if not name or name in seen_names:
        continue
    seen_names.add(name)
    ingredients = parse_ingredients(row["食材及用量(2-3人份)"])
    if len(ingredients) == 0:
        continue
    dishes.append(
        {
            "sourceIndex": int(row["序号"]) if str(row["序号"]).strip().isdigit() else None,
            "name": name,
            "category": str(row["分类"]).strip(),
            "costYuan": float(row["大概价格(元)"] or 0),
            "minutes": int(row["制作时间(分钟)"] or 0),
            "ingredients": ingredients,
            "steps": parse_steps(row["简要做法"]),
        }
    )

with open(OUT, "w", encoding="utf-8") as handle:
    json.dump(dishes, handle, ensure_ascii=False, indent=2)

# 体检报告写文件，避免中文在控制台里乱码
suspicious = []
for dish in dishes:
    for item in dish["ingredients"]:
        if re.search(r"[\d半一二两三四五六七八九十]", item["name"]) or len(item["name"]) > 5:
            suspicious.append(f'{dish["name"]} -> {item["name"]} | {item["amount"]} {item["unit"]}')

with open(HERE / "parse-report.txt", "w", encoding="utf-8") as handle:
    handle.write(f"菜数: {len(dishes)}\n")
    handle.write(f"分类: {sorted({d['category'] for d in dishes})}\n\n")
    handle.write(f"步骤数分布: {sorted({len(d['steps']) for d in dishes})}\n")
    handle.write(f"平均步骤数: {sum(len(d['steps']) for d in dishes) / len(dishes):.2f}\n\n")
    handle.write(f"需要看的食材条目（含数字/名字过长/没量词）共 {len(suspicious)} 条:\n")
    handle.write("\n".join(suspicious))
    handle.write("\n\n--- 全部菜名 ---\n")
    handle.write("、".join(f"{d['name']}({d['category']})" for d in dishes))

# 控制台只打 ASCII 摘要，避免中文在 GBK 控制台里变乱码
units = {}
groups = {}
no_amount = 0
for dish in dishes:
    for item in dish["ingredients"]:
        units[item["unit"]] = units.get(item["unit"], 0) + 1
        groups[item["group"]] = groups.get(item["group"], 0) + 1
        if item["unit"] == "适量":
            no_amount += 1

print("dishes:", len(dishes))
print("rows-in-file:", len(frame))
print("ingredients-total:", sum(len(d["ingredients"]) for d in dishes))
print("ingredients-without-amount:", no_amount)
print("steps-total:", sum(len(d["steps"]) for d in dishes))
print("categories:", len({d["category"] for d in dishes}))
print("units:", json.dumps({k: v for k, v in sorted(units.items(), key=lambda x: -x[1])}, ensure_ascii=True))
print("groups:", json.dumps(groups, ensure_ascii=True))
print("out:", OUT)
