import type {
  CreateOrderInput,
  DiningMode,
  DishDto,
  DraftItemInput,
  SourceError,
  StudentOrder,
  StudentSource,
} from '../types';
import { apiError, isApiError, toSourceError } from '../types';
import { sumFen } from '../utils/money';
import { DISH_LIMIT_TEXT, DISH_SHORTAGE_NOTICE } from '../utils/submitTexts';
import { SHOP_FOREIGN_ITEM_NOTICE, SHOP_SWITCH_NOTICE } from '../utils/shopTexts';
import { filterDishesByShop } from '../utils/dishShopFilter';
import { createRequestIdKeeper, requestIdPrefixOf, type RequestIdKeeper } from '../utils/requestId';
import type { DraftSelection } from './draftSnapshot';

const MODES = new Set<DiningMode>(['DINE_IN', 'TAKEAWAY']);
const SAMPLE_DATE_LIST = ['2026-11-13', '2026-11-14'];

export type DraftStatus = 'idle' | 'submitting' | 'success' | 'timeout' | 'error';

export type SetShopReason = 'applied' | 'same-shop' | 'busy' | 'invalid';

export interface SetShopResult {
  ok: boolean;
  changed: boolean;
  reason: SetShopReason;
}

export interface DraftState {
  date: string;
  shopId: string | null;
  slotId: string | null;
  diningMode: DiningMode | null;
  status: DraftStatus;
  order: StudentOrder | null;
  error: SourceError | null;
  notice: string | null;
}

export interface DraftSnapshot extends DraftState {
  allowedDates: string[];
  items: DraftItemInput[];
  totalQuantity: number;
  previewFen: number;
  canProceedToSlot: boolean;
  canConfirm: boolean;
  canSwitchShop: boolean;
  hasForeignItem: boolean;
  requestId: string | null;
}

export interface OrderDraftOptions {
  source: StudentSource;
  requestIds?: RequestIdKeeper;
  allowedDates?: string[];
  initialDate?: string;
  onChange?: (snapshot: DraftSnapshot) => void;
}

export interface OrderDraft {
  getState(): DraftSnapshot;
  getShopId(): string | null;
  canSetShop(): boolean;
  setShop(merchantId: string): SetShopResult;
  beginMenuRead(): number;
  isMenuReadCurrent(token: number): boolean;
  setDate(date: string): boolean;
  setQuantity(dish: DishDto, quantity: number): number;
  getLimit(dishId: string): number;
  setSlot(slotId: string): void;
  setDiningMode(mode: DiningMode): void;
  applyDishCatalog(dishes: DishDto[]): void;
  restoreSelection(selection: DraftSelection): boolean;
  canProceedToSlot(): boolean;
  canConfirm(): boolean;
  buildInput(): CreateOrderInput;
  submit(): Promise<StudentOrder | null>;
  queryResult(): Promise<StudentOrder>;
  resetSubmission(): void;
  startNewOrder(): void;
}

