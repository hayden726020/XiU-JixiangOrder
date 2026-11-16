export interface MenuDateOption {
  date: string;
  label: string;
  isToday: boolean;
}

const DAY_MS = 86_400_000;

export function todayIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayOffset(date: string, today: string): number {
  const target = Date.parse(`${date}T00:00:00Z`);
  const base = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(target) || Number.isNaN(base)) return Number.NaN;
  return Math.round((target - base) / DAY_MS);
}

export function menuDateLabel(date: string, today: string): string {
  const offset = dayOffset(date, today);
  if (offset === 0) return `今天 ${date}`;
  if (offset === 1) return `明天 ${date}`;
  if (offset === -1) return `昨天 ${date}`;
  return date;
}

export function menuDateOptions(
  dates: ReadonlyArray<string>,
  today: string,
): MenuDateOption[] {
  return dates.map((date) => ({
    date,
    label: menuDateLabel(date, today),
    isToday: date === today,
  }));
}

export function resolveMenuDate(dates: ReadonlyArray<string>, today: string): string {
  return dates.includes(today) ? today : dates[0] ?? today;
}
export function addDaysIso(date: string, days: number): string {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed)) return date;
  return new Date(parsed + days * DAY_MS).toISOString().slice(0, 10);
}

export function menuDatesFor(today: string): string[] {
  return [today, addDaysIso(today, 1)];
}