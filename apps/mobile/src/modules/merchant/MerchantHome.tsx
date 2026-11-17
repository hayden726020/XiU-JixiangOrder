import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import SampleBanner from './components/SampleBanner';
import { SAMPLE_DATES } from './data/sampleData';
import { createMerchantSource } from './data/source';
import type {
  CancelDecision,
  CreateDishInput,
  DailyMenuSelection,
  DiningMode,
  Dish,
  MenuDay,
  MerchantOrder,
  MerchantScenario,
  OrderAdvanceAction,
  Slot,
  SlotDay,
  SourceResult,
} from './data/types';
import MenuPage from './pages/MenuPage';
import MerchantLoginPage from './pages/MerchantLoginPage';
import OnboardingPage from './pages/OnboardingPage';
import OrderDetailPage from './pages/OrderDetailPage';
import OrderListPage from './pages/OrderListPage';
import {
  actionErrorText,
  actionPrompt,
  isRealWriteAction,
  validateActionInput,
  type ActionInput,
  type OrderAction,
} from './state/actionMatrix';
import { formatClock, localInputToZonedIso, shortOrderId, statusView } from './state/orderView';
import type { DishPatch } from './state/menuEdit';
import { menuDatesFor, resolveMenuDate, todayIso } from './state/menuView';
import { formatYuan } from './utils/money';
import { logout } from '../../shared/auth';
import { roleLabel } from '../../shared';
import { getApiBaseInfo } from '../../shared/config';
import { createRequestId } from '../../shared/requestId';
import { getSession, subscribeSession, type Session } from '../../shared/session';
import './merchant.css';

type DataMode = 'sample' | 'real';

const ORDERS_PAGE_SIZE = 20;
const AUTO_REFRESH_MS = 15000;
const MERCHANT_ROUTE = '/merchant';
const MENU_ROUTE = `${MERCHANT_ROUTE}/menu`;
const SETUP_ROUTE = `${MERCHANT_ROUTE}/setup`;
const ORDERS_ROUTE = `${MERCHANT_ROUTE}/orders`;
const ORDER_ROUTE_PREFIX = `${ORDERS_ROUTE}/`;
const MY_ROUTE = `${MERCHANT_ROUTE}/my`;

type View =
  | { name: 'list' }
  | { name: 'detail'; orderId: string }
  | { name: 'menu' }
  | { name: 'setup' }
  | { name: 'my' };

