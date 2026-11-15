export const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export function toShanghaiDate(now: Date): string {
  return new Date(now.getTime() + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const start = Date.parse(`${date}T00:00:00+08:00`);
  if (!Number.isFinite(start)) {
    throw new RangeError(`无效的日期：${date}`);
  }
  return toShanghaiDate(new Date(start + days * DAY_MS));
}

export function todayAndTomorrow(now: Date = new Date()): string[] {
  const today = toShanghaiDate(now);
  return [today, addDays(today, 1)];
}

export function isTodayOrTomorrow(date: string, now: Date = new Date()): boolean {
  return todayAndTomorrow(now).includes(date);
}