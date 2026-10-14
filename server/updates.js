'use strict';

/**
 * 云更新（OTA）+ 安卓安装包升级。
 *
 * 目录约定（都在后端根目录下，跟 server.js 同级）：
 *
 *   updates/<运行时版本>/<时间戳>/info.json       发布脚本写的清单：有哪些文件、什么时候发的
 *                                    /metadata.json  expo export 的原样产物（用来算更新 ID）
 *                                    /expoConfig.json 打包时的 Expo 配置（可选）
 *                                    /files/<名字>     JS 包和图片资源本体
 *
 *   apk/latest.json                                最新安装包的信息（版本号、文件名、大小、sha256）
 *   apk/<名字>.apk                                 安装包本体（文件名用纯英文，省得中文进 URL）
 *
 * 手机里的 expo-updates 客户端会带着 expo-platform / expo-runtime-version 来请求 /updates，
 * 我们把最新的一份更新按 Manifest 格式回给它；已经是最新的就回 204，客户端什么都不做。
 * 具体格式见 https://docs.expo.dev/technical-specs/expo-updates-1/
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const UPDATES_DIR = path.join(__dirname, 'updates');
const APK_DIR = path.join(__dirname, 'apk');

/** 更新 ID / 资源哈希都按文件内容算，算一次就缓存，别每次请求都读一遍几兆的包 */
const metaCache = new Map();

/** runtimeVersion 来自请求头，必须卡死格式，不然能被拼出 ../ 来读别的文件 */
const SAFE_SEGMENT = /^[A-Za-z0-9._-]{1,64}$/;

function safeSegment(value) {
  return typeof value === 'string' && SAFE_SEGMENT.test(value) ? value : null;
}

function readJson(file) {
  try {
    // 有些工具写出来的 JSON 会带 BOM，直接 JSON.parse 会炸
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

/** 找到某个运行时版本下最新的那份更新 */
function latestUpdateDir(runtimeVersion) {
  const root = path.join(UPDATES_DIR, runtimeVersion);
  let names;
  try {
    names = fs.readdirSync(root);
  } catch {
    return null;
  }
  const stamps = names
    .filter((name) => /^\d{6,20}$/.test(name))
    .sort((a, b) => Number(b) - Number(a));
  for (const stamp of stamps) {
    const dir = path.join(root, stamp);
    const info = readJson(path.join(dir, 'info.json'));
    if (info && info.id) return { dir, stamp, info };
  }
  return null;
}

/** 列出所有已发布的运行时版本（给浏览器里那个状态页用） */
function listRuntimeVersions() {
  try {
    return fs
      .readdirSync(UPDATES_DIR)
      .filter((name) => safeSegment(name) && fs.statSync(path.join(UPDATES_DIR, name)).isDirectory())
      .sort();
  } catch {
    return [];
  }
}

/** 算一个资源文件的 md5（客户端拿它当保存的文件名）和 base64url 的 sha256（客户端拿它校验） */
function fileMeta(dir, name) {
  const full = path.join(dir, 'files', name);
  const stat = fs.statSync(full);
  const cached = metaCache.get(full);
  if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) return cached;

  const buffer = fs.readFileSync(full);
  const entry = {
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    key: crypto.createHash('md5').update(buffer).digest('hex'),
    hash: crypto.createHash('sha256').update(buffer).digest('base64url'),
  };
  metaCache.set(full, entry);
  return entry;
}

function baseUrlOf(req) {
  // 反代后面时 req.protocol / Host 未必等于外面看到的。配了 PUBLIC_ORIGIN
  // （例如 https://api.example.com）就一律用它，这是最不容易出错的做法。
  const fixed = (process.env.PUBLIC_ORIGIN || '').trim().replace(/\/+$/, '');
  if (fixed) return fixed;
  return `${req.protocol}://${req.get('host')}`;
}

function fileUrl(req, runtimeVersion, stamp, name) {
  return `${baseUrlOf(req)}/updates/files/${encodeURIComponent(runtimeVersion)}/${stamp}/${encodeURIComponent(name)}`;
}

/** 把 info.json 变成客户端认的 Manifest */
function buildManifest(req, runtimeVersion, found) {
  const { dir, stamp, info } = found;
  const launch = info.launch;
  const launchMeta = fileMeta(dir, launch.file);

  const assets = (info.assets || []).map((asset) => {
    const meta = fileMeta(dir, asset.file);
    return {
      hash: meta.hash,
      key: meta.key,
      contentType: asset.contentType || 'application/octet-stream',
      // 客户端拿这个后缀给文件命名，缺了会直接报错，所以空也补成空字符串
      fileExtension: asset.fileExtension || '',
      url: fileUrl(req, runtimeVersion, stamp, asset.file),
    };
  });

  const expoConfig = readJson(path.join(dir, 'expoConfig.json'));

  return {
    id: info.id,
    createdAt: info.createdAt,
    runtimeVersion,
    launchAsset: {
      hash: launchMeta.hash,
      key: launchMeta.key,
      contentType: launch.contentType || 'application/javascript',
      url: fileUrl(req, runtimeVersion, stamp, launch.file),
    },
    assets,
    metadata: {},
    extra: {
      scopeKey: info.scopeKey || baseUrlOf(req),
      ...(expoConfig ? { expoClient: expoConfig } : {}),
    },
  };
}

/** 没更新可发时统一回 204：客户端看到 expo-protocol-version 才会当「没有更新」而不是报错 */
function sendNoUpdate(res) {
  res.setHeader('expo-protocol-version', '1');
  res.setHeader('expo-sfv-version', '0');
  res.setHeader('cache-control', 'private, max-age=0');
  res.status(204).end();
}

function sendManifest(req, res, runtimeVersion) {
  const found = latestUpdateDir(runtimeVersion);
  if (!found) {
    res.setHeader('expo-manifest-filters', '');
    sendNoUpdate(res);
    return;
  }

  // 手机上跑的已经是这一版，就什么都不用干
  const currentId = req.get('expo-current-update-id');
  if (currentId && currentId === found.info.id) {
    sendNoUpdate(res);
    return;
  }

  const manifest = buildManifest(req, runtimeVersion, found);
  res.setHeader('expo-protocol-version', '1');
  res.setHeader('expo-sfv-version', '0');
  res.setHeader('expo-manifest-filters', '');
  res.setHeader('cache-control', 'private, max-age=0');
  res.type('application/expo+json').send(JSON.stringify(manifest));
}

/** 浏览器直接打开 /updates 时给个能看懂的状态页 */
function sendStatusPage(res) {
  const runtimes = listRuntimeVersions();
  const rows = runtimes
    .map((rv) => {
      const found = latestUpdateDir(rv);
      const when = found ? new Date(found.info.createdAt).toLocaleString('zh-CN') : '—';
      const note = found && found.info.note ? found.info.note : '';
      const id = found ? found.info.id.slice(0, 8) : '—';
      return `<tr><td><code>${rv}</code></td><td>${when}</td><td>${id}</td><td>${note}</td></tr>`;
    })
    .join('');
  const apk = readJson(path.join(APK_DIR, 'latest.json'));

  res.type('html').send(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>云更新状态</title>
<style>body{font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif;max-width:760px;margin:48px auto;padding:0 20px;color:#2E2622;line-height:1.7}
h1{font-size:22px}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border-bottom:1px solid #EDE3D8;padding:8px 6px;text-align:left;font-size:14px}
code{background:#f3efe9;padding:2px 6px;border-radius:6px}.ok{color:#3f8f3f;font-weight:700}</style></head>
<body><h1>云更新状态</h1>
<p class="ok">服务正在运行。</p>
<p>手机上的 App 会带着 <code>expo-runtime-version</code> 请求 <code>/updates</code>，这里列出每个运行时版本当前会发出去的更新。</p>
<table><tr><th>运行时版本</th><th>发布时间</th><th>更新 ID</th><th>说明</th></tr>${rows || '<tr><td colspan="4">还没有发布过更新</td></tr>'}</table>
<p>安装包：${
    apk
      ? `v${apk.version}${apk.versionCode ? `（versionCode ${apk.versionCode}）` : ''} · <a href="/download/${encodeURIComponent(apk.file)}">下载</a>`
              : '还没有上传过'
  }</p>
<p><a href="/">回后端首页</a></p>
</body></html>`);
}

function handleManifestRequest(req, res, log) {
  const platform = req.get('expo-platform') || req.query.platform;
  const runtimeVersionRaw = req.get('expo-runtime-version') || req.query['runtime-version'];

  // 浏览器打开：给状态页
  if (!platform && !runtimeVersionRaw) {
    sendStatusPage(res);
    return;
  }
  if (platform && platform !== 'android') {
    log(`update check ignored for platform ${platform}`);
    sendNoUpdate(res);
    return;
  }
  const runtimeVersion = safeSegment(runtimeVersionRaw);
  if (!runtimeVersion) {
    res.status(400).json({ error: 'bad_request', message: '缺少或不合法的 expo-runtime-version' });
    return;
  }

  try {
    sendManifest(req, res, runtimeVersion);
  } catch (error) {
    log(`manifest failed for runtime ${runtimeVersion}: ${error && error.stack ? error.stack : error}`);
    res.status(500).json({ error: 'server_error', message: '生成更新清单失败' });
  }
}

function handleFileRequest(req, res) {
  const runtimeVersion = safeSegment(req.params.runtime);
  const stamp = safeSegment(req.params.stamp);
  const name = safeSegment(req.params.name);
  if (!runtimeVersion || !stamp || !name) {
    res.status(400).json({ error: 'bad_request' });
    return;
  }

  const full = path.join(UPDATES_DIR, runtimeVersion, stamp, 'files', name);
  const root = path.join(UPDATES_DIR, runtimeVersion, stamp, 'files');
  // 双保险：拼出来的路径必须还在这个更新目录里
  if (!path.resolve(full).startsWith(path.resolve(root) + path.sep)) {
    res.status(400).json({ error: 'bad_request' });
    return;
  }
  if (!fs.existsSync(full)) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  // 更新目录按时间戳分家，同一个 URL 的内容永远不变，可以放心长缓存
  res.setHeader('cache-control', 'public, max-age=31536000, immutable');
  res.sendFile(full);
}

function handleLatestApp(req, res) {
  const latest = readJson(path.join(APK_DIR, 'latest.json'));
  if (!latest || !latest.file) {
    res.json({ available: false });
    return;
  }
  const asking = Number(req.query.versionCode);
  const latestCode = Number(latest.versionCode);
  // 客户端没报版本号、或者这份信息里本来就没有版本号时，一律按「有更新」处理更安全
  const available =
    Number.isFinite(asking) && Number.isFinite(latestCode) ? asking < latestCode : true;
  res.setHeader('cache-control', 'no-store');
  res.json({
    available,
    version: latest.version,
    versionCode: latest.versionCode,
    runtimeVersion: latest.runtimeVersion || '',
    notes: latest.notes || '',
    publishedAt: latest.publishedAt || '',
    size: latest.size || 0,
    sha256: latest.sha256 || '',
    url: `${baseUrlOf(req)}/download/${encodeURIComponent(latest.file)}`,
  });
}

function handleDownload(req, res) {
  const name = safeSegment(req.params.name);
  if (!name) {
    res.status(400).json({ error: 'bad_request' });
    return;
  }
  const full = path.join(APK_DIR, name);
  if (!fs.existsSync(full)) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.setHeader('content-type', 'application/vnd.android.package-archive');
  res.setHeader('cache-control', 'no-store');
  res.sendFile(full);
}

/** 挂到主服务上。放在兜底 404 之前调用 */
function attach(app, log) {
  fs.mkdirSync(UPDATES_DIR, { recursive: true });
  fs.mkdirSync(APK_DIR, { recursive: true });

  app.get(['/updates', '/updates/', '/updates/manifest'], (req, res) => {
    handleManifestRequest(req, res, log);
  });

  app.get('/updates/files/:runtime/:stamp/:name', handleFileRequest);

  app.get('/api/app/latest', handleLatestApp);
  app.get('/download/:name', handleDownload);
}

module.exports = { attach, UPDATES_DIR, APK_DIR };
