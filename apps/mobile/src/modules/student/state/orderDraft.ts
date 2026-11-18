import type {
  CreateOrderInput,
  DiningMode,
  DishDto,
  DraftItemInput,
  ItemCustomizationSelection,
  SelectedFlavor,
  SourceError,
  StudentOrder,
  StudentSource,
} from '../types';
import { apiError, isApiError, toSourceError } from '../types';
import { sumFen } from '../utils/money';
import { sanitizeOrderRemark } from '../utils/remark';
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

export interface SetCustomizationResult {
  ok: boolean;
  message: string | null;
}

export interface DraftState {
  date: string;
  shopId: string | null;
  slotId: string | null;
  diningMode: DiningMode | null;
  remark: string;
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
  setCustomization(dish: DishDto, selection: ItemCustomizationSelection): SetCustomizationResult;
  getCustomization(dishId: string): ItemCustomizationSelection | null;
  getLimit(dishId: string): number;
  setSlot(slotId: string): void;
  clearSlot(): void;
  setDiningMode(mode: DiningMode): void;
  setRemark(text: string): void;
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
  const selections = new Map<string, ItemCustomizationSelection>();
  const catalog = new Map<string, DishDto>();
  const state: DraftState = {
    date: startDate,
    shopId: null,
    slotId: null,
    diningMode: null,
    remark: '',
    status: 'idle',
    order: null,
    error: null,
    notice: null,
  };
  let inFlight: Promise<StudentOrder | null> | null = null;
  let submission: CreateOrderInput | null = null;
  let generation = 0;

  let catalogDishIds = new Set<string>();

  function selectionOf(dishId: string): ItemCustomizationSelection | null {
    return selections.get(dishId) ?? null;
  }

  function addOnExtraFen(dishId: string, addOnIds: string[] | undefined): number {
    if (!addOnIds || addOnIds.length === 0) {
      return 0;
    }
    const dish = catalog.get(dishId);
    if (!dish) {
      return 0;
    }
    const chosen = new Set(addOnIds);
    return dish.addOns
      .filter((addOn) => chosen.has(addOn.id))
      .reduce((sum, addOn) => sum + Math.max(0, addOn.priceFen ?? 0), 0);
  }

