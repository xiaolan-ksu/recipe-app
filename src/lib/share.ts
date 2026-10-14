import * as FileSystem from 'expo-file-system/legacy';

import type { DishIngredient } from '../types';
import type { ShoppingItem } from '../types';

/**
 * 共享清单的后端接口。
 *
 * 两个人各自在自己手机上改，改动以「操作」的形式提交给服务器，
 * 由服务器合并（比如两人同时加同一样菜，数量会累加），再各自拉回最新状态。
 */
// 后端地址。默认值保持现在的 IP 不变，老安装包不受影响；
// 要切到域名时在构建前设环境变量即可，不用改代码：
//   EXPO_PUBLIC_API_BASE=https://你的域名
export const SHARE_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE || 'http://YOUR_SERVER_IP:8080'
).replace(/\/+$/, '');

/** 提交一批改动时带的编号，服务器用它去重（防止响应丢了以后重发导致数量翻倍） */
export type ShareBatchId = string;

export type ShareOp =
  | { kind: 'shopping'; action: 'addAmount'; item: ShoppingItem }
  | { kind: 'shopping'; action: 'patch'; id: string; patch: Partial<Pick<ShoppingItem, 'checked' | 'amount' | 'price' | 'name' | 'unit' | 'group'>> }
  | { kind: 'shopping'; action: 'remove'; id: string }
  | { kind: 'shopping'; action: 'clearChecked' }
  | { kind: 'shopping'; action: 'clearAll' }
  | { kind: 'pantry'; action: 'add'; names: string[]; expiry?: Record<string, string> }
  | { kind: 'pantry'; action: 'remove'; name: string }
  | { kind: 'pantry'; action: 'setExpiry'; name: string; date: string }
  | { kind: 'pantry'; action: 'clearAll' }
  | { kind: 'dish'; action: 'upsert'; dish: SharedDish }
  | { kind: 'dish'; action: 'remove'; id: string };

/**
 * 传到服务器上的「自己加的菜」。
 *
 * 照片不走这里：图片用 `uploadDishPhoto()` 单独传，服务器按菜的 id 存一份，
 * 这里只记「有没有照片」，对方那边按 `hasPhoto` 去取图。
 */
export interface SharedDish {
  id: string;
  name: string;
  category: string;
  tagline?: string;
  description?: string;
  tags: string[];
  costYuan: number;
  minutes: number;
  difficulty: string;
  popularity?: number;
  baseServings: number;
  ingredients: DishIngredient[];
  steps: { text: string; tip?: string }[];
  tips: string[];
  hasPhoto?: boolean;
  createdAt?: string;
}

export interface ShareState {
  rev: number;
  shopping: ShoppingItem[];
  pantry: string[];
  pantryExpiry: Record<string, string>;
  /** 两个人共用的「自己加的菜」 */
  dishes?: SharedDish[];
}

export interface ShareSession {
  familyId: string;
  token: string;
}

export interface ShareResult {
  ok: true;
  value: ShareState | { unchanged: true; rev: number } | ShareSession | { code: string };
}

const TIMEOUT_MS = 10000;

async function request<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${SHARE_BASE_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    const data = text.length > 0 ? JSON.parse(text) : {};

    // 有些浏览器会把「没变化」的 304 直接丢给 JS（没有响应体），
    // 这不算错误，交给上层当成「和上次一样」处理
    if (response.status === 304) {
      throw Object.assign(new Error('not modified'), { code: 'not_modified' });
    }

    if (!response.ok) {
      const code = typeof data.error === 'string' ? data.error : `http_${response.status}`;
      throw Object.assign(new Error(data.message || code), { code });
    }

    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

/** 新生成一个批次号（服务器靠它去重） */
export function newBatchId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const createFamily = (): Promise<ShareSession & { code: string }> =>
  request<ShareSession & { code: string }>('/api/family/create', {});

export const joinFamily = (code: string): Promise<ShareSession> =>
  request<ShareSession>('/api/family/join', { code });

export const issueCode = (token: string): Promise<{ code: string }> =>
  request<{ code: string }>('/api/family/code', {}, token);

export const fetchState = (token: string, since?: number): Promise<ShareState | { unchanged: true; rev: number }> =>
  request<ShareState | { unchanged: true; rev: number }>(
    `/api/state${typeof since === 'number' ? `?since=${since}` : ''}`,
    undefined,
    token,
  );

/** 提交一批改动，返回合并后的最新状态 */
export const postOps = (token: string, ops: ShareOp[], batchId: ShareBatchId): Promise<ShareState> =>
  request<ShareState>('/api/ops', { ops, batchId }, token);

/** 这道菜的照片在服务器上的地址（手机上 expo-image 直接按这个 URL 取图） */
export function dishPhotoUrl(dishId: string, token: string): string {
  return `${SHARE_BASE_URL}/api/dish/photo?dish=${encodeURIComponent(dishId)}&token=${encodeURIComponent(token)}`;
}

/**
 * 把自己加的菜的照片传上去（原图字节，不转码）。
 * 传成功再告诉服务器「这道菜有图」，失败了就只共享文字部分，对方看到的是渐变占位图。
 */
export async function uploadDishPhoto(token: string, dishId: string, fileUri: string): Promise<boolean> {
  try {
    const result = await FileSystem.uploadAsync(
      `${SHARE_BASE_URL}/api/dish/photo?dish=${encodeURIComponent(dishId)}`,
      fileUri,
      {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return result.status >= 200 && result.status < 300;
  } catch {
    return false;
  }
}

/** 判断拉回来的状态是不是「没变化」 */
export const isUnchanged = (
  value: ShareState | { unchanged: true; rev: number },
): value is { unchanged: true; rev: number } =>
  (value as { unchanged?: boolean }).unchanged === true;
