import type { DiningMode, DraftItemInput } from '../types';

export interface DraftFingerprintInput {
  date: string | null;
  items: DraftItemInput[];
  slotId: string | null;
  diningMode: DiningMode | null;
}

export interface RequestIdKeeper {
  ensure(draft: DraftFingerprintInput): string;
  complete(): void;
  readonly current: string | null;
}

export interface RequestIdKeeperOptions {
  now?: () => number;
  prefix?: string;
}

function normalizeItems(items: DraftItemInput[]): Array<[string, number]> {
  return items
    .filter((item) => Number.isInteger(item.quantity) && item.quantity > 0)
    .slice()
    .sort((a, b) => String(a.dishId).localeCompare(String(b.dishId)))
    .map((item): [string, number] => [item.dishId, item.quantity]);
}

export function buildDraftFingerprint(draft: DraftFingerprintInput): string {
  return JSON.stringify({
    date: draft.date ?? null,
    items: normalizeItems(draft.items ?? []),
    slotId: draft.slotId ?? null,
    diningMode: draft.diningMode ?? null,
  });
}

export function createRequestIdKeeper({
  now = () => Date.now(),
  prefix = 'demo-req',
}: RequestIdKeeperOptions = {}): RequestIdKeeper {
  let seq = 0;
  let currentId: string | null = null;
  let currentFingerprint: string | null = null;

  return {
    ensure(draft: DraftFingerprintInput): string {
      const nextFingerprint = buildDraftFingerprint(draft);
      if (currentId !== null && nextFingerprint === currentFingerprint) {
        return currentId;
      }
      seq += 1;
      currentId = `${prefix}-${now()}-${seq}`;
      currentFingerprint = nextFingerprint;
      return currentId;
    },
    complete(): void {
      currentId = null;
      currentFingerprint = null;
    },
    get current(): string | null {
      return currentId;
    },
  };
}