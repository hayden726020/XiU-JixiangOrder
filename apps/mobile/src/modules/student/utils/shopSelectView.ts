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

export type StallPhotoKey = 'dazhong' | 'fengwei' | 'mianshi';
export type CanteenGroup = '一食堂' | '二食堂' | 'other';

export interface StallVisualMeta {
  title: string;
  tag: string;
  location: string;
  specialties: string;
  statusLabel: string;
  isOpen: boolean;
  featureLabel: string;
  featureKind: 'reservable' | 'popular';
  canteenGroup: CanteenGroup;
  photoKey: StallPhotoKey;
  photoAlt: string;
}

function inferCanteenGroup(card: ShopCardView): CanteenGroup {
  const combined = `${card.title} ${card.canteenText}`;
  if (/二食堂|canteen-02/i.test(combined)) return '二食堂';
  if (/一食堂|canteen-01/i.test(combined)) return '一食堂';
  return 'other';
}

export function resolveStallVisual(
  card: ShopCardView,
  index: number,
  dishNames: string[] = [],
): StallVisualMeta {
  const name = card.title;
  const canteenGroup = inferCanteenGroup(card);
  const isOpen = card.enterable;
  const statusLabel = isOpen ? '营业中' : card.orderableText;
  const dishSummary = dishNames.slice(0, 3).join(' · ');

  if (/面|饺|粉/.test(name)) {
    return {
      title: name,
      tag: '面食 · 饺子',
      location: canteenGroup === '二食堂' ? '二食堂 · 一楼' : '一食堂 · 一楼',
      specialties: card.demo ? '手工拉面 · 经典拌面 · 刀削面' : dishSummary || card.orderableText,
      statusLabel,
      isOpen,
      featureLabel: '支持预约取餐',
      featureKind: 'reservable',
      canteenGroup,
      photoKey: 'mianshi',
      photoAlt: `${name}档口`,
    };
  }
  if (/大众|家常/.test(name)) {
    return {
      title: name,
      tag: '家常热菜',
      location: canteenGroup === '二食堂' ? '二食堂 · 一楼' : '一食堂 · 一楼',
      specialties: card.demo ? '热菜现炒 · 多种套餐 · 经济实惠' : dishSummary || card.orderableText,
      statusLabel,
      isOpen,
      featureLabel: '人气档口',
      featureKind: 'popular',
      canteenGroup,
      photoKey: 'dazhong',
      photoAlt: `${name}档口`,
    };
  }
  if (/小炒|风味/.test(name)) {
    return {
      title: name,
      tag: '现做小炒',
      location: canteenGroup === '二食堂' ? '二食堂 · 二楼' : '一食堂 · 二楼',
      specialties: card.demo ? '现炒盖饭 · 黑椒鸡腿 · 特色小炒' : dishSummary || card.orderableText,
      statusLabel,
      isOpen,
      featureLabel: '支持预约取餐',
      featureKind: 'reservable',
      canteenGroup,
      photoKey: 'fengwei',
      photoAlt: `${name}档口`,
    };
  }
  const fallbackLocation =
    canteenGroup !== 'other'
      ? `${canteenGroup} · 校内档口`
      : card.canteenText.replace(/^所属食堂：/, '') || '校内食堂';
  return {
    title: name,
    tag: card.demo ? '样例档口' : '校内档口',
    location: fallbackLocation,
    specialties: dishSummary || card.orderableText,
    statusLabel,
    isOpen,
    featureLabel: isOpen ? '支持预约取餐' : '暂不可预约',
    featureKind: 'reservable',
    canteenGroup,
    photoKey: index % 3 === 0 ? 'mianshi' : index % 3 === 1 ? 'dazhong' : 'fengwei',
    photoAlt: `${name}档口`,
  };
}
