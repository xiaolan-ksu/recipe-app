# 「今天吃什么」项目指令

> 这个文件会被 AI 编码助手自动加载。详细交接说明见 `docs/项目上下文摘要.md`。

## 这是什么

家常菜谱 App「今天吃什么」。React Native + Expo SDK 57 + TypeScript，安卓为主，同一套代码也能跑网页版。
含自建后端的「共享清单」（两人共用买菜清单 + 冰箱库存）和「云更新」（OTA）。

## 目录结构

| 内容 | 路径 |
| --- | --- |
| App 源码 | `src/`（改这里） |
| 后端源码 | `server/`（`app.js` / `db.js` / `updates.js`） |
| 菜谱数据生成脚本 | `work/`（`extract-dishes.py`、`generate-dishes-ts.py`、`wire-dish-covers.mjs`） |
| 菜品图片 | `assets/dishes/` |
| 文档 | `docs/` |

## 硬性约束

- **不要手改 `src/data/dishes.ts`**：它由 Excel 经 `work/extract-dishes.py` + `work/generate-dishes-ts.py` 生成，
  生成后必须再跑 `node work/wire-dish-covers.mjs` 接封面。
- **两个版本号分开**：
  - `app.json` 的 `version`（当前版本）每推一次更新 +1，`versionCode` 对齐 `大版本×10000+中×100+小`。
  - `app.json` 的 `runtimeVersion` 是**固定字符串** `"9.1.2"`，只有重打安装包时才改。
    **绝对不能用 `{policy: appVersion}`**，否则老手机再也收不到 OTA。
- **只有自己加的菜能删**（`dish.isCustom`），内置的 103 道不提供删除入口。这是用户明确定稿的要求，
  曾做过「内置菜也能删」的版本，已被否掉并完整回滚，不要再加回来。
- 服务器上 `/updates`、`/api/app/latest` 是公开接口，**不要往里放敏感信息**。
- **本仓库不含任何真实凭据**：服务器地址一律写作 `YOUR_SERVER_IP`，私钥请自行生成（见 `快速上手.md`）。

## 常用命令

```powershell
# 安装依赖（pnpm 11；原生模块需要 hoisted 布局）
pnpm install

# 网页版预览
pnpm web

# 类型检查
pnpm typecheck

# 导出网页版静态文件
pnpm export:web
```

## 构建环境的坑（重新打包必看）

1. Windows 用户名含中文时 → `TEMP`/`TMP` 必须指向纯英文短路径，否则 cmd 按 GBK 误读自动生成的 .bat。
2. 某些沙箱环境里 JDK 的 AF_UNIX 自管道连不上 → 需设置 `JAVA_TOOL_OPTIONS` 指向不存在的临时目录。
3. pnpm 11 不读 `.npmrc` 的 `node-linker` → 写在 `pnpm-workspace.yaml`（`nodeLinker: hoisted`），
   否则原生模块落在 `.pnpm` 超长路径下，CMake 报「对象路径超 250 字符」。
4. Metaspace 需 1024m（`android\gradle.properties`）。
5. `npx` 不在 PATH 上时 → 用 `node node_modules\@expo\cli\build\bin\cli <命令>`。
6. 完整打包流程：`expo prebuild --platform android --clean --no-install` → 重建 `android\local.properties`
   （`sdk.dir=<你的 Android SDK 路径>`）→ 用你的打包脚本构建。
7. 构建链：JDK 17、Gradle 9.3.1、AGP 8.12.0、compileSdk/targetSdk 36、minSdk 24。

## 忌口逻辑（改这块前先看）

忌口匹配**只有一份实现**：`src/lib/avoid.ts`，别在页面里再写内联版本。

- 食材名和忌口项常常对不上（忌口「牛肉」，菜谱写「牛腩」），所以 `src/constants.ts` 里用
  `AVOID_GROUPS` 显式声明「一个忌口项对应哪些食材写法」，用 `AVOID_EXCEPTIONS` 摘掉
  名字带那个字但其实是别的东西的食材（洋葱≠葱、牛奶≠牛肉、蒜苔≠蒜）。
- **忌口是硬约束**：`filterByAvoid` 结果为空时**不回退**到未过滤列表。
  界面负责告诉用户「这一类都被忌口挡掉了」，并给「查看全部」入口（只临时放宽，不改用户设置）。
- 所有会推荐菜的地方都要过忌口：首页大卡片、首页人气榜、菜谱页、食材页「能做的菜」。
- `filterByAvoid` 返回的数组**永远是新的**，调用方可以直接 `sort`，不会污染 store。

## 服务器

- 后端代码在 `server/`，部署在你自己的服务器上。
- 地址通过 `src/lib/share.ts` 的 `EXPO_PUBLIC_API_BASE` 环境变量配置，默认值为占位符。
- 数据库：`server/data/data.db`（SQLite，已 gitignore）。

## 待办

1. 推荐页优化剩下的部分（D/E 组，见 `docs/推荐页优化-需求.md`）：
   D1 真正的「今日」轮换（现在是每次启动都固定红烧肉）、D2「最近很受欢迎」改名或做成个性化、
   D3 收藏该加权还是降权、E1 做饭评分回喂推荐、E2 用时偏好、E3 临期食材联动。
   注：C 组「口味偏好」已按用户决定**整体下线**（数据里 0/103 道有口味标注，推不出来）。
2. `dishes.ts` 笔误「红烧牛肉面牛肉」——改 Excel 重新生成。