function merchantRoute(): string {
  return window.location.hash.replace(/^#/, '').replace(/\/+$/, '') || '/';
}

function orderIdFromRoute(route: string): string | null {
  if (!route.startsWith(ORDER_ROUTE_PREFIX)) return null;
  const encodedId = route.slice(ORDER_ROUTE_PREFIX.length);
  if (!encodedId || encodedId.includes('/')) return null;
  try {
    return decodeURIComponent(encodedId);
  } catch {
    return null;
  }
}

function viewFromRoute(): View {
  const route = merchantRoute();
  if (route === MERCHANT_ROUTE || route === SETUP_ROUTE) return { name: 'setup' };
  if (route === MENU_ROUTE) return { name: 'menu' };
  if (route === ORDERS_ROUTE) return { name: 'list' };
  if (route === MY_ROUTE) return { name: 'my' };
  const orderId = orderIdFromRoute(route);
  if (orderId) return { name: 'detail', orderId };
  return { name: 'list' };
}

export default function MerchantHome() {
  const initialMode: DataMode = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('mode') === 'real'
    ? 'real'
    : 'sample';
  const [mode, setMode] = useState<DataMode>(initialMode);
  const [scenario, setScenario] = useState<MerchantScenario>('normal');
  const [view, setView] = useState<View>(viewFromRoute);
  const today = useMemo(() => todayIso(), []);
  const dates = useMemo(
    () => (mode === 'sample' ? [...SAMPLE_DATES] : menuDatesFor(today)),
    [mode, today],
  );
  const [menuDate, setMenuDate] = useState<string>(() => resolveMenuDate(
    initialMode === 'sample' ? [...SAMPLE_DATES] : menuDatesFor(today),
    today,
  ));
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ code: string; message: string } | null>(null);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionRequestIds = useRef(new Map<string, string>());
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageInfo, setOrderPageInfo] = useState({ page: 1, pageSize: ORDERS_PAGE_SIZE, total: 0 });
  const [menu, setMenu] = useState<MenuDay | null>(null);
  const [slots, setSlots] = useState<SlotDay | null>(null);
  const [dishLibrary, setDishLibrary] = useState<Dish[]>([]);
  const [dishLibraryLoading, setDishLibraryLoading] = useState(false);
  const [dishLibraryError, setDishLibraryError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingOrder, setRefreshingOrder] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const listScrollTop = useRef(0);
  const restoreListScroll = useRef(false);
  const listRefreshInFlight = useRef(false);
  const orderRefreshInFlight = useRef(false);
  const knownOrderIds = useRef<Set<string>>(new Set());

  const source = useMemo(() => createMerchantSource({ mode, scenario }), [mode, scenario]);
  const [session, setSession] = useState<Session | null>(getSession);
  const merchantLoggedIn = session?.user.role === 'MERCHANT';
  const apiBase = getApiBaseInfo();
  const devPassword = import.meta.env.DEV
    ? (import.meta.env.VITE_DEMO_MERCHANT_PASSWORD as string | undefined)
    : undefined;


  useEffect(() => subscribeSession(() => setSession(getSession())), []);

  useEffect(() => {
    const onHashChange = () => {
      const route = merchantRoute();
      const orderId = orderIdFromRoute(route);
      if (orderId) {
        clearActionState();
        setView({ name: 'detail', orderId });
        setNotice(null);
      } else if (route === MENU_ROUTE) {
        setView({ name: 'menu' });
        setNotice(null);
      } else if (route === MERCHANT_ROUTE || route === SETUP_ROUTE) {
        setView({ name: 'setup' });
        setNotice(null);
      } else if (route === ORDERS_ROUTE) {
        setView({ name: 'list' });
      } else if (route === MY_ROUTE) {
        setView({ name: 'my' });
        setNotice(null);
        setNotice(null);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function handleMerchantLoggedIn() {
    clearActionState();
    setNotice(null);
    setView({ name: 'list' });
    setOrderPage(1);
    setDataVersion((current) => current + 1);
    if (merchantRoute() !== ORDERS_ROUTE) {
      window.location.hash = ORDERS_ROUTE;
    }
  }

  async function handleMerchantLogout() {
    clearActionState();
    setNotice(null);
    try {
      await logout();
    } catch {
      // logout 已在 finally 清除本地会话；服务端不可达时同样回到登录页。
    }
    setView({ name: 'list' });
    setDataVersion((current) => current + 1);
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setOrdersError(null);
    setMenuError(null);
    setOrders([]);
    setMenu(null);
    setSlots(null);
    if (mode === 'real' && !merchantLoggedIn) {
      setOrdersError('真实模式需要先登录档口演示账号，未登录不读取订单与菜单。');
      setMenuError('真实模式需要先登录档口演示账号，未登录不读取订单与菜单。');
      setOrderPageInfo({ page: 1, pageSize: ORDERS_PAGE_SIZE, total: 0 });
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    void (async () => {
      const [ordersResult, menuResult, slotsResult] = await Promise.all([
        source.getOrders(orderPage, ORDERS_PAGE_SIZE),
        source.getMenu(menuDate),
        source.getSlots(menuDate),
      ]);
      if (!alive) return;
      if (ordersResult.ok) {
        rememberOrders(ordersResult.data.orders, false);
        setOrders(ordersResult.data.orders);
        setOrderPageInfo({
          page: ordersResult.data.page,
          pageSize: ordersResult.data.pageSize,
          total: ordersResult.data.total,
        });
      } else {
        setOrdersError(ordersResult.error.message);
      }
      if (menuResult.ok) {
        setMenu(menuResult.data);
      } else {
        setMenuError(menuResult.error.message);
      }
      if (slotsResult.ok) {
        setSlots(slotsResult.data);
      } else if (menuResult.ok) {
        setMenuError(slotsResult.error.message);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [source, menuDate, orderPage, session?.user.id, mode, merchantLoggedIn, dataVersion]);

  const activeOrder = view.name === 'detail'
    ? orders.find((order) => order.id === view.orderId) ?? null
    : null;

  function rememberOrders(next: MerchantOrder[], announce: boolean) {
    if (announce) {
      const fresh = next.filter(
        (order) => order.status === 'NEW' && !knownOrderIds.current.has(order.id),
      );
      if (fresh.length > 0) {
        setNotice(`发现 ${fresh.length} 笔新订单，已在「待接单」分组显示。`);
      }
    }
    for (const order of next) {
      knownOrderIds.current.add(order.id);
    }
  }

  function markRefreshed() {
    const now = new Date();
    setLastRefreshedAt(
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
    );
  }

  async function refreshOrders(options: { silent?: boolean } = {}) {
    if (listRefreshInFlight.current) return;
    listRefreshInFlight.current = true;
    if (!options.silent) setRefreshing(true);
    try {
      const result = await source.getOrders(orderPage, ORDERS_PAGE_SIZE);
      if (result.ok) {
        rememberOrders(result.data.orders, true);
        setOrders(result.data.orders);
        setOrderPageInfo({
          page: result.data.page,
          pageSize: result.data.pageSize,
          total: result.data.total,
        });
        setOrdersError(null);
        markRefreshed();
      } else if (!options.silent) {
        setNotice(`刷新订单列表失败：${result.error.message}`);
      }
    } finally {
      listRefreshInFlight.current = false;
      if (!options.silent) setRefreshing(false);
    }
  }

  async function checkNewOrders() {
    if (listRefreshInFlight.current) return;
    listRefreshInFlight.current = true;
    try {
      const result = await source.getOrders(1, ORDERS_PAGE_SIZE);
      if (result.ok) rememberOrders(result.data.orders, true);
    } finally {
      listRefreshInFlight.current = false;
    }
  }

  function clearActionState() {
    if (actionTimer.current !== null) {
      clearTimeout(actionTimer.current);
      actionTimer.current = null;
    }
    actionRequestIds.current.clear();
    setPendingCode(null);
    setActionError(null);
  }

  function changeMode(next: DataMode) {
    if (next === mode) return;
    clearActionState();
    if (merchantRoute() !== ORDERS_ROUTE) {
      window.location.hash = ORDERS_ROUTE;
    }
    setMode(next);
    setView({ name: 'list' });
    setNotice(null);
    setOrderPage(1);
    const nextDates = next === 'sample' ? [...SAMPLE_DATES] : menuDatesFor(today);
    setMenuDate(resolveMenuDate(nextDates, today));
  }

  function changeScenario(next: MerchantScenario) {
    clearActionState();
    setScenario(next);
    setView({ name: 'list' });
    setNotice(null);
    setOrderPage(1);
  }

  function changeOrderPage(next: number) {
    if (next < 1 || next === orderPage) return;
    clearActionState();
    setOrderPage(next);
    window.scrollTo(0, 0);
  }

  function openOrder(id: string) {
    clearActionState();
    listScrollTop.current = window.scrollY;
    window.location.hash = `${ORDER_ROUTE_PREFIX}${encodeURIComponent(id)}`;
    setView({ name: 'detail', orderId: id });
    setNotice(null);
  }

  function backToList() {
    clearActionState();
    if (merchantRoute() !== ORDERS_ROUTE) {
      window.location.hash = ORDERS_ROUTE;
    }
    restoreListScroll.current = true;
    setView({ name: 'list' });
    setNotice(null);
  }

  function openMenu() {
    clearActionState();
    setDataVersion((current) => current + 1);
    window.location.hash = MENU_ROUTE;
    setView({ name: 'menu' });
    setNotice(null);
  }

  function openSetup() {
    clearActionState();
    window.location.hash = SETUP_ROUTE;
    setView({ name: 'setup' });
    setNotice(null);
  }

  function openMy() {
    clearActionState();
    window.location.hash = MY_ROUTE;
    setView({ name: 'my' });
    setNotice(null);
  }

  function exitMerchant() {
    clearActionState();
    window.location.hash = '/';
  }

  function handleAction(orderId: string, action: OrderAction, input: ActionInput = {}) {
    if (pendingCode !== null) return;
    const validation = validateActionInput(action, input, mode);
    if (validation) {
      setActionError({ code: action.code, message: validation });
      setNotice(null);
      return;
    }
    setActionError(null);
    setNotice(null);
    const order = orders.find((item) => item.id === orderId) ?? null;
    if (mode === 'real' && isRealWriteAction(action)) {
      if (!order) {
        setActionError({ code: action.code, message: '订单不在当前列表中，请返回列表刷新后重试。' });
        return;
      }
      void runRealWrite(order, action, input);
      return;
    }
    setPendingCode(action.code);
    actionTimer.current = setTimeout(() => {
      actionTimer.current = null;
      setPendingCode(null);
      setNotice(actionPrompt(action, orderId, mode, input));
    }, 600);
  }

  async function refreshOrder(id: string, options: { silent?: boolean } = {}) {
    if (orderRefreshInFlight.current) return;
    orderRefreshInFlight.current = true;
    if (!options.silent) setRefreshingOrder(true);
    try {
      const result = await source.getOrder(id);
      if (result.ok) {
        setOrders((current) => (current.some((item) => item.id === result.data.id)
          ? current.map((item) => (item.id === result.data.id ? result.data : item))
          : current));
        markRefreshed();
      } else if (!options.silent) {
        setNotice(`刷新订单失败：${result.error.message}`);
      }
    } finally {
      orderRefreshInFlight.current = false;
      if (!options.silent) setRefreshingOrder(false);
    }
  }

  useEffect(() => {
    if (mode !== 'real' || !merchantLoggedIn || loading) return undefined;
    if (view.name !== 'list' && view.name !== 'detail') return undefined;
    const detailId = view.name === 'detail' ? view.orderId : null;
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      if (detailId) {
        void refreshOrder(detailId, { silent: true });
        void checkNewOrders();
        return;
      }
      void refreshOrders({ silent: true });
    };
    const timer = setInterval(tick, AUTO_REFRESH_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [mode, merchantLoggedIn, loading, view, orderPage, source]);

  async function runRealWrite(order: MerchantOrder, action: OrderAction, input: ActionInput) {
    const key = `${order.id}:${action.code}`;
    const requestId = actionRequestIds.current.get(key) ?? createRequestId('merchant-write');
    actionRequestIds.current.set(key, requestId);
    setPendingCode(action.code);
    const base = { expectedVersion: order.version, requestId };
    let result: SourceResult<MerchantOrder>;
    if (action.code === 'VERIFY') {
      result = await source.verifyOrder(order.id, {
        ...base,
        pickupCode: (input.pickupCode ?? '').trim(),
      });
    } else if (
      action.code === 'ACCEPT'
      || action.code === 'START_PREPARING'
      || action.code === 'MARK_READY'
    ) {
      result = await source.advanceOrder(order.id, {
        ...base,
        action: action.action as OrderAdvanceAction,
      });
    } else if (action.code === 'APPROVE_CANCEL' || action.code === 'REJECT_CANCEL') {
      result = await source.decideCancellation(order.id, {
        ...base,
        decision: action.action as CancelDecision,
        reason: (input.reason ?? '').trim(),
      });
    } else if (action.code === 'CANCEL_ORDER') {
      result = await source.cancelOrder(order.id, {
        ...base,
        reason: (input.reason ?? '').trim(),
      });
    } else if (action.code === 'SET_DELAY') {
      result = await source.setDelay(order.id, {
        ...base,
        reason: (input.reason ?? '').trim(),
        expectedReadyAt: localInputToZonedIso((input.expectedReadyAt ?? '').trim()),
      });
    } else if (action.code === 'CHANGE_DINING_MODE') {
      result = await source.changeDiningMode(order.id, {
        ...base,
        diningMode: input.diningMode as DiningMode,
        reason: (input.reason ?? '').trim(),
      });
    } else {
      setPendingCode(null);
      setNotice(actionPrompt(action, order.id, mode, input));
      return;
    }
    setPendingCode(null);
    if (result.ok) {
      for (const storedKey of [...actionRequestIds.current.keys()]) {
        if (storedKey.startsWith(`${order.id}:`)) {
          actionRequestIds.current.delete(storedKey);
        }
      }
      const updated = result.data;
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setNotice(
        `${action.label}成功：订单 ${shortOrderId(updated.id)} 状态为「${statusView(updated.status).label}」，版本 v${updated.version}。`,
      );
      void refreshOrders({ silent: true });
      return;
    }
    setActionError({
      code: action.code,
      message: actionErrorText(result.error.code, result.error.message, action),
    });
    if (
      ['ORDER_VERSION_CONFLICT', 'INVALID_ORDER_STATE', 'PICKUP_CODE_USED', 'ALREADY_CANCELLED']
        .includes(result.error.code)
    ) {
      void refreshOrder(order.id);
    }
    if (!result.error.retryable) {
      actionRequestIds.current.delete(key);
    }
  }

  async function saveDish(
    dish: Dish,
    patch: DishPatch,
    requestId: string,
  ) {
    const result = await source.updateDish(menuDate, dish.dishId, {
      requestId,
      expectedVersion: dish.version,
      ...patch,
    });
    if (result.ok) {
      setMenu((current) => (current
        ? {
          ...current,
          dishes: current.dishes.map((item) => (item.dishId === result.data.dishId ? result.data : item)),
        }
        : current));
      setNotice(
        `已保存菜品「${result.data.name}」：${formatYuan(result.data.unitPriceFen)}，可售 ${result.data.availableQuantity}，${result.data.onSale ? '在售' : '停售'}，版本 v${result.data.version ?? '未返回'}。`,
      );
    }
    return result;
  }

  async function createDish(input: CreateDishInput) {
    const result = await source.createDish(input);
    if (result.ok) {
      setMenu((current) => (current
        ? { ...current, dishes: [...current.dishes, result.data] }
        : current));
      setNotice(
        `已新增菜品「${result.data.name}」：${formatYuan(result.data.unitPriceFen)}，可售 ${result.data.availableQuantity}，${result.data.onSale ? '在售' : '停售'}，版本 v${result.data.version ?? '未返回'}。`,
      );
    }
    return result;
  }

  async function loadDishLibrary() {
    setDishLibraryLoading(true);
    setDishLibraryError(null);
    const result = await source.getDishLibrary(menuDate);
    setDishLibraryLoading(false);
    if (!result.ok) {
      setDishLibraryError(result.error.message);
      return;
    }
    setDishLibrary(result.data);
  }

  async function saveDailyMenu(items: DailyMenuSelection[], requestId: string) {
    const result = await source.setDailyMenu(menuDate, { requestId, dishes: items });
    if (result.ok) {
      setMenu(result.data);
      setNotice(
        `今日菜单已保存：上架 ${result.data.dishes.length} 道菜；未勾选的菜品不会出现在学生端。`,
      );
    }
    return result;
  }

  async function deleteDish(dish: Dish, requestId: string) {
    const result = await source.deleteDish(menuDate, dish.dishId, {
      requestId,
      expectedVersion: dish.version,
    });
    if (result.ok) {
      setMenu((current) => (current
        ? {
          ...current,
          dishes: current.dishes.filter((item) => item.dishId !== result.data.dishId),
        }
        : current));
      setNotice(`已删除菜品「${dish.name}」。学生端菜单不再展示该菜品，历史订单保留原菜名。`);
    }
    return result;
  }

  async function saveSlot(
    slot: Slot,
    patch: { capacity: number; enabled: boolean },
    requestId: string,
  ) {
    const result = await source.updateSlot(menuDate, slot.slotId, {
      requestId,
      expectedVersion: slot.version,
      ...patch,
    });
    if (result.ok) {
      setSlots((current) => (current
        ? {
          ...current,
          slots: current.slots.map((item) => (item.slotId === result.data.slotId ? result.data : item)),
        }
        : current));
      setNotice(
        `已保存时段 ${formatClock(result.data.slotStart)}—${formatClock(result.data.slotEnd)}：名额 ${result.data.capacity}，${result.data.enabled ? '开放' : '关闭'}，版本 v${result.data.version ?? '未返回'}。`,
      );
    }
    return result;
  }

  useEffect(() => () => {
    if (actionTimer.current !== null) {
      clearTimeout(actionTimer.current);
    }
  }, []);

  useLayoutEffect(() => {
    if (view.name !== 'list' || !restoreListScroll.current) {
      return;
    }
    restoreListScroll.current = false;
    window.scrollTo(0, listScrollTop.current);
  }, [view.name]);

  if (mode === 'real' && !merchantLoggedIn) {
    return (
      <MerchantLoginPage
        session={session}
        devDemoPassword={devPassword}
        apiBaseUrl={apiBase.baseUrl}
        apiBaseProblem={apiBase.problem}
        onLoggedIn={handleMerchantLoggedIn}
        onUseSample={() => changeMode('sample')}
      />
    );
  }

  return (
    <section className={`module-panel merchant-panel${view.name === 'list' ? ' merchant-panel--order-list' : ''}${view.name === 'detail' && activeOrder?.status === 'NEW' ? ' merchant-panel--new-order-detail' : ''}${view.name === 'menu' && mode === 'sample' ? ' merchant-panel--sample-menu' : ''}${view.name === 'setup' ? ' merchant-panel--onboarding' : ''}`}>
      <div className="merchant-source">
        <span className="merchant-source__label">数据源</span>
        <button
          type="button"
          className={mode === 'sample' ? 'merchant-source__button merchant-source__button--active' : 'merchant-source__button'}
          onClick={() => changeMode('sample')}
        >
          样例
        </button>
        <button
          type="button"
          className={mode === 'real' ? 'merchant-source__button merchant-source__button--active' : 'merchant-source__button'}
          onClick={() => changeMode('real')}
        >
          真实 · 演示服务
        </button>
      </div>

      {mode === 'sample' ? (
        view.name === 'setup' ? null : <SampleBanner />
      ) : (
        <div className="merchant-real-banner" role="status">
          <strong>真实数据 · 演示服务（DRAFT v0.3 联调候选）</strong>
          <span>服务地址：{apiBase.baseUrl ?? '未配置'}{apiBase.problem ? `（${apiBase.problem}）` : ''}</span>
          <span>
            读取 GET /menu 与 GET /merchant/orders，失败不回退样例。
            当前档口账号：{session?.user.displayName ?? ''}
          </span>
          <button
            type="button"
            className="merchant-link-button merchant-logout-button"
            onClick={() => void handleMerchantLogout()}
          >
            退出登录 / 切换档口账号
          </button>
        </div>
      )}

      {notice && (
        <div className="merchant-notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            className="merchant-notice__close"
            onClick={() => setNotice(null)}
          >
            关闭
          </button>
        </div>
      )}

      {view.name === 'list' && (
        <OrderListPage
          orders={orders}
          scenario={scenario}
          isSample={mode === 'sample'}
          loading={loading}
          error={ordersError}
          page={orderPageInfo.page}
          pageSize={orderPageInfo.pageSize}
          total={orderPageInfo.total}
          onScenarioChange={changeScenario}
          onPageChange={changeOrderPage}
          onOpenOrder={openOrder}
          onOpenMenu={openMenu}
          onOpenSetup={openSetup}
          onRefresh={refreshOrders}
          refreshing={refreshing}
          lastRefreshedAt={lastRefreshedAt}
          autoRefreshSeconds={AUTO_REFRESH_MS / 1000}
        />
      )}

      {view.name === 'detail' && (
        activeOrder ? (
          <OrderDetailPage
            order={activeOrder}
            mode={mode}
            onBack={backToList}
            onAction={(action, input) => handleAction(activeOrder.id, action, input)}
            onRefresh={() => void refreshOrder(activeOrder.id)}
            refreshing={refreshingOrder}
            pendingCode={pendingCode}
            actionError={actionError}
          />
        ) : (
          <p className="merchant-empty">
            {loading ? '正在读取订单…' : '订单不存在、已不在当前数据源中，或需要登录档口账号。'}
          </p>
        )
      )}

      {view.name === 'menu' && (
        <MenuPage
          dates={dates}
          date={menuDate}
          today={today}
          isSample={mode === 'sample'}
          loading={loading}
          error={menuError}
          onDateChange={setMenuDate}
          menu={menu}
          slots={slots}
          onSaveDish={saveDish}
          onCreateDish={createDish}
          onDeleteDish={deleteDish}
          dishLibrary={dishLibrary}
          dishLibraryLoading={dishLibraryLoading}
          dishLibraryError={dishLibraryError}
          onLoadDishLibrary={loadDishLibrary}
          onSaveDailyMenu={saveDailyMenu}
          onGoSetup={openSetup}
          onSaveSlot={saveSlot}
          onBack={backToList}
        />
      )}

      {view.name === 'setup' && (
        <OnboardingPage
          mode={mode}
          session={session}
          source={source}

          onBack={backToList}
          onCancel={exitMerchant}
        />
      )}

      {view.name === 'my' && (
        <section className='merchant-my' aria-label='我的'>
          <div className='merchant-my__card'>
            <div className='merchant-my__avatar'>{(session?.user.displayName ?? '档').slice(0, 1)}</div>
            <div className='merchant-my__identity'>
              <h3>{session?.user.displayName ?? "未登录"}</h3>
              <p>档口账号 · {roleLabel(session?.user.role ?? 'MERCHANT')}</p>
            </div>
          </div>
          <div className='merchant-my__group'>
            <div className='merchant-my__row'>
              <span>数据源</span>
              <span>{mode === 'sample' ? '样例数据' : '真实 · 演示服务'}</span>
            </div>
            <div className='merchant-my__row'>
              <span>服务地址</span>
              <span>{apiBase.baseUrl ?? '未配置'}</span>
            </div>
            <button type='button' className='merchant-my__row merchant-my__row--action' onClick={openSetup}>
              <span>店铺信息与入驻</span>
              <span className='merchant-my__arrow'>→</span>
            </button>
            {mode === 'real' && merchantLoggedIn && (
              <button type='button' className='merchant-my__row merchant-my__row--action' onClick={() => void handleMerchantLogout()}>
                <span>退出登录 / 切换档口账号</span>
                <span className='merchant-my__arrow'>→</span>
              </button>
            )}
          </div>
          <button type='button' className='merchant-my__exit' onClick={exitMerchant}>返回角色入口</button>
        </section>
      )}

      {merchantLoggedIn && (
      <nav className='merchant-tabbar' aria-label='底部导航'>
        <button
          type='button'
          className={`merchant-tab-item${view.name === 'menu' ? ' is-active' : ''}`}
          onClick={openMenu}
        >
          <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
            <path d='M4 19.5A2.5 2.5 0 0 1 6.5 17H20' />
            <path d='M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' />
          </svg>
          <span>菜单</span>
        </button>
        <button
          type='button'
          className={`merchant-tab-item${view.name === 'list' || view.name === 'detail' ? ' is-active' : ''}`}
          onClick={backToList}
        >
          <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
            <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
            <polyline points='14 2 14 8 20 8' />
            <line x1='16' y1='13' x2='8' y2='13' />
            <line x1='16' y1='17' x2='8' y2='17' />
          </svg>
          <span>订单</span>
        </button>
        <button
          type='button'
          className={`merchant-tab-item${view.name === 'my' || view.name === 'setup' ? ' is-active' : ''}`}
          onClick={openMy}
        >
          <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
            <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
            <circle cx='12' cy='7' r='4' />
          </svg>
          <span>我的</span>
        </button>
      </nav>
      )}
    </section>
  );
}