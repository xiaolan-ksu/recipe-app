import type { CookingLog } from '../types';

/** 从候选里随机挑一个，尽量避免连着重复 */
export function pickRandom<T>(list: T[], exclude: (item: T) => boolean = () => false): T | null {
  const pool = list.filter((item) => !exclude(item));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 连续做饭天数：从今天往前数，只要那一天有做饭记录就继续，断了就停。
 */
export function calcStreak(logs: CookingLog[], today: string): number {
  const days = new Set(logs.map((log) => log.date));
  let streak = 0;
  const cursor = new Date(`${today}T00:00:00`);
  while (days.has(formatDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today(): string {
  return formatDate(new Date());
}

/** 用量按家里人数换算 */
export function scaleAmount(amount: number, baseServings: number, familySize: number): number {
  const scaled = (amount * familySize) / baseServings;
  if (scaled >= 100) return Math.round(scaled / 10) * 10;
  if (scaled >= 10) return Math.round(scaled);
  return Math.round(scaled * 10) / 10;
}

export function formatAmount(amount: number): string {
  return Number.isInteger(amount) ? `${amount}` : amount.toFixed(1).replace(/\.0$/, '');
}

/** 数量文案：0 表示「适量」这种没写具体量的，只显示单位 */
export function formatQuantity(amount: number, unit: string): string {
  return amount > 0 ? `${formatAmount(amount)} ${unit}` : unit;
}
