# 「今天吃什么」共享清单后端

让两台手机看到同一份买菜清单和同一份冰箱库存。数据存在本目录的 `data/data.db`，
备份就是拷这一个文件。

## 当前部署状态（2026-10-13 已部署）

| 项 | 值 |
| --- | --- |
| 服务器 | `YOUR_SERVER_IP`（Windows Server 2022，宝塔 Windows 面板） |
| 对外地址 | `http://YOUR_SERVER_IP:8080` |
| 代码目录 | `C:\backend\`（`server.js` + `db.js` + `updates.js`） |
| 数据文件 | `C:\backend\data\data.db` |
| 日志 | `C:\backend\logs\server.log`（另有 `data\out.log` / `data\err.log`） |
| 启动脚本 | `C:\backend\start-backend.cmd` |
| 常驻方式 | Windows 计划任务 `\BackendNodeService`（以 SYSTEM 身份、开机启动） |
| 运行时长上限 | 已设为「无限制」（否则默认跑满 72 小时会被系统杀掉） |
| 崩溃重启 | 已开启，失败后每分钟重试，最多 3 次 |
| 迁移前备份 | `C:\backend-backup-20261013\`（旧的 server.js、package.json、start-backend.cmd、demo 数据库） |

日常运维命令（在服务器上以管理员身份执行）：

```powershell
# 重启服务
schtasks /end /tn BackendNodeService
schtasks /run /tn BackendNodeService

# 看日志
Get-Content C:\backend\logs\server.log -Tail 30

# 备份数据（服务运行中也能拷）
Copy-Item C:\backend\data\data.db "D:\backup\data-$(Get-Date -Format yyyyMMdd).db"
```

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `app.js` | 服务入口。部署时改名为 `server.js` 放进 `C:\backend\` |
| `db.js` | 数据库和「操作合并」逻辑 |
| `updates.js` | 云更新：给手机发新的 JS 包，以及最新安装包的信息 |
| `package.json` | 依赖声明，只有一个 `express` |
| `data/` | 自动创建，存 `data.db` |
| `logs/` | 自动创建，存 `server.log` |
| `updates/` | 自动创建，一版一个目录（云更新用） |
| `apk/` | 自动创建，放最新安装包和 `latest.json` |

## 部署步骤（Windows + 宝塔面板）

1. **传文件**：把 `app.js`、`db.js`、`updates.js`、`package.json` 四个文件传到服务器一个目录，
   比如 `D:\recipe-share\`（路径别带中文和空格）。
   > 不用传 `node_modules` 和 `data`，服务器上会自己生成。

2. **装依赖**：在宝塔面板的终端里（或远程桌面开 CMD）

   ```
   cd /d D:\recipe-share
   npm install --registry=https://registry.npmmirror.com
   ```

3. **先手动起一次，确认能跑**：

   ```
   node app.js
   ```

   然后在服务器上打开浏览器访问 `http://127.0.0.1:8080/`，
   应该看到「服务正在运行」。确认没问题后按 `Ctrl + C` 停掉，交给面板常驻。

4. **交给面板常驻**：在宝塔的 Node 项目里把
   - 项目目录：`D:\recipe-share`
   - 启动文件：`app.js`
   - 端口：`8080`

   填好保存，点重启。

   > 如果面板里原来的骨架项目不想动，也可以新建一个项目指向新目录，再把旧的停掉。

5. **从外面验证**：用手机流量（关 Wi-Fi）打开 `http://YOUR_SERVER_IP:8080/`，
   能看到「服务正在运行」就说明通了。

## 换端口 / 换数据位置（可选）

用环境变量控制，不设就是默认值：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `8080` | 监听端口 |
| `DATA_DIR` | `./data` | 数据目录 |
| `DB_FILE` | `<DATA_DIR>/data.db` | 数据库文件完整路径 |

## 接口

除了 `/api/health`，其余接口都要带令牌：请求头 `Authorization: Bearer <令牌>`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 探活，返回 `{"status":"running"}` |
| POST | `/api/family/create` | 建家庭，返回 6 位家庭码 + 令牌 |
| POST | `/api/family/join` | 用家庭码加入，返回令牌（码是一次性的，用掉作废） |
| POST | `/api/family/code` | 重新生成邀请码（换手机时用） |
| GET | `/api/state?since=<rev>` | 拉取清单和库存；版本没变时返回 `{"unchanged":true}` |
| POST | `/api/ops` | 提交一批改动，返回最新状态 |

提交改动的格式：

```json
{
  "ops": [
    { "kind": "shopping", "action": "addAmount", "item": { "id": "番茄-克", "name": "番茄", "amount": 300, "unit": "克", "group": "蔬菜", "price": 4.5, "fromDishIds": ["dish-12"] } },
    { "kind": "shopping", "action": "patch", "id": "番茄-克", "patch": { "checked": true } },
    { "kind": "shopping", "action": "remove", "id": "番茄-克" },
    { "kind": "shopping", "action": "clearChecked" },
    { "kind": "shopping", "action": "clearAll" },
    { "kind": "pantry", "action": "add", "names": ["番茄"], "expiry": { "番茄": "2026-10-18" } },
    { "kind": "pantry", "action": "remove", "name": "番茄" },
    { "kind": "pantry", "action": "setExpiry", "name": "番茄", "date": "2026-10-20" },
    { "kind": "pantry", "action": "clearAll" }
  ]
}
```

`addAmount` 是**累加**语义：两个人同时从菜谱加同一道菜，数量会加起来，不会互相覆盖。

## 云更新（OTA）

App 里装了 `expo-updates`，配的更新地址就是 `http://YOUR_SERVER_IP:8080/updates`。
服务端按 [Expo Updates v1 协议](https://docs.expo.dev/technical-specs/expo-updates-1/) 应答，
用的是最简单的 JSON 形式（不带 multipart、不做代码签名）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/updates` | 手机来问「有没有新版」。带 `expo-platform` / `expo-runtime-version` 头；有新包回 200 + Manifest，没有回 **204**（客户端看到 `expo-protocol-version: 1` 就知道是「没更新」，不会报错） |
| GET | `/updates/files/<版本>/<时间戳>/<文件名>` | JS 包和图片本体。同一版目录内容永不改变，所以带一年缓存 |
| GET | `/api/app/latest` | 最新安装包的信息（版本、大小、sha256、下载地址） |
| GET | `/download/<文件名>.apk` | 安装包本体 |

浏览器直接打开 `http://YOUR_SERVER_IP:8080/updates` 是个状态页，能看到每个运行时版本当前会发出去的更新。

### 目录约定

```
C:\backend\updates\<运行时版本>\<时间戳>\
    info.json        这一版有哪些文件、什么时候发的（服务器据此生成 Manifest）
    metadata.json    expo export 的原样产物，用它的哈希算更新 ID
    expoConfig.json  打包时的 Expo 配置（可选，发给客户端的 extra.expoClient）
    files\<md5><后缀>   JS 包和图片本体
C:\backend\apk\
    latest.json      最新安装包信息
    recipe-app-9.1.2.apk
```

资源文件名用的是**内容 md5**，正好也是客户端本地保存时用的名字：内容没变的资源，手机上已经有同名文件，不会重复下载。

### 发布

发布在开发机上做（脚本会自己打包、上传、校验）：

```powershell
# 平时（只改 JS）：版本号自动 9.1.2 → 9.1.3
node work\publish-update.mjs --note "这次改了什么"
# 动了安卓原生时（app.json 的 version / runtimeVersion / versionCode 已手动改成同一个新号，APK 也重新打好了）
node work\publish-update.mjs --apk-only --note "加了新权限" --apk "<新安装包路径>"
```

脚本通过 SSH 密钥 `scp` 上传（不需要开密码登录），传完再模拟手机请求一次
`/updates`，把服务器发出来的每个文件都下一个遍核对哈希，对不上就报错。

> 发布脚本 `work/publish-update.mjs` 未包含在本仓库中（它内含特定部署环境的配置）。
> 如需 OTA 发布，请参照本节自行实现，或改成自己的 CI 流程。

### 版本号怎么算（两个，别混）

| | 字段 | 现在的值 | 什么时候变 |
| --- | --- | --- | --- |
| 版本号 | `app.json` → `version` | `9.1.2` | **每推一次更新都 +1**（发布脚本自动做），面板上显示的就是它 |
| 原生底座 | `app.json` → `runtimeVersion` | `9.1.2`（固定字符串） | **只有重打安装包时才改** |

`runtimeVersion` 会被写进 `AndroidManifest.xml` 的 `EXPO_RUNTIME_VERSION`，客户端靠它判断
「这个更新包适不适合我这台手机」。所以它必须固定住；如果写成 `{policy: "appVersion"}`，
版本号每推一次就跟着涨，老手机就再也收不到 OTA 了——发布脚本会直接拦下这种写法。

`android.versionCode` 跟着版本号走：`大版本×10000 + 中版本×100 + 小版本`（9.1.3 → 90103）。

## 排查

- **打不开**：先看 `logs/server.log`，有没有 `listening on http://0.0.0.0:8080`。
- **外面连不上但本机可以**：云防火墙和 Windows 自带防火墙是两层，都要放行 8080。
- **数据出问题**：`data/data.db` 是完整的数据库，拷出来就能看/恢复。服务停掉再拷最稳妥。
