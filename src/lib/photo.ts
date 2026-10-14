import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export type PhotoSource = 'library' | 'camera';

export type PickPhotoResult =
  | { ok: true; uri: string }
  | { ok: false; reason: 'denied' | 'canceled' };

/** 从相册或相机取一张照片，统一处理权限和「用户取消」 */
export async function pickPhoto(
  source: PhotoSource,
  options?: { aspect?: [number, number]; quality?: number },
): Promise<PickPhotoResult> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync().catch(() => null)
      : await ImagePicker.requestMediaLibraryPermissionsAsync().catch(() => null);

  if (!permission?.granted) return { ok: false, reason: 'denied' };

  const aspect = options?.aspect;
  const quality = options?.quality ?? 0.8;

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality,
          ...(aspect ? { aspect } : {}),
        }).catch(() => null)
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality,
          ...(aspect ? { aspect } : {}),
        }).catch(() => null);

  const uri = result && !result.canceled ? result.assets?.[0]?.uri : undefined;
  return uri ? { ok: true, uri } : { ok: false, reason: 'canceled' };
}

function extensionOf(uri: string): string {
  const match = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(uri);
  return match ? match[1].toLowerCase() : 'jpg';
}

/**
 * 把相册/相机选来的照片存进 App 自己的目录（同名只留最新一张）。
 * 相册给的是系统缓存路径，不搬一次的话过阵子会被系统清掉，图就白了。
 */
export async function persistPhoto(sourceUri: string, folder: string, baseName: string): Promise<string> {
  try {
    if (!sourceUri.startsWith('file://')) return sourceUri;

    const dir = new Directory(Paths.document, folder);
    if (!dir.exists) dir.create({ intermediates: true });

    dir.list().forEach((entry) => {
      if (entry instanceof File && entry.name.startsWith(`${baseName}.`)) entry.delete();
    });

    const target = new File(dir, `${baseName}.${extensionOf(sourceUri)}`);
    await new File(sourceUri).copy(target);
    return target.uri;
  } catch {
    // 存不下就先用原始路径，至少这次能看到图
    return sourceUri;
  }
}
