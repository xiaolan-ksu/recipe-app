import * as Location from 'expo-location';

export interface Coords {
  latitude: number;
  longitude: number;
}

/**
 * 把地址的几段拼成「上海市 · 静安区」这样一句话：
 * 空白的丢掉，重复的（「上海市 · 上海市」）也丢掉，最多留三段。
 */
export function joinParts(parts: (string | null | undefined)[], max = 3): string {
  const kept: string[] = [];
  parts.forEach((part) => {
    const value = (part ?? '').trim();
    if (value.length === 0) return;
    if (kept.some((item) => item === value || item.includes(value) || value.includes(item))) return;
    kept.push(value);
  });
  return kept.slice(0, max).join(' · ');
}

/** 手机自带的地理编码：安卓和苹果有，网页上没有 */
async function fromSystemGeocoder(coords: Coords): Promise<string | null> {
  try {
    const list = await Location.reverseGeocodeAsync(coords);
    const first = list[0];
    if (!first) return null;
    const label = joinParts([
      first.city ?? first.region ?? first.subregion,
      first.district ?? first.subregion,
    ]);
    return label.length > 0 ? label : null;
  } catch {
    return null;
  }
}

/** 兜底：OpenStreetMap 的公开反查接口，不用申请 key */
async function fromOpenStreetMap(coords: Coords): Promise<string | null> {
  try {
    const url =
      'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=zh-CN' +
      `&lat=${coords.latitude}&lon=${coords.longitude}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TodayEatWhat/1.0 (personal recipe app)' },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      address?: Record<string, string | undefined>;
    };
    const address = data.address ?? {};
    const label = joinParts([
      address.city ?? address.town ?? address.county ?? address.state,
      address.city_district ?? address.district ?? address.suburb,
    ]);
    return label.length > 0 ? label : null;
  } catch {
    return null;
  }
}

/** 先试手机自带，再试公开接口；都拿不到就返回 null（界面会退回显示坐标） */
export async function describeCoords(coords: Coords): Promise<string | null> {
  const system = await fromSystemGeocoder(coords);
  if (system) return system;
  return fromOpenStreetMap(coords);
}

/** 拿不到地名时的兜底显示：北纬 31.23 · 东经 121.47 */
export function formatCoords(coords: Coords): string {
  const lat = `${coords.latitude >= 0 ? '北纬' : '南纬'} ${Math.abs(coords.latitude).toFixed(2)}`;
  const lon = `${coords.longitude >= 0 ? '东经' : '西经'} ${Math.abs(coords.longitude).toFixed(2)}`;
  return `${lat} · ${lon}`;
}
