import { createRequestId } from '../../../shared/requestId';
import type { DiningMode, DraftItemInput, StudentMode } from '../types';

const SAMPLE_PREFIX = 'demo-req';
const REAL_PREFIX = 'stu-req';

/**
 * 实际 id 只由 shared createRequestId 生成；本函数只决定前缀。
 */
export function requestIdPrefixOf(mode: StudentMode): string {
  return mode === 'real' ? REAL_PREFIX : SAMPLE_PREFIX;
}

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
  prefix = 'demo-req',
}: RequestIdKeeperOptions = {}): RequestIdKeeper {
  let currentId: string | null = null;
  let currentFingerprint: string | null = null;

  return {
    ensure(draft: DraftFingerprintInput): string {
      const nextFingerprint = buildDraftFingerprint(draft);
      if (currentId !== null && nextFingerprint === currentFingerprint) {
        return currentId;
      }
      // 实际请求号只由 shared 生成；本模块只决定何时复用或重置。
      currentId = createRequestId(prefix);
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