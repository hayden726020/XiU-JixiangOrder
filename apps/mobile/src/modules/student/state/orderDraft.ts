import type {
  CreateOrderInput,
  DiningMode,
  DishDto,
  DraftItemInput,
  SourceError,
  StudentOrder,
  StudentSource,
} from '../types';
import { ApiError, apiError, toSourceError } from '../types';
import { sumFen } from '../utils/money';
import { createRequestIdKeeper, type RequestIdKeeper } from '../utils/requestId';

const MODES = new Set<DiningMode>(['DINE_IN', 'TAKEAWAY']);
const SAMPLE_DATES = new Set(['2026-11-13', '2026-11-14']);

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
}

export interface OrderDraft {
  getState(): DraftSnapshot;
  setDate(date: string): boolean;
  setQuantity(dish: DishDto, quantity: number): number;
  getLimit(dishId: string): number;
  setSlot(slotId: string): void;
  setDiningMode(mode: DiningMode): void;
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
  requestIds = createRequestIdKeeper(),
}: OrderDraftOptions): OrderDraft {
  const quantities = new Map<string, number>();
  const prices = new Map<string, number>();
  const limits = new Map<string, number>();
  const state: DraftState = {
    date: '2026-11-13',
    slotId: null,
    diningMode: null,
    status: 'idle',
    order: null,
    error: null,
    notice: null,
  };
  let inFlight: Promise<StudentOrder | null> | null = null;

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

  function canProceedToSlot(): boolean {
    return getItems().length > 0;
  }

  function canConfirm(): boolean {
    return getItems().length > 0 && state.slotId !== null && state.diningMode !== null;
  }

  function snapshot(): DraftSnapshot {
    return {
      ...state,
      items: getItems(),
      totalQuantity: getTotalQuantity(),
      previewFen: getPreviewFen(),
      canProceedToSlot: canProceedToSlot(),
      canConfirm: canConfirm(),
      requestId: requestIds.current,
    };
  }

  function setDate(date: string): boolean {
    if (!SAMPLE_DATES.has(date)) {
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
    requestIds.complete();
    return true;
  }

  function setQuantity(dish: DishDto, quantity: number): number {
    if (!dish || typeof dish.dishId !== 'string') {
      throw apiError('VALIDATION_ERROR', '菜品信息不完整。', false);
    }
    const limit = dish.onSale === true ? Math.max(0, dish.availableQuantity ?? 0) : 0;
    const wanted = Number.isInteger(quantity) ? quantity : 0;
    const next = Math.max(0, Math.min(wanted, limit));
    prices.set(dish.dishId, dish.unitPriceFen ?? 0);
    limits.set(dish.dishId, limit);
    if (next === 0) {
      quantities.delete(dish.dishId);
    } else {
      quantities.set(dish.dishId, next);
    }
    state.notice = limit > 0 && next === limit ? '已达可售数量' : null;
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
  }

  function setDiningMode(mode: DiningMode): void {
    if (!MODES.has(mode)) {
      throw apiError('VALIDATION_ERROR', '请选择堂食或外带。', false);
    }
    state.diningMode = mode;
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

    inFlight = (async () => {
      try {
        const order = await source.createOrder(input);
        state.status = 'success';
        state.order = order;
        requestIds.complete();
        return order;
      } catch (error) {
        state.status = error instanceof ApiError && error.code === 'TIMEOUT' ? 'timeout' : 'error';
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
    const requestId = requestIds.current;
    if (requestId === null) {
      throw apiError('VALIDATION_ERROR', '当前没有待确认的结果。', false);
    }
    const order = await source.queryOrderResult(requestId);
    state.status = 'success';
    state.order = order;
    requestIds.complete();
    return order;
  }

  function resetSubmission(): void {
    requestIds.complete();
    state.status = 'idle';
    state.order = null;
    state.error = null;
  }

  function startNewOrder(): void {
    requestIds.complete();
    quantities.clear();
    prices.clear();
    limits.clear();
    state.slotId = null;
    state.diningMode = null;
    state.status = 'idle';
    state.order = null;
    state.error = null;
    state.notice = null;
  }

  return {
    getState: snapshot,
    setDate,
    setQuantity,
    getLimit,
    setSlot,
    setDiningMode,
    canProceedToSlot,
    canConfirm,
    buildInput,
    submit,
    queryResult,
    resetSubmission,
    startNewOrder,
  };
}