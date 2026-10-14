// 把 dishes.ts 里的封面接上：每道菜一张 assets/dishes/dish-0NN.jpg
// （图片合集里的编号 = 菜谱顺序，和 dish id 的数字对得上，已经用 check-dish-images.mjs 核过）
import fs from 'node:fs';

const TARGET = 'D:/b/recipe-app/src/data/dishes.ts';
const COUNT = 103;

// 文件名带横杠（dish-001.jpg），JS 变量名不能带，所以分开拼
const paddedOf = (number) => String(number).padStart(3, '0');
const fileOf = (number) => `dish-${paddedOf(number)}`;
const varOf = (number) => `dish${paddedOf(number)}`;

const source = fs.readFileSync(TARGET, 'utf8').replace(/^\uFEFF/, '');

const imports = Array.from({ length: COUNT }, (_, index) => {
  return `import ${varOf(index + 1)} from '../../assets/dishes/${fileOf(index + 1)}.jpg';`;
}).join('\n');

// 1) 换掉原来那 13 行封面 import
const withImports = source.replace(
  /(?:^import \w+ from '\.\.\/\.\.\/assets\/dishes\/[^']+';$\n)+/m,
  `${imports}\n`,
);
if (withImports === source) throw new Error('没找到封面 import 块，dishes.ts 结构和预期不一样');

// 2) 每道菜都补上 / 换成自己的封面（原来只有 13 道有）
let wired = 0;
const wiredSource = withImports.replace(
  /(\n  \{\n    id: 'dish-(\d+)',\n    name: (?:"[^"]+"|'[^']+'),\n)(?:    cover: [^,\n]+,\n)?/g,
  (_match, head, number) => {
    wired += 1;
    return `${head}    cover: ${varOf(Number(number))},\n`;
  },
);

if (wired !== COUNT) throw new Error(`只接上了 ${wired} 道菜，应该是 ${COUNT} 道`);
if ((wiredSource.match(/cover: dish\d{3}/g) || []).length !== COUNT) {
  throw new Error('写完以后 cover 行数不对');
}

fs.writeFileSync(TARGET, wiredSource);

console.log(`封面 import：${COUNT} 行`);
console.log(`接上封面的菜：${wired} 道`);
console.log(`文件行数：${source.split('\n').length} -> ${wiredSource.split('\n').length}`);
