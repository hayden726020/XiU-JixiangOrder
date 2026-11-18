import type { MenuResponse, ShopSummary, StudentOrder, StudentSource } from '../types';

interface SourceCacheEntry {
  shops: ShopSummary[] | null;
  menusByDate: Map<string, MenuResponse>;
  orders: StudentOrder[] | null;
}

// Keyed by StudentSource instance so caches are isolated per session/mode and across unit tests.
const cacheBySource = new WeakMap<StudentSource, SourceCacheEntry>();

function entryOf(source: StudentSource): SourceCacheEntry {
  let entry = cacheBySource.get(source);
  if (!entry) {
    entry = {
      shops: null,
      menusByDate: new Map(),
      orders: null,
    };
    cacheBySource.set(source, entry);
  }
  return entry;
}

export function getCachedShops(source: StudentSource): ShopSummary[] | null {
  return entryOf(source).shops;
}

export function setCachedShops(source: StudentSource, shops: ShopSummary[]): void {
  entryOf(source).shops = shops;
}

export function getCachedMenu(source: StudentSource, date: string): MenuResponse | null {
  return entryOf(source).menusByDate.get(date) ?? null;
}

export function setCachedMenu(source: StudentSource, date: string, menu: MenuResponse): void {
  entryOf(source).menusByDate.set(date, menu);
}

export function getCachedOrders(source: StudentSource): StudentOrder[] | null {
  return entryOf(source).orders;
}

export function setCachedOrders(source: StudentSource, orders: StudentOrder[]): void {
  entryOf(source).orders = orders;
}
