import type { ShopSummary, SourceError, StudentMode } from '../types';
import {
  CANTEEN_MISSING,
  DEMO_SHOP_LABEL,
  DERIVED_NAME_NOTE,
  EMPTY_SHOP_LIST,
  ORDERABLE_MISSING,
  ORDERABLE_NO,
  ORDERABLE_YES,
  SHOP_CLOSED_REASON,
  SHOP_NAME_MISSING,
  SHOP_SWITCH_BUSY,
} from './shopTexts';

export type ShopListSource = 'server' | 'demo' | 'menu-derived';

export type ShopPickerPhase = 'loading' | 'ready' | 'empty' | 'error' | 'unavailable';

export interface ShopCardView {
  merchantId: string;
  title: string;
  nameNote: string;
  canteenText: string;
  orderableText: string;
  demoLabel: string;
  isCurrent: boolean;
  enterable: boolean;
  disabledReason: string;
  demo: boolean;
}

export interface ShopPickerState {
  phase: ShopPickerPhase;
  cards: ShopCardView[];
  listSource: ShopListSource;
  showDerivedEntry: boolean;
  emptyText: string;
}

export interface DeriveShopCardsOptions {
  currentShopId?: string | null;
  canSetShop?: boolean;
  mode?: StudentMode;
  listSource?: ShopListSource;
}

function compareShops(left: ShopSummary, right: ShopSummary): number {
  const leftOrder = typeof left.sortOrder === 'number' ? left.sortOrder : Number.POSITIVE_INFINITY;
  const rightOrder = typeof right.sortOrder === 'number' ? right.sortOrder : Number.POSITIVE_INFINITY;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return left.merchantId.localeCompare(right.merchantId);
}

export function deriveShopCards(
  shops: ShopSummary[],
  {
    currentShopId = null,
    canSetShop = true,
    mode = 'sample',
    listSource = 'server',
  }: DeriveShopCardsOptions = {},
): ShopCardView[] {
  return shops
    .slice()
    .sort(compareShops)
    .map((shop): ShopCardView => {
      const derived = listSource === 'menu-derived';
      const hasName = shop.name.trim() !== '';
      const title = hasName ? shop.name : SHOP_NAME_MISSING;
      const canteenText = shop.canteenId ? `所属食堂：${shop.canteenId}` : CANTEEN_MISSING;
      const orderableText =
        shop.orderable === true
          ? ORDERABLE_YES
          : shop.orderable === false
            ? ORDERABLE_NO
            : ORDERABLE_MISSING;
      const disabledReason = !canSetShop
        ? SHOP_SWITCH_BUSY
        : shop.orderable === false
          ? SHOP_CLOSED_REASON
          : '';
      return {
        merchantId: shop.merchantId,
        title,
        nameNote: derived ? DERIVED_NAME_NOTE : hasName ? '' : SHOP_NAME_MISSING,
        canteenText,
        orderableText,
        demoLabel: mode === 'sample' && shop.demo ? DEMO_SHOP_LABEL : '',
        isCurrent: currentShopId === shop.merchantId,
        enterable: disabledReason === '',
        disabledReason,
        demo: shop.demo,
      };
    });
}

export interface DeriveShopPickerStateInput extends DeriveShopCardsOptions {
  shops: ShopSummary[];
  loading: boolean;
  error: SourceError | null;
  mode: StudentMode;
}

export function deriveShopPickerState({
  shops,
  loading,
  error,
  mode,
  currentShopId = null,
  canSetShop = true,
  listSource = 'server',
}: DeriveShopPickerStateInput): ShopPickerState {
  const cards = deriveShopCards(shops, { currentShopId, canSetShop, mode, listSource });
  const unavailable = error !== null && error.code === 'SHOP_LIST_UNAVAILABLE';
  const phase: ShopPickerPhase = loading
    ? 'loading'
    : unavailable
      ? 'unavailable'
      : error !== null
        ? 'error'
        : cards.length === 0
          ? 'empty'
          : 'ready';
  return {
    phase,
    cards,
    listSource,
    showDerivedEntry: phase === 'unavailable' && mode === 'real',
    emptyText: EMPTY_SHOP_LIST,
  };
}

export interface StallVisualMeta {
  title: string;
  tag: string;
  photoKey: 'dazhong' | 'fengwei' | 'mianshi';
  photoAlt: string;
}

export function resolveStallVisual(card: ShopCardView, index: number): StallVisualMeta {
  const name = card.title;
  if (/大众|家常/.test(name) || index === 0) {
    return { title: '大众窗口', tag: '家常热菜', photoKey: 'dazhong', photoAlt: '大众窗口·家常热菜档口' };
  }
  if (/小炒|风味/.test(name) || index === 1) {
    return { title: '风味小炒', tag: '现做小炒', photoKey: 'fengwei', photoAlt: '风味小炒·现做小炒档口' };
  }
  if (/面|饺/.test(name) || index === 2) {
    return { title: '面食档', tag: '面食 · 饺子', photoKey: 'mianshi', photoAlt: '面食档·面食饺子档口' };
  }
  return {
    title: name,
    tag: card.demo ? '样例档口' : '校内档口',
    photoKey: index % 3 === 0 ? 'dazhong' : index % 3 === 1 ? 'fengwei' : 'mianshi',
    photoAlt: `${name}档口`,
  };
}
