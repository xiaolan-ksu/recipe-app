# 后端 HTTPS 改造说明（面向微信小程序要求）

> 生成：码小序 · 2026-10-13
> ⚠️ 平台规则以微信官方最新文档为准，本文涉及规则的表述请办理前核对官方原文。

---

## 一、先说结论

**代码这边已经改好了。但域名和 ICP 备案是代码解决不了的，而这两样恰好是最长的一段。**

代码改完的效果：域名一到手，**配置一下就能切，不用再改代码**。

---

## 二、微信的硬性要求 vs 你的现状

| 微信要求 | 现状 | 差距 |
|---|---|---|
| 必须 HTTPS | 明文 HTTP | 等域名 + 证书 |
| TLS ≥ 1.2 | — | 配上 Nginx 即是 |
| **必须是域名，不能用 IP** | 裸 IP `YOUR_SERVER_IP` | **要买域名** |
| **域名必须完成 ICP 备案** | 未备案 | **周期最长，通常 1–3 周** |
| **不能带端口号** | `:8080` | **必须落到 443**，用 Nginx 反代 |
| 证书必须完整链、不能自签 | — | 宝塔 Let's Encrypt 免费证书即可 |
| 域名不能含下划线 | — | 买域名时避开 |

---

## 三、只有你能办的两件事（建议今天就动）

### 1. 买域名 —— 建议在**腾讯云**买

`YOUR_SERVER_IP` 查下来是**腾讯云广州**（AS45090）。ICP 备案必须通过**服务器接入商**提交，
域名也在腾讯云买，备案流程最顺，不折腾。

### 2. 提交 ICP 备案 —— 现在就去

- **周期：通常 1–3 周**（各省通管局不同）
- ⚠️ **备案主体必须和小程序注册主体一致**。小程序用个人主体注册，域名就得个人备案；
  用企业主体注册，域名就得企业备案。**主体不一致会被驳回**，这条最容易栽。
- ⚠️ 域名里**不能有下划线**，微信不认
- ⚠️ 备案期间可以在开发者工具里勾「不校验合法域名、web-view、TLS 版本以及 HTTPS 证书」继续开发，
  **但真机预览和体验版不受这个开关影响，一律走真实校验**

---

## 四、本次代码改了什么（4 处）

| 文件 | 改动 | 为什么 |
|---|---|---|
| `server/app.js` | 新增 `app.set('trust proxy', 1)`（环境变量 `TRUST_PROXY=0` 可关） | 挂到 Nginx 后，`req.ip` 会变成 `127.0.0.1` —— **家庭码限流会从"每个 IP 20 次"退化成"全局限 20 次"**；`req.protocol` 也会变 http |
| `server/app.js` | 新增 `/:文件名.txt` 校验文件路由，新建 `server/wechat-verify/` 目录 | 微信添加服务器域名要求放校验文件且能直读；这样丢个文件进去就行，不必改 Nginx |
| `server/updates.js` | `baseUrlOf()` 改为优先读环境变量 `PUBLIC_ORIGIN` | 它要把更新包 / 安装包地址发回给 App，反代后面靠请求头推断容易被代理头坑到 |
| `src/lib/share.ts` | 后端地址改为可配置（`EXPO_PUBLIC_API_BASE`），**默认值保持原样** | 切域名不用改代码；默认值不变 = 老安装包行为不受影响 |
| （新增） | `server/nginx-https.conf.example` | 443 反代配置模板，直接抄 |

> 这几处改动**都是向后兼容的**：不设环境变量、不起 Nginx 时，行为和现在完全一致。所以可以放心部署。

---

## 五、拿到域名之后的步骤

1. **解析**：域名 A 记录 → `YOUR_SERVER_IP`
2. **宝塔**：添加站点（域名只填域名，不建库不建 FTP）→ SSL 申请 Let's Encrypt → 打开「强制 HTTPS」
3. **覆盖配置**：用 `nginx-https.conf.example` 里的 `location /` 段替换站点默认配置
4. **放行 443**：云安全组**和** Windows 自带防火墙都要放行（现在开的是 8080 / 8888 / 3389 等，443 大概率没开）
5. **给 Node 配环境变量并重启**：
   ```
   PUBLIC_ORIGIN=https://你的域名
   TRUST_PROXY=1
   ```
   重启命令（服务器上以管理员执行）：
   ```powershell
   schtasks /end /tn BackendNodeService
   schtasks /run /tn BackendNodeService
   ```
6. **小程序后台配置域名**：开发管理 → 开发设置 → 服务器域名
   - `request` 合法域名：`https://你的域名`
   - `downloadFile` 合法域名：同一个域名（菜品照片用 `<image>` 加载网络图，建议一并配上；**是否必需以官方最新说明为准**）
   - 按微信提示下载校验文件，丢进服务器 `C:\backend\wechat-verify\`
7. **客户端切地址**：构建前设 `EXPO_PUBLIC_API_BASE=https://你的域名`

---

## 六、⚠️ 8080 端口必须继续开着

老安装包（现在两台手机上那个）把 `http://YOUR_SERVER_IP:8080` **编译进了原生 AndroidManifest**
（`EXPO_UPDATES_URL`）。这是**原生配置，改它必须重新打包 APK 并让手机重新安装**，OTA 推不动。

所以过渡期两个入口要同时活着：

| 入口 | 给谁用 | 什么时候能关 |
|---|---|---|
| `http://YOUR_SERVER_IP:8080` | 老安装包的 OTA 和共享清单 | 两台手机都换上新 APK 之后 |
| `https://你的域名` | 小程序 + 后续新 APK | 长期保留 |

> 本次改动**没有动监听端口**，就是为了让老的 8080 继续服务。

---

## 七、验证清单（切完之后逐条跑）

```bash
# 1. 证书链是否完整 —— 看输出里 Certificate chain 有没有中间证书
openssl s_client -connect 你的域名:443 -servername 你的域名 </dev/null | openssl x509 -noout -subject -dates

# 2. 走的是不是 TLS 1.2+（应打印 Protocol : TLSv1.2）
openssl s_client -connect 你的域名:443 -servername 你的域名 -tls1_2 </dev/null 2>&1 | grep -i "protocol"

# 3. 接口通不通 —— 应返回 {"service":"recipe-share","status":"running",...}
curl -sS https://你的域名/api/health

# 4. 校验文件能直读（不能是 301/302 跳转）
curl -sSI https://你的域名/xxxxxxxx.txt

# 5. 老入口没被弄坏 —— 应返回同样的健康检查结果
curl -sS http://YOUR_SERVER_IP:8080/api/health
```

---

## 八、官方文档

- 小程序网络能力说明：https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html
- 服务器域名配置入口：mp.weixin.qq.com → 开发管理 → 开发设置 → 服务器域名
- 腾讯云备案控制台：https://console.cloud.tencent.com/beian