  function getItems(): DraftItemInput[] {
    return [...quantities.entries()]
      .filter(([, quantity]) => quantity > 0)
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([dishId, quantity]) => {
        const selection = selectionOf(dishId);
        if (!selection) {
          return { dishId, quantity };
        }
        return {
          dishId,
          quantity,
          ...(selection.selectedFlavors.length > 0
            ? { selectedFlavors: selection.selectedFlavors.map((item) => ({ ...item })) }
            : {}),
          ...(selection.selectedSides.length > 0
            ? { selectedSides: selection.selectedSides.slice() }
            : {}),
          ...(selection.selectedAddOns.length > 0
            ? { selectedAddOns: selection.selectedAddOns.slice() }
            : {}),
        };
      });
  }

  function getTotalQuantity(): number {
    return getItems().reduce((sum, item) => sum + item.quantity, 0);
  }

  function missingRequiredFlavor(item: DraftItemInput): string | null {
    const dish = catalog.get(item.dishId);
    if (!dish) {
      return null;
    }
    const chosen = new Set((item.selectedFlavors ?? []).map((entry) => entry.groupId));
    const missing = dish.flavorGroups.find((group) => group.required && !chosen.has(group.id));
    return missing ? missing.name : null;
  }

  function getPreviewFen(): number {
    return sumFen(
      getItems().map((item) => ({
        unitPriceFen: (prices.get(item.dishId) ?? 0) + addOnExtraFen(item.dishId, item.selectedAddOns),
        quantity: item.quantity,
      })),
    );
  }

  function notifyChange(): void {
    if (onChange) {
      onChange(snapshot());
    }
  }

  function canProceedToSlot(): boolean {
    const items = getItems();
    return items.length > 0 && items.every((item) => missingRequiredFlavor(item) === null);
  }

  function hasForeignItem(): boolean {
    return getItems().some((item) => !catalogDishIds.has(item.dishId));
  }

  function canSetShop(): boolean {
    return state.status !== 'submitting' && state.status !== 'timeout' && inFlight === null;
  }

  function canConfirm(): boolean {
    return (
      canProceedToSlot() &&
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
    selections.clear();
    catalog.clear();

    catalogDishIds = new Set<string>();
    state.shopId = merchantId;
    state.slotId = null;
    state.diningMode = null;
    state.remark = '';
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
    selections.clear();
    catalog.clear();
    state.slotId = null;
    state.diningMode = null;
    state.remark = '';
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
    catalog.set(dish.dishId, dish);
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

  function getCustomization(dishId: string): ItemCustomizationSelection | null {
    return selectionOf(dishId);
  }

  function setCustomization(
    dish: DishDto,
    selection: ItemCustomizationSelection,
  ): SetCustomizationResult {
    if (!dish || typeof dish.dishId !== 'string') {
      return { ok: false, message: '菜品信息不完整。' };
    }
    const groupById = new Map(dish.flavorGroups.map((group) => [group.id, group]));
    const chosenGroups = new Set<string>();
    const flavors: SelectedFlavor[] = [];
    for (const entry of selection.selectedFlavors) {
      const group = groupById.get(entry.groupId);
      if (!group) {
        return { ok: false, message: '口味选项已变化，请刷新菜单后重试。' };
      }
      if (chosenGroups.has(group.id)) {
        return { ok: false, message: `「${group.name}」只能选择一个选项。` };
      }
      if (!group.options.some((option) => option.id === entry.optionId)) {
        return { ok: false, message: `「${group.name}」的选项已变化，请重新选择。` };
      }
      chosenGroups.add(group.id);
      flavors.push({ groupId: group.id, optionId: entry.optionId });
    }
    for (const group of dish.flavorGroups) {
      if (group.required && !chosenGroups.has(group.id)) {
        return { ok: false, message: `请选择必选口味「${group.name}」。` };
      }
    }
    const sideIds = new Set(dish.sides.map((side) => side.id));
    if (selection.selectedSides.some((id) => !sideIds.has(id))) {
      return { ok: false, message: '配菜选项已变化，请刷新菜单后重试。' };
    }
    const addOnIds = new Set(dish.addOns.map((addOn) => addOn.id));
    if (selection.selectedAddOns.some((id) => !addOnIds.has(id))) {
      return { ok: false, message: '加购选项已变化，请刷新菜单后重试。' };
    }
    catalog.set(dish.dishId, dish);
    selections.set(dish.dishId, {
      selectedFlavors: flavors,
      selectedSides: [...new Set(selection.selectedSides)],
      selectedAddOns: [...new Set(selection.selectedAddOns)],
    });
    if ((quantities.get(dish.dishId) ?? 0) === 0 && dish.onSale === true && (dish.availableQuantity ?? 0) > 0) {
      quantities.set(dish.dishId, 1);
      prices.set(dish.dishId, dish.unitPriceFen ?? 0);
      limits.set(dish.dishId, Math.max(0, dish.availableQuantity ?? 0));
    }
    notifyChange();
    return { ok: true, message: null };
  }

  function setSlot(slotId: string): void {
    state.slotId = slotId;
    state.status = 'idle';
    state.order = null;
    state.error = null;
    notifyChange();
  }

  function clearSlot(): void {
    if (state.slotId === null) {
      return;
    }
    state.slotId = null;
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

  function setRemark(text: string): void {
    const next = sanitizeOrderRemark(typeof text === 'string' ? text : '');
    if (next === state.remark) {
      return;
    }
    state.remark = next;
    if (state.status !== 'submitting') {
      requestIds.complete();
      submission = null;
      state.status = 'idle';
      state.order = null;
      state.error = null;
    }
    notifyChange();
  }

  function applyDishCatalog(dishes: DishDto[]): void {
    if (state.shopId === null) {
      quantities.clear();
      prices.clear();
      limits.clear();
      selections.clear();
      catalog.clear();

      catalogDishIds = new Set<string>();
      notifyChange();
      return;
    }
    const filtered = filterDishesByShop(dishes, state.shopId);
    const nextCatalog = new Map(filtered.map((dish) => [dish.dishId, dish]));

    catalogDishIds = new Set(nextCatalog.keys());
    catalog.clear();
    for (const [dishId, dish] of nextCatalog) {
      catalog.set(dishId, dish);
    }
    let changed = false;
    for (const [dishId, quantity] of [...quantities.entries()]) {
      const dish = nextCatalog.get(dishId);
      if (!dish) {
        quantities.delete(dishId);
        prices.delete(dishId);
        limits.delete(dishId);
        selections.delete(dishId);
        changed = true;
        continue;
      }
      const limit = dish.onSale === true ? Math.max(0, dish.availableQuantity ?? 0) : 0;
      prices.set(dishId, dish.unitPriceFen ?? 0);
      limits.set(dishId, limit);
      const selection = selections.get(dishId);
      if (selection && !selectionStillValid(dish, selection)) {
        selections.delete(dishId);
        changed = true;
      }
      if (limit === 0) {
        changed = true;
      } else if (quantity > limit) {
        quantities.set(dishId, limit);
      }
    }
    if (changed) {
      state.notice = '部分菜品或配菜已变化，请重新确认';
    }
    notifyChange();
  }

  function selectionStillValid(
    dish: DishDto,
    selection: ItemCustomizationSelection,
  ): boolean {
    const groups = new Map(dish.flavorGroups.map((group) => [group.id, group]));
    const chosenGroups = new Set<string>();
    for (const entry of selection.selectedFlavors) {
      const group = groups.get(entry.groupId);
      if (!group || !group.options.some((option) => option.id === entry.optionId)) {
        return false;
      }
      chosenGroups.add(group.id);
    }
    for (const group of dish.flavorGroups) {
      if (group.required && !chosenGroups.has(group.id)) {
        return false;
      }
    }
    const sideIds = new Set(dish.sides.map((side) => side.id));
    if (selection.selectedSides.some((id) => !sideIds.has(id))) {
      return false;
    }
    const addOnIds = new Set(dish.addOns.map((addOn) => addOn.id));
    return selection.selectedAddOns.every((id) => addOnIds.has(id));
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
    selections.clear();
    for (const item of items) {
      quantities.set(item.dishId, item.quantity);
      const selectedFlavors = (item.selectedFlavors ?? []).filter(
        (entry) =>
          typeof entry?.groupId === 'string' &&
          entry.groupId !== '' &&
          typeof entry.optionId === 'string' &&
          entry.optionId !== '',
      );
      const selectedSides = (item.selectedSides ?? []).filter(
        (id): id is string => typeof id === 'string' && id !== '',
      );
      const selectedAddOns = (item.selectedAddOns ?? []).filter(
        (id): id is string => typeof id === 'string' && id !== '',
      );
      if (selectedFlavors.length > 0 || selectedSides.length > 0 || selectedAddOns.length > 0) {
        selections.set(item.dishId, { selectedFlavors, selectedSides, selectedAddOns });
      }
    }
    state.slotId =
      typeof selection.slotId === 'string' && selection.slotId !== '' ? selection.slotId : null;
    state.diningMode =
      selection.diningMode !== null && MODES.has(selection.diningMode)
        ? selection.diningMode
        : null;
    state.remark = '';
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
      remark: state.remark === '' ? undefined : state.remark,
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
      items: input.items.map((item) => ({ ...item })),
      slotId: input.slotId,
      diningMode: input.diningMode,
      remark: input.remark,
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
          items: submission.items.map((item) => ({ ...item })),
          slotId: submission.slotId,
          diningMode: submission.diningMode,
          remark: submission.remark,
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
    selections.clear();
    catalog.clear();
    state.slotId = null;
    state.diningMode = null;
    state.remark = '';
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
    setCustomization,
    getCustomization,
    getLimit,
    setSlot,
    clearSlot,
    setDiningMode,
    setRemark,
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