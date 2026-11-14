import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import SampleBanner from './components/SampleBanner';
import { SAMPLE_DATES } from './data/sampleData';
import { createMerchantSource } from './data/source';
import type {
  CancelDecision,
  DiningMode,
  MenuDay,
  MerchantOrder,
  MerchantScenario,
  OrderAdvanceAction,
  SlotDay,
  SourceResult,
} from './data/types';
import MenuPage from './pages/MenuPage';
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
import { localInputToZonedIso, shortOrderId, statusView } from './state/orderView';
import { menuDatesFor, resolveMenuDate, todayIso } from './state/menuView';
import { demoLogin } from '../../shared/auth';
import { getApiBaseInfo, saveStoredApiBaseUrl } from '../../shared/config';
import { createRequestId } from '../../shared/requestId';
import { getSession, subscribeSession, type Session } from '../../shared/session';
import './merchant.css';

type DataMode = 'sample' | 'real';

const ORDERS_PAGE_SIZE = 20;

type View =
  | { name: 'list' }
  | { name: 'detail'; orderId: string }
  | { name: 'menu' };

export default function MerchantHome() {
  const initialMode: DataMode = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('mode') === 'real'
    ? 'real'
    : 'sample';
  const [mode, setMode] = useState<DataMode>(initialMode);
  const [scenario, setScenario] = useState<MerchantScenario>('normal');
  const [view, setView] = useState<View>({ name: 'list' });
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
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginHint, setLoginHint] = useState<string | null>(null);
  const autoLoginStarted = useRef(false);
  const listScrollTop = useRef(0);
  const restoreListScroll = useRef(false);

  const source = useMemo(() => createMerchantSource({ mode, scenario }), [mode, scenario]);
  const [session, setSession] = useState<Session | null>(getSession);
  const merchantLoggedIn = session?.user.role === 'MERCHANT';
  const apiBase = getApiBaseInfo();
  const devPassword = import.meta.env.DEV
    ? (import.meta.env.VITE_DEMO_MERCHANT_PASSWORD as string | undefined)
    : undefined;
  const devApiBase = import.meta.env.DEV
    ? (import.meta.env.VITE_API_BASE_URL as string | undefined)
    : undefined;

  useEffect(() => subscribeSession(() => setSession(getSession())), []);

  async function loginDemo() {
    if (!devPassword) return;
    setLoginHint('正在使用本地演示凭据登录档口账号…');
    try {
      const loggedIn = await demoLogin('demo-merchant', devPassword);
      setSession(loggedIn);
      setLoginHint(null);
    } catch {
      setLoginHint('本地演示账号自动登录失败；请确认服务地址为 8787、演示密码已注入。');
    }
  }

  useEffect(() => {
    if (!import.meta.env.DEV || !devPassword || autoLoginStarted.current) {
      return;
    }
    autoLoginStarted.current = true;
    if (devApiBase && getApiBaseInfo().baseUrl !== devApiBase) {
      saveStoredApiBaseUrl(devApiBase);
    }
    void loginDemo();
  }, [devPassword, devApiBase]);

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
  }, [source, menuDate, orderPage, session?.user.id, mode, merchantLoggedIn]);

  const activeOrder = view.name === 'detail'
    ? orders.find((order) => order.id === view.orderId) ?? null
    : null;

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
    setView({ name: 'detail', orderId: id });
    setNotice(null);
  }

  function backToList() {
    clearActionState();
    restoreListScroll.current = true;
    setView({ name: 'list' });
    setNotice(null);
  }

  function openMenu() {
    clearActionState();
    setView({ name: 'menu' });
    setNotice(null);
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

  async function refreshOrder(id: string) {
    const result = await source.getOrder(id);
    if (result.ok) {
      setOrders((current) => current.map((item) => (item.id === id ? result.data : item)));
    }
  }

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

  return (
    <section className="module-panel merchant-panel">
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
        <SampleBanner />
      ) : (
        <div className="merchant-real-banner" role="status">
          <strong>真实数据 · 演示服务（DRAFT v0.3 联调候选）</strong>
          <span>服务地址：{apiBase.baseUrl ?? '未配置'}{apiBase.problem ? `（${apiBase.problem}）` : ''}</span>
          {loginHint && <span>{loginHint}</span>}
          {!merchantLoggedIn && devPassword && (
            <button type="button" className="merchant-link-button" onClick={() => void loginDemo()}>
              一键登录演示档口
            </button>
          )}
          <span>
            读取 GET /menu 与 GET /merchant/orders，失败不回退样例。
            {merchantLoggedIn
              ? ` 当前档口账号：${session?.user.displayName ?? ''}`
              : ' 菜单与订单都需先登录档口演示账号；未登录不展示任何档口数据。'}
          </span>
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
        />
      )}

      {view.name === 'detail' && (
        activeOrder ? (
          <OrderDetailPage
            order={activeOrder}
            mode={mode}
            onBack={backToList}
            onAction={(action, input) => handleAction(activeOrder.id, action, input)}
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
          onBack={backToList}
        />
      )}
    </section>
  );
}