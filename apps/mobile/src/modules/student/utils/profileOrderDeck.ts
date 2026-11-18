import type { StudentOrder } from '../types';

// Values from DesignBookmark Motion Studies, shared/tokens.css and deck.js.
export const DECK_SPRINGS = {
  follow: [900, 50],
  return: [280, 16],
  depth: [260, 22],
  fly: [70, 17],
} as const;

export interface DeckSpring {
  x: number;
  v: number;
  t: number;
  k: number;
  c: number;
}

export function stepDeckSpring(spring: DeckSpring, dt: number): void {
  const acceleration = -spring.k * (spring.x - spring.t) - spring.c * spring.v;
  spring.v += acceleration * dt;
  spring.x += spring.v * dt;
}

export function activeOrdersForDeck<T extends Pick<StudentOrder, 'status' | 'createdAt'>>(orders: T[]): T[] {
  const priority: Record<StudentOrder['status'], number> = {
    READY: 4,
    PREPARING: 3,
    ACCEPTED: 2,
    NEW: 1,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  return orders
    .filter((order) => priority[order.status] > 0)
    .sort((a, b) =>
      priority[b.status] - priority[a.status]
      || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
