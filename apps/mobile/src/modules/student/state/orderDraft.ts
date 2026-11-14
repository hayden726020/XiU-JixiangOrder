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
import { createRequestIdKeeper, requestIdPrefixOf, type RequestIdKeeper } from '../utils/requestId';
import type { DraftSelection } from './draftSnapshot';

const MODES = new Set<DiningMode>(['DINE_IN', 'TAKEAWAY']);
const SAMPLE_DATE_LIST = ['2026-11-13', '2026-11-14'];

export type DraftStatus = 'idle' | 'submitting' | 'success' | 'timeout' | 'error';

export interface DraftState {
  date: string;
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
    slotId: null,
    diningMode: null,
    status: 'idle',
    order: null,
    error: null,
    notice: null,
  };
  let inFlight: Promise<StudentOrder | null> | null = null;
  let submission: CreateOrderInput | null = null;

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

  function canConfirm(): boolean {
    return getItems().length > 0 && state.slotId !== null && state.diningMode !== null;
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
      requestId: requestIds.current,
    };
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
    const catalog = new Map(dishes.map((dish) => [dish.dishId, dish]));
    let changed = false;
    for (const [dishId, quantity] of [...quantities.entries()]) {
      const dish = catalog.get(dishId);
      if (!dish) {
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

  function restoreSelection(selection: DraftSelection): boolean {
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
    notifyChange();
    return true;
  }

  function buildInput(): CreateOrderInput {
    if (state.slotId === null || state.diningMode === null) {
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