export function isFutureSlotStart(slotStart: string, now: number = Date.now()): boolean {
  const start = Date.parse(slotStart);
  return Number.isFinite(start) && start > now;
}
