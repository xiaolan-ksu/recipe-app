import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import { SHARE_BASE_URL } from './share';

/**
 * 云更新。
 *
 * 分两条路：
 * 1. OTA（expo-updates）：只改 JS / 图片这类「界面和逻辑」的改动，手机上直接下载新包，
 *    重启一下就是新版，不用重新装安装包。
 * 2. 安装包升级：改了安卓原生部分（加新权限、换原生模块）时必须重装，
 *    App 自己去服务器把新的 apk 下载下来，再交给系统安装器。
 *
 * 两个「版本」分开看：
 * - 版本号（app.json 的 version，比如 9.1.2）：**每次推更新都 +1**，面板上显示的就是它。
 * - 运行时版本（app.json 的 runtimeVersion，比如 9.1.2）：**只有重打安装包才会变**，
 *   它代表安卓原生部分的那套底座。expo-updates 靠它判断「这个更新包能不能给我装」，
 *   所以它必须固定住——要是跟着版本号一起涨，老手机上就再也收不到 OTA 了。
 */

/** 只有安卓安装包版才走这套；网页预览和开发模式里 expo-updates 是关掉的 */
export const CAN_UPDATE = Platform.OS === 'android' && Updates.isEnabled;

const APK_PACKAGE = 'com.codex.recipeapp';

/** 手机里现在跑的这版 JS 的版本号（来自当前运行的那份配置，OTA 之后就是新版本号） */
export function appVersionOf(): string {
  const fromConfig = Constants.expoConfig?.version;
  if (typeof fromConfig === 'string' && fromConfig.length > 0) return fromConfig;
  // 兜底：直接读当前运行的 manifest
  const manifest = Updates.manifest as
    | { extra?: { expoClient?: { version?: string } } }
    | undefined;
  return manifest?.extra?.expoClient?.version ?? '—';
}

/** 运行时版本 = 原生底座，只有重新打安装包才会变 */
export function runtimeVersionOf(): string {
  return Updates.runtimeVersion || '—';
}

export interface RunningInfo {
  version: string;
  runtimeVersion: string;
  updateId: string | null;
  isEmbedded: boolean;
  createdAt: Date | null;
}

/** 手机里现在跑的是哪一版：内置的那份，还是之前下载过的更新包 */
export function runningInfo(): RunningInfo {
  return {
    version: appVersionOf(),
    runtimeVersion: runtimeVersionOf(),
    updateId: Updates.updateId,
    isEmbedded: Updates.isEmbeddedLaunch,
    createdAt: Updates.createdAt,
  };
}

export type CheckOutcome =
  | { kind: 'ota' }
  | { kind: 'none' }
  | { kind: 'error'; message: string };

/** 问服务器有没有新的 JS 包（只是问，不下载） */
export async function checkOta(): Promise<CheckOutcome> {
  if (!CAN_UPDATE) return { kind: 'none' };
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) return { kind: 'ota' };
    return { kind: 'none' };
  } catch {
    return { kind: 'error', message: '连不上更新服务器，检查一下网络' };
  }
}

/** 把刚发现的新包下载下来（下载完要重启才生效） */
export async function fetchOta(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!CAN_UPDATE) return { ok: false, message: '这个版本不支持云更新' };
  try {
    const result = await Updates.fetchUpdateAsync();
    return result.isNew ? { ok: true } : { ok: false, message: '没拿到新版本，等会儿再试' };
  } catch {
    return { ok: false, message: '下载失败了，检查网络后再试一次' };
  }
}

/** 重启 App，换成刚下载的那份新包 */
export async function restartIntoUpdate(): Promise<void> {
  await Updates.reloadAsync();
}

// ---------- 安装包升级 ----------

export interface ApkRelease {
  available: boolean;
  version: string;
  runtimeVersion: string;
  notes: string;
  url: string;
  size: number;
  publishedAt: string;
}

/**
 * 问服务器上最新的安装包是哪一版。
 *
 * 判据是运行时版本：它一样，说明安卓原生部分没变，光靠 OTA 就够了；
 * 它变了，说明这次改到了原生，必须换安装包。
 */
export async function checkApk(): Promise<ApkRelease | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${SHARE_BASE_URL}/api/app/latest`, { signal: controller.signal });
      if (!response.ok) return null;
      const data = (await response.json()) as Partial<ApkRelease>;
      if (!data || !data.url) return null;
      const release: ApkRelease = {
        available: Boolean(data.available),
        version: String(data.version ?? ''),
        runtimeVersion: String(data.runtimeVersion ?? ''),
        notes: String(data.notes ?? ''),
        url: String(data.url),
        size: Number(data.size ?? 0),
        publishedAt: String(data.publishedAt ?? ''),
      };
      // 服务器上的原生版本和手机里的不一样，才需要重装
      if (!release.runtimeVersion || release.runtimeVersion === runtimeVersionOf()) {
        release.available = false;
      }
      return release;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

export type DownloadOutcome =
  | { ok: true; uri: string }
  | { ok: false; message: string };

/** 把新安装包下到手机的缓存目录（上次下过、大小一样就直接用本地的） */
export async function downloadApk(
  release: ApkRelease,
  onProgress?: (ratio: number) => void,
): Promise<DownloadOutcome> {
  try {
    const target = `${FileSystem.cacheDirectory}recipe-app-${release.version}.apk`;

    const cached = await FileSystem.getInfoAsync(target);
    if (cached.exists && (!release.size || cached.size === release.size)) {
      onProgress?.(1);
      return { ok: true, uri: target };
    }

    // 安装包五十来兆，先看看还剩多少地方，免得下到一半失败
    if (release.size > 0) {
      const free = await FileSystem.getFreeDiskStorageAsync();
      if (free < release.size * 2) {
        return { ok: false, message: '手机存储空间不太够，清一点再试' };
      }
    }

    const resumable = FileSystem.createDownloadResumable(release.url, target, {}, (progress) => {
      const total = progress.totalBytesExpectedToWrite;
      onProgress?.(total > 0 ? progress.totalBytesWritten / total : 0);
    });

    const result = await resumable.downloadAsync();
    if (!result || !result.uri) return { ok: false, message: '下载中断了，等会儿再试' };
    if (release.size > 0) {
      const info = await FileSystem.getInfoAsync(result.uri);
      if (!info.exists || info.size !== release.size) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
        return { ok: false, message: '下载的文件不完整，重来一次' };
      }
    }
    onProgress?.(1);
    return { ok: true, uri: result.uri };
  } catch {
    return { ok: false, message: '下载失败了，检查网络后再试' };
  }
}

/** 把下载好的 apk 交给系统安装器 */
export async function installApk(uri: string): Promise<{ ok: true } | { ok: false; needPermission: boolean }> {
  try {
    const contentUri = await FileSystem.getContentUriAsync(uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      type: 'application/vnd.android.package-archive',
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    });
    return { ok: true };
  } catch {
    // 多半是没开「允许安装未知应用」
    return { ok: false, needPermission: true };
  }
}

/** 跳到本应用的「安装未知应用」设置页 */
export async function openInstallPermissionSettings(): Promise<void> {
  try {
    await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
      data: `package:${APK_PACKAGE}`,
    });
  } catch {
    // 打不开就算了，下面还有文字说明
  }
}

export function formatSize(bytes: number): string {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}