export function createOrderDraft({
  source,
  requestIds = createRequestIdKeeper({ prefix: requestIdPrefixOf(source.mode) }),
  allowedDates,
  initialDate,
  onChange,
}: OrderDraftOptions): OrderDraft {
  const dateList = allowedDates && allowedDates.length > 0 ? allowedDates.slice() : SAMPLE_DATE_LIST.slice();
  const dateSet = new Set(dateList);
  const startDate =
    initialDate !== undefined && dateSet.has(initialDate) ? initialDate : dateList[0];
  const quantities = new Map<string, number>();
  const prices = new Map<string, number>();
  const limits = new Map<string, number>();
  const state: DraftState = {
    date: startDate,
    shopId: null,
    slotId: null,
    diningMode: null,
    status: 'idle',
    order: null,
    error: null,
    notice: null,
  };
  let inFlight: Promise<StudentOrder | null> | null = null;
  let submission: CreateOrderInput | null = null;
  let generation = 0;

  let catalogDishIds = new Set<string>();

  function getItems(): DraftItemInput[] {
    return [...quantities.entries()]
      .filter(([, quantity]) => quantity > 0)
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([dishId, quantity]) => ({ dishId, quantity }));
  }

  function getTotalQuantity(): number {
    return getItems().reduce((sum, item) => sum + item.quantity, 0);
  }

  function getPreviewFen(): number {
    return sumFen(
      getItems().map((item) => ({ unitPriceFen: prices.get(item.dishId) ?? 0, quantity: item.quantity })),
    );
  }

  function notifyChange(): void {
    if (onChange) {
      onChange(snapshot());
    }
  }

  function canProceedToSlot(): boolean {
    return getItems().length > 0;
  }

  function hasForeignItem(): boolean {
    return getItems().some((item) => !catalogDishIds.has(item.dishId));
  }

  function canSetShop(): boolean {
    return state.status !== 'submitting' && state.status !== 'timeout' && inFlight === null;
  }

  function canConfirm(): boolean {
    return (
      getItems().length > 0 &&
      state.slotId !== null &&
      state.diningMode !== null &&
      !hasForeignItem()
    );
  }

  function snapshot(): DraftSnapshot {
    return {
      ...state,
      allowedDates: dateList.slice(),
      items: getItems(),
      totalQuantity: getTotalQuantity(),
      previewFen: getPreviewFen(),
      canProceedToSlot: canProceedToSlot(),
      canConfirm: canConfirm(),
      canSwitchShop: canSetShop(),
      hasForeignItem: hasForeignItem(),
      requestId: requestIds.current,
    };
  }

  function getShopId(): string | null {
    return state.shopId;
  }

  function beginMenuRead(): number {
    return generation;
  }

  function isMenuReadCurrent(token: number): boolean {
    return token === generation;
  }

  function setShop(merchantId: string): SetShopResult {
    if (typeof merchantId !== 'string' || merchantId.trim() === '') {
      return { ok: false, changed: false, reason: 'invalid' };
    }
    if (state.shopId === merchantId) {
      return { ok: true, changed: false, reason: 'same-shop' };
    }
    if (!canSetShop()) {
      return { ok: false, changed: false, reason: 'busy' };
    }
    quantities.clear();
    prices.clear();
    limits.clear();

    catalogDishIds = new Set<string>();
    state.shopId = merchantId;
    state.slotId = null;
    state.diningMode = null;
    state.status = 'idle';
    state.order = null;
    state.error = null;
    state.notice = SHOP_SWITCH_NOTICE;
    submission = null;
    requestIds.complete();
    generation += 1;
    notifyChange();
    return { ok: true, changed: true, reason: 'applied' };
  }

  function setDate(date: string): boolean {
    if (!dateSet.has(date)) {
      throw apiError('VALIDATION_ERROR', '日期只能是今天或明天。', false);
    }
    if (date === state.date) {
      return false;
    }
    state.date = date;
    quantities.clear();
    prices.clear();
    limits.clear();
    state.slotId = null;
    state.diningMode = null;
    state.status = 'idle';
    state.order = null;
    state.error = null;
    state.notice = '已切换日期，请重新选择';
    submission = null;
    requestIds.complete();
    generation += 1;
    notifyChange();
    return true;
  }

  function setQuantity(dish: DishDto, quantity: number): number {
    if (!dish || typeof dish.dishId !== 'string') {
      throw apiError('VALIDATION_ERROR', '菜品信息不完整。', false);
    }
    const limit = dish.onSale === true ? Math.max(0, dish.availableQuantity ?? 0) : 0;
    const wanted = Number.isInteger(quantity) ? quantity : 0;
    if (dish.onSale === true && limit === 0 && wanted > 0) {
      state.notice = DISH_SHORTAGE_NOTICE;
      notifyChange();
      return quantities.get(dish.dishId) ?? 0;
    }
    const next = Math.max(0, Math.min(wanted, limit));
    prices.set(dish.dishId, dish.unitPriceFen ?? 0);
    limits.set(dish.dishId, limit);
    if (next === 0) {
      quantities.delete(dish.dishId);
    } else {
      quantities.set(dish.dishId, next);
    }
    state.notice = limit > 0 && next === limit ? DISH_LIMIT_TEXT : null;
    notifyChange();
    return next;
  }

  function getLimit(dishId: string): number {
    return limits.get(dishId) ?? 0;
  }

  function setSlot(slotId: string): void {
    state.slotId = slotId;
    state.status = 'idle';
    state.order = null;
    state.error = null;
    notifyChange();
  }

  function setDiningMode(mode: DiningMode): void {
    if (!MODES.has(mode)) {
      throw apiError('VALIDATION_ERROR', '请选择堂食或外带。', false);
    }
    state.diningMode = mode;
    notifyChange();
  }

  function applyDishCatalog(dishes: DishDto[]): void {
    if (state.shopId === null) {
      quantities.clear();
      prices.clear();
      limits.clear();

      catalogDishIds = new Set<string>();
      notifyChange();
      return;
    }
    const filtered = filterDishesByShop(dishes, state.shopId);
    const catalog = new Map(filtered.map((dish) => [dish.dishId, dish]));

    catalogDishIds = new Set(catalog.keys());
    let changed = false;
    for (const [dishId, quantity] of [...quantities.entries()]) {
      const dish = catalog.get(dishId);
      if (!dish) {
        quantities.delete(dishId);
        prices.delete(dishId);
        limits.delete(dishId);
        changed = true;
        continue;
      }
      const limit = dish.onSale === true ? Math.max(0, dish.availableQuantity ?? 0) : 0;
      prices.set(dishId, dish.unitPriceFen ?? 0);
      limits.set(dishId, limit);
      if (limit === 0) {
        changed = true;
      } else if (quantity > limit) {
        quantities.set(dishId, limit);
      }
    }
    if (changed) {
      state.notice = '部分菜品已变化，请重新确认';
    }
    notifyChange();
  }

  function dropForeignItems(): boolean {
    let dropped = false;
    for (const dishId of [...quantities.keys()]) {
      if (!catalogDishIds.has(dishId)) {
        quantities.delete(dishId);
        prices.delete(dishId);
        limits.delete(dishId);
        dropped = true;
      }
    }
    if (dropped) {
      state.notice = SHOP_FOREIGN_ITEM_NOTICE;
      notifyChange();
    }
    return dropped;
  }

  function restoreSelection(selection: DraftSelection): boolean {
    if (state.shopId === null || selection.merchantId !== state.shopId) {
      return false;
    }
    if (!dateSet.has(selection.date)) {
      return false;
    }
    if (!Array.isArray(selection.items) || selection.items.length === 0) {
      return false;
    }
    const items = selection.items.filter(
      (item) =>
        typeof item?.dishId === 'string' &&
        item.dishId.trim() !== '' &&
        Number.isInteger(item?.quantity) &&
        item.quantity >= 1 &&
        item.quantity <= 99,
    );
    if (items.length !== selection.items.length) {
      return false;
    }

    state.date = selection.date;
    quantities.clear();
    prices.clear();
    limits.clear();
    for (const item of items) {
      quantities.set(item.dishId, item.quantity);
    }
    state.slotId =
      typeof selection.slotId === 'string' && selection.slotId !== '' ? selection.slotId : null;
    state.diningMode =
      selection.diningMode !== null && MODES.has(selection.diningMode)
        ? selection.diningMode
        : null;
    state.status = 'idle';
    state.order = null;
    state.error = null;
    state.notice = '已恢复上次选择，请重新核对';
    submission = null;
    requestIds.complete();
    generation += 1;
    notifyChange();
    return true;
  }

  function buildInput(): CreateOrderInput {
    dropForeignItems();
    if (getItems().length === 0 || state.slotId === null || state.diningMode === null) {
      throw apiError('VALIDATION_ERROR', '请选择时段和堂食或外带。', false);
    }
    return {
      requestId: requestIds.ensure(snapshot()),
      items: getItems(),
      slotId: state.slotId,
      diningMode: state.diningMode,
    };
  }

  async function submit(): Promise<StudentOrder | null> {
    if (inFlight) {
      return inFlight;
    }
    dropForeignItems();
    if (!canConfirm()) {
      throw apiError('VALIDATION_ERROR', '请选择时段和堂食或外带。', false);
    }
    if (state.status === 'success' && state.order) {
      return { ...state.order };
    }

    state.status = 'submitting';
    state.error = null;
    const input = buildInput();
    submission = {
      requestId: input.requestId,
      items: input.items.map((item) => ({ dishId: item.dishId, quantity: item.quantity })),
      slotId: input.slotId,
      diningMode: input.diningMode,
    };

    inFlight = (async () => {
      try {
        const order = await source.createOrder(input);
        state.status = 'success';
        state.order = order;
        submission = null;
        requestIds.complete();
        return order;
      } catch (error) {
        const code = isApiError(error) ? error.code : '';
        const pendingResult = code === 'TIMEOUT' || code === 'NETWORK_TIMEOUT' || code === 'INVALID_RESPONSE';
        state.status = pendingResult ? 'timeout' : 'error';
        state.order = null;
        state.error = toSourceError(error);
        return null;
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  }

  async function queryResult(): Promise<StudentOrder> {
    if (state.status !== 'timeout') {
      throw apiError('VALIDATION_ERROR', '当前没有待确认的结果。', false);
    }
    const requestId = submission?.requestId ?? requestIds.current;
    if (requestId === null) {
      throw apiError('VALIDATION_ERROR', '当前没有待确认的结果。', false);
    }
    const input = submission
      ? {
          requestId,
          items: submission.items.map((item) => ({ dishId: item.dishId, quantity: item.quantity })),
          slotId: submission.slotId,
          diningMode: submission.diningMode,
        }
      : { requestId };
    try {
      const order = await source.queryOrderResult(input);
      state.status = 'success';
      state.order = order;
      submission = null;
      requestIds.complete();
      return order;
    } catch (error) {
      state.error = toSourceError(error);
      throw error;
    }
  }

  function resetSubmission(): void {
    requestIds.complete();
    submission = null;
    state.status = 'idle';
    state.order = null;
    state.error = null;
    notifyChange();
  }

  function startNewOrder(): void {
    requestIds.complete();
    submission = null;
    quantities.clear();
    prices.clear();
    limits.clear();
    state.slotId = null;
    state.diningMode = null;
    state.status = 'idle';
    state.order = null;
    state.error = null;
    state.notice = null;
    notifyChange();
  }

  return {
    getState: snapshot,
    getShopId,
    canSetShop,
    setShop,
    beginMenuRead,
    isMenuReadCurrent,
    setDate,
    setQuantity,
    getLimit,
    setSlot,
    setDiningMode,
    applyDishCatalog,
    restoreSelection,
    canProceedToSlot,
    canConfirm,
    buildInput,
    submit,
    queryResult,
    resetSubmission,
    startNewOrder,
  };
}