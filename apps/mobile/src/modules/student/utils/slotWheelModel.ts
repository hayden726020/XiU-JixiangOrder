// Match Kokonut UI's 0.32-second velocity projection before snapping.
export function getWheelTarget(position: number, velocity: number, count: number): number {
  return Math.min(Math.max(Math.round(position + velocity * 0.32), 0), count - 1);
}
