import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { SAMPLE_DATES } from './data/sampleData';
import { createMerchantSource } from './data/source';
import type {
  CancelDecision,
  CreateDishInput,
  DailyMenuSelection,

  Dish,
  MenuDay,
  MerchantOrder,
  MerchantProfile,
  MerchantScenario,
  OrderAdvanceAction,
  PackagingFeeSetting,

  SlotDay,
  WalletSummary,

  SourceResult,
} from './data/types';
import MenuPage from './pages/MenuPage';
import HomePage from './pages/HomePage';
import MerchantLoginPage from './pages/MerchantLoginPage';
import MerchantMyInfoPage from './pages/MerchantMyInfoPage';
import OnboardingPage from './pages/OnboardingPage';
import SourceSelectPage from './pages/SourceSelectPage';
import WalletPage from './pages/WalletPage';
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
import { formatClock, localInputToZonedIso, orderNoLabel, statusView } from './state/orderView';
import type { DishPatch } from './state/menuEdit';
import { menuDatesFor, resolveMenuDate, todayIso } from './state/menuView';
import { resolveEffectiveMerchantName } from './state/onboarding';
import {
  loadPackagingFeeSetting,
  parsePackagingFeeText,
  packagingFeeSummary,
  savePackagingFeeSetting,

} from './state/packagingFee';
import { formatYuan } from './utils/money';
import { logout } from '../../shared/auth';

import { getApiBaseInfo } from '../../shared/config';
import { createRequestId } from '../../shared/requestId';
import { getSession, subscribeSession, clearSession, type Session } from '../../shared/session';
import merchantAvatar from './assets/merchant-avatar-default.webp';
import './merchant.css';
import './merchant.v4.css';
import './merchant.v2.css';
import './merchant.v2-fix.css';

type DataMode = 'sample' | 'real';

const DATA_MODE_STORAGE_KEY = 'merchant-data-mode-v1';

function readStoredDataMode(): DataMode | null {
  try {
    const raw = window.localStorage.getItem(DATA_MODE_STORAGE_KEY);
    return raw === 'real' || raw === 'sample' ? raw : null;
  } catch {
    return null;
  }
}

function persistDataMode(next: DataMode): void {
  try {
    window.localStorage.setItem(DATA_MODE_STORAGE_KEY, next);
  } catch {
    // 存储不可用时只影响下次进入的默认模式，不影响本次会话。
  }
}

const ORDERS_PAGE_SIZE = 20;
const AUTO_REFRESH_MS = 15000;
const MERCHANT_ROUTE = '/merchant';
const MENU_ROUTE = `${MERCHANT_ROUTE}/menu`;
const SETUP_ROUTE = `${MERCHANT_ROUTE}/setup`;
const SOURCE_ROUTE = `${MERCHANT_ROUTE}/source`;
const ORDERS_ROUTE = `${MERCHANT_ROUTE}/orders`;
const ORDER_ROUTE_PREFIX = `${ORDERS_ROUTE}/`;
const MY_ROUTE = `${MERCHANT_ROUTE}/my`;
const MY_INFO_ROUTE = `${MERCHANT_ROUTE}/my/info`;
const WALLET_ROUTE = `${MERCHANT_ROUTE}/wallet`;

type View =
  | { name: 'home' }
  | { name: 'list' }
  | { name: 'detail'; orderId: string }
  | { name: 'menu' }
  | { name: 'setup' }
  | { name: 'source' }
  | { name: 'my' }
  | { name: 'my-info' }
  | { name: 'wallet' };

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
  if (route === SETUP_ROUTE) return { name: 'setup' };
  if (route === MERCHANT_ROUTE) return { name: 'home' };
  if (route === SOURCE_ROUTE) return { name: 'source' };
  if (route === MENU_ROUTE) return { name: 'menu' };
  if (route === ORDERS_ROUTE) return { name: 'list' };
  if (route === MY_ROUTE) return { name: 'my' };
  if (route === MY_INFO_ROUTE) return { name: 'my-info' };
  if (route === WALLET_ROUTE) return { name: 'wallet' };
  const orderId = orderIdFromRoute(route);
  if (orderId) return { name: 'detail', orderId };
  return { name: 'list' };
}

export default function MerchantHome() {
  const urlMode = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('mode')
    : null;
  const initialMode: DataMode = urlMode === 'real' || urlMode === 'sample'
    ? urlMode
    : (readStoredDataMode() ?? 'sample');
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
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletUnavailable, setWalletUnavailable] = useState(false);
  const [walletUnavailableMessage, setWalletUnavailableMessage] = useState<string | null>(null);
  const [withdrawInFlight, setWithdrawInFlight] = useState(false);
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ code: string; message: string; orderId?: string } | null>(null);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionRequestIds = useRef(new Map<string, string>());
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [homeOrders, setHomeOrders] = useState<MerchantOrder[]>([]);
  const [homeOrdersLoading, setHomeOrdersLoading] = useState(false);
  const [orderPage, setOrderPage] = useState(1);
  const [orderGroupKey, setOrderGroupKey] = useState('new');
  const [orderPageInfo, setOrderPageInfo] = useState({ page: 1, pageSize: ORDERS_PAGE_SIZE, total: 0 });
  const [menu, setMenu] = useState<MenuDay | null>(null);
  const [slots, setSlots] = useState<SlotDay | null>(null);
  const [mySlots, setMySlots] = useState<SlotDay | null>(null);
  const [packagingSetting, setPackagingSetting] = useState<PackagingFeeSetting>(
    () => loadPackagingFeeSetting(initialMode),
  );
  const [packagingOpen, setPackagingOpen] = useState(false);
  const [packagingDraftEnabled, setPackagingDraftEnabled] = useState(false);
  const [packagingFeeInput, setPackagingFeeInput] = useState('1.00');
  const [packagingFeedback, setPackagingFeedback] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [logoutConfirming, setLogoutConfirming] = useState(false);
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
  const businessDate = mode === 'sample' ? SAMPLE_DATES[0] : today;
  const isFlowView = view.name === 'setup' || view.name === 'source';
  const [session, setSession] = useState<Session | null>(getSession);
  const merchantLoggedIn = session?.user.role === 'MERCHANT';
  const apiBase = getApiBaseInfo();
  const devPassword = import.meta.env.DEV
    ? (import.meta.env.VITE_DEMO_MERCHANT_PASSWORD as string | undefined)
    : undefined;


  useEffect(() => subscribeSession(() => setSession(getSession())), []);

  useEffect(() => {
    persistDataMode(mode);
  }, [mode]);

  useEffect(() => {
    const stored = loadPackagingFeeSetting(mode);
    setPackagingSetting(stored);
    setPackagingDraftEnabled(stored.enabled);
    setPackagingFeeInput((stored.feeFen / 100).toFixed(2));
    setPackagingFeedback(null);
  }, [mode]);

  useEffect(() => {
    if (view.name !== 'wallet') return;
    let cancelled = false;
    setWalletLoading(true);
    setWalletError(null);
    setWalletUnavailable(false);
    setWalletUnavailableMessage(null);
    void (async () => {
      const result = await source.getWallet();
      if (cancelled) return;
      setWalletLoading(false);
      if (result.ok) {
        setWallet(result.data);
        setWalletUnavailable(false);
        setWalletUnavailableMessage(null);
      } else if (result.error.code === 'NOT_IMPLEMENTED') {
        setWalletUnavailable(true);
        setWalletUnavailableMessage(result.error.message);
        setWalletError(null);
      } else {
        setWalletUnavailable(false);
        setWalletUnavailableMessage(null);
        setWalletError(result.error.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view.name, source]);

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
      } else if (route === SETUP_ROUTE) {
        setView({ name: 'setup' });
        setNotice(null);
      } else if (route === SOURCE_ROUTE) {
        setView({ name: 'source' });
        setNotice(null);
      } else if (route === MERCHANT_ROUTE) {
        setView({ name: 'home' });
        setNotice(null);
      } else if (route === ORDERS_ROUTE) {
        setView({ name: 'list' });
      } else if (route === MY_ROUTE) {
        setView({ name: 'my' });
        setNotice(null);
      } else if (route === MY_INFO_ROUTE) {
        setView({ name: 'my-info' });
        setNotice(null);
      } else if (route === WALLET_ROUTE) {
        setView({ name: 'wallet' });
        setNotice(null);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function handleMerchantLoggedIn() {
    clearActionState();
    setNotice(null);
    setView({ name: 'home' });
    setOrderPage(1);
    setDataVersion((current) => current + 1);
    if (merchantRoute() !== MERCHANT_ROUTE) {
      window.location.hash = MERCHANT_ROUTE;
    }
  }

  async function handleMerchantLogout() {
    clearActionState();
    setNotice(null);
    setLogoutConfirming(false);
    if (mode === 'real') {
      try {
        await logout();
      } catch {
        // logout 已在 finally 清除本地会话；服务端不可达时同样回角色入口。
      }
    } else {
      clearSession();
    }
    window.location.hash = '/';
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);

    setOrdersError(null);
    setMenuError(null);
    setOrders([]);
    setMenu(null);
    setSlots(null);
    setProfileError(null);
    setProfileLoading(mode === 'real' && merchantLoggedIn);
    if (mode === 'sample') {
      setProfile(null);
    }

    if (mode === 'real' && !merchantLoggedIn) {
      setProfile(null);
      setProfileLoading(false);
      setOrdersError('真实模式需要先登录档口演示账号，未登录不读取订单与菜单。');
      setMenuError('真实模式需要先登录档口演示账号，未登录不读取订单与菜单。');
      setOrderPageInfo({ page: 1, pageSize: ORDERS_PAGE_SIZE, total: 0 });
      setLoading(false);
      setProfileLoading(false);
      return () => {
        alive = false;
      };
    }
    void (async () => {
      const [ordersResult, menuResult, slotsResult, profileResult] = await Promise.all([
        source.getOrders(orderPage, ORDERS_PAGE_SIZE),
        source.getMenu(menuDate),
        source.getSlots(menuDate),
        source.getProfile(),
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

      }
      if (profileResult.ok) {
        setProfile(profileResult.data);
        setProfileError(null);
      } else {
        setProfileError(profileResult.error.message);
      }
      setProfileLoading(false);
      setLoading(false);
      setProfileLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [source, menuDate, orderPage, session?.user.id, mode, merchantLoggedIn, dataVersion]);

  useEffect(() => {
    if (view.name !== 'home') return;
    if (mode === 'real' && !merchantLoggedIn) return;
    let alive = true;
    setHomeOrdersLoading(true);
    void (async () => {
      const result = await source.getOrders(1, 100);
      if (!alive) return;
      if (result.ok) setHomeOrders(result.data.orders);
      setHomeOrdersLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [view.name, source, mode, merchantLoggedIn, dataVersion, session?.user.id]);

  useEffect(() => {
    if (view.name !== 'my') return;
    if (mode === 'real' && !merchantLoggedIn) return;
    let alive = true;
    void (async () => {
      const result = await source.getSlots(businessDate);
      if (!alive) return;
      setMySlots(result.ok ? result.data : null);
    })();
    return () => {
      alive = false;
    };
  }, [view.name, source, businessDate, mode, merchantLoggedIn, dataVersion]);

  const activeOrder = view.name === 'detail'
    ? orders.find((order) => order.id === view.orderId) ?? null
    : null;
  const accountDisplayName = session?.user.role === 'MERCHANT'
    ? (session.user.displayName?.trim() || null)
    : null;
  const merchantName = profile?.merchant
    ? resolveEffectiveMerchantName({
      mode,
      session,
      serverMerchantName: profile.merchant.name,
    })
    : null;
  const myShopName = profile?.shop?.name ?? merchantName ?? accountDisplayName ?? '我的档口';
  const hasShop = Boolean(profile?.shop);
  const myOpenSlots = (mySlots?.slots ?? []).filter((slot) => slot.enabled);
  const myIsOpen = myOpenSlots.length > 0;
  const myHours = myOpenSlots.length > 0
    ? `${formatClock(myOpenSlots[0].slotStart)}—${formatClock(myOpenSlots[myOpenSlots.length - 1].slotEnd)}`
    : '未设置营业时段';
  const businessDateLabel = businessDate.split('-').length === 3
    ? `${Number(businessDate.split('-')[1])}月${Number(businessDate.split('-')[2])}日`
    : businessDate;

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
    setOrderGroupKey('new');
    if (merchantRoute() !== ORDERS_ROUTE) {
      window.location.hash = ORDERS_ROUTE;
    }
    restoreListScroll.current = true;
    setView({ name: 'list' });
    setNotice(null);
  }

  function openOrders(groupKey: string) {
    backToList();
    setOrderGroupKey(groupKey);
  }

  function openMenu() {
    clearActionState();
    setDataVersion((current) => current + 1);
    window.location.hash = MENU_ROUTE;
    setView({ name: 'menu' });
    setNotice(null);
  }

  function openHome() {
    clearActionState();
    window.location.hash = MERCHANT_ROUTE;
    setView({ name: 'home' });
    setNotice(null);
  }

  function openSetup() {
    clearActionState();
    window.location.hash = SETUP_ROUTE;
    setView({ name: 'setup' });
    setNotice(null);
  }

  function openSource() {
    clearActionState();
    window.location.hash = SOURCE_ROUTE;
    setView({ name: 'source' });
    setNotice(null);
  }

  function chooseMode(next: DataMode) {
    if (next === mode) {
      setView({ name: 'list' });
      window.location.hash = ORDERS_ROUTE;
      setNotice(null);
      return;
    }
    changeMode(next);
  }

  function openMy() {
    clearActionState();
    setLogoutConfirming(false);
    window.location.hash = MY_ROUTE;
    setView({ name: 'my' });
    setNotice(null);
  }
  function openWallet() {
    clearActionState();
    window.location.hash = WALLET_ROUTE;
    setView({ name: 'wallet' });
    setNotice(null);
  }

  function openMyInfo() {
    clearActionState();
    window.location.hash = MY_INFO_ROUTE;
    setView({ name: 'my-info' });
    setNotice(null);
  }

  function togglePackagingPanel() {
    if (!packagingOpen) {
      setPackagingDraftEnabled(packagingSetting.enabled);
      setPackagingFeeInput((packagingSetting.feeFen / 100).toFixed(2));
      setPackagingFeedback(null);
    }
    setPackagingOpen((current) => !current);
  }

  function savePackagingSettings() {
    const parsed = parsePackagingFeeText(packagingFeeInput);
    if (!parsed.ok) {
      setPackagingFeedback({ tone: 'error', text: parsed.error });
      return;
    }
    if (packagingDraftEnabled && parsed.feeFen <= 0) {
      setPackagingFeedback({
        tone: 'error',
        text: '开启收费时，打包盒价格需大于 0 元；不收费请关闭开关。',
      });
      return;
    }
    const next: PackagingFeeSetting = {
      enabled: packagingDraftEnabled,
      feeFen: parsed.feeFen,
    };
    const saved = savePackagingFeeSetting(mode, next);
    if (!saved.ok) {
      setPackagingFeedback({ tone: 'error', text: saved.error });
      return;
    }
    setPackagingSetting(next);
    setPackagingFeedback({
      tone: 'info',
      text: mode === 'sample'
        ? `已保存到本机样例设置：${packagingFeeSummary(next)}。样例订单金额不会随设置重算。`
        : `已保存在本机：${packagingFeeSummary(next)}。真实服务尚未提供打包费字段，本次不会同步到服务端，学生端也暂不会加收。`,
    });
  }

  async function handleWithdrawDemo(amountFen: number) {
    if (withdrawInFlight) return;
    setWithdrawInFlight(true);
    const result = await source.withdrawWallet({ amountFen, requestId: createRequestId('merchant-wallet') });
    setWithdrawInFlight(false);
    if (result.ok) {
      setWallet(result.data);
      setNotice(`演示提现成功：${formatYuan(amountFen)} 已从样例余额扣除。`);
    } else {
      setWalletError(result.error.message);
    }
  }


  function handleAction(orderId: string, action: OrderAction, input: ActionInput = {}) {
    if (pendingCode !== null) return;
    const validation = validateActionInput(action, input, mode);
    if (validation) {
      setActionError({ code: action.code, message: validation, orderId });
      setNotice(null);
      return;
    }
    setActionError(null);
    setNotice(null);
    const order = orders.find((item) => item.id === orderId) ?? null;
    if (mode === 'real' && isRealWriteAction(action)) {
      if (!order) {
        setActionError({ code: action.code, message: '订单不在当前列表中，请返回列表刷新后重试。', orderId });
        return;
      }
      void runRealWrite(order, action, input);
      return;
    }
    setPendingCode(action.code);
    setPendingOrderId(orderId);
    actionTimer.current = setTimeout(() => {
      actionTimer.current = null;
      setPendingCode(null);
      setPendingOrderId(null);
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

  useEffect(() => {
    if (view.name !== 'source') return;
    if (profile === null || profile.merchant) return;
    window.location.hash = MERCHANT_ROUTE;
    setView({ name: 'setup' });
  }, [view.name, profile]);

  async function runRealWrite(order: MerchantOrder, action: OrderAction, input: ActionInput) {
    const key = `${order.id}:${action.code}`;
    const requestId = actionRequestIds.current.get(key) ?? createRequestId('merchant-write');
    actionRequestIds.current.set(key, requestId);
    setPendingCode(action.code);
    setPendingOrderId(order.id);
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

    } else {
      setPendingCode(null);
      setPendingOrderId(null);
      setNotice(actionPrompt(action, order.id, mode, input));
      return;
    }
    setPendingCode(null);
    setPendingOrderId(null);
    if (result.ok) {
      for (const storedKey of [...actionRequestIds.current.keys()]) {
        if (storedKey.startsWith(`${order.id}:`)) {
          actionRequestIds.current.delete(storedKey);
        }
      }
      const updated = result.data;
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setNotice(
        `${action.label}成功：订单 ${orderNoLabel(updated)} 状态为「${statusView(updated.status).label}」，版本 v${updated.version}。`,
      );
      void refreshOrders({ silent: true });
      return;
    }
    setActionError({
      code: action.code,
      message: actionErrorText(result.error.code, result.error.message, action),
      orderId: order.id,
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
    const result = await source.createDish({ ...input, date: menuDate } as CreateDishInput & { date?: string });
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
      setNotice(mode === 'sample'
        ? `样例菜单已更新（仅当前页面内存）：上架 ${result.data.dishes.length} 道菜；未勾选的菜品不会出现在学生端。`
        : `今日菜单已保存：上架 ${result.data.dishes.length} 道菜；未勾选的菜品不会出现在学生端。`);
    }
    return result;
  }

  async function saveSlot(
    slot: SlotDay['slots'][number],
    patch: { capacity: number; enabled: boolean },
    requestId: string,
  ) {
    const result = await source.updateSlot(menuDate, slot.slotId, {
      requestId,
      expectedVersion: slot.version,
      capacity: patch.capacity,
      enabled: patch.enabled,
    });
    if (result.ok) {
      setSlots((current) => (current
        ? {
          ...current,
          slots: current.slots.map((item) => (item.slotId === result.data.slotId ? result.data : item)),
        }
        : current));
      setNotice(
        `时段已更新：${formatClock(result.data.slotStart)}—${formatClock(result.data.slotEnd)}，名额 ${result.data.capacity}，已占 ${result.data.occupied}。`,
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
    <section data-merchant-view={view.name} className={`module-panel merchant-panel${view.name === 'list' ? ' merchant-panel--order-list' : ''}${view.name === 'detail' && activeOrder?.status === 'NEW' ? ' merchant-panel--new-order-detail' : ''}${view.name === 'menu' && mode === 'sample' ? ' merchant-panel--sample-menu' : ''}${view.name === 'setup' ? ' merchant-panel--onboarding' : ''}${view.name === 'source' ? ' merchant-panel--source' : ''}`}>
      <div className="merchant-source">
        <span className="merchant-source__label">数据源</span>
        <button
          type="button"
          className={mode === 'sample' ? 'merchant-source__button merchant-source__button--active' : 'merchant-source__button'}
          aria-pressed={mode === 'sample'}
          onClick={() => changeMode('sample')}
        >
          样例
        </button>
        <button
          type="button"
          className={mode === 'real' ? 'merchant-source__button merchant-source__button--active' : 'merchant-source__button'}
          aria-pressed={mode === 'real'}
          onClick={() => changeMode('real')}
        >
          真实 · 演示服务
        </button>
      </div>

      {mode === 'sample' || isFlowView || view.name === 'home' ? null : (
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

      {view.name === 'home' && (
        <HomePage
          mode={mode}
          statDate={businessDate}
          profile={profile}
          merchantDisplayName={accountDisplayName}
          orders={homeOrders}
          slots={slots}
          loading={homeOrdersLoading || loading}
          onOpenOrders={openOrders}
          onOpenMenu={openMenu}
        />
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
          activeGroupKey={orderGroupKey}
          onGroupChange={setOrderGroupKey}
          onScenarioChange={changeScenario}
          onPageChange={changeOrderPage}
          onOpenOrder={openOrder}
          onAction={(orderId, action, input) => handleAction(orderId, action, input)}
          pendingCode={pendingCode}
          pendingOrderId={pendingOrderId}
          actionError={actionError}
          onOpenMenu={openMenu}

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
          onSaveDish={saveDish}
          onCreateDish={createDish}
          onDeleteDish={deleteDish}
          dishLibrary={dishLibrary}
          dishLibraryLoading={dishLibraryLoading}
          dishLibraryError={dishLibraryError}
          onLoadDishLibrary={loadDishLibrary}
          onSaveDailyMenu={saveDailyMenu}
          onUploadDishImage={(dataUrl, requestId) => source.uploadDishImage(dataUrl, requestId)}
          slots={slots}
          onSaveSlot={saveSlot}
          onGoSetup={openSetup}
        />
      )}

      {view.name === 'setup' && (
        <OnboardingPage
          mode={mode}
          session={session}
          source={source}
          profile={profile}
          profileLoading={profileLoading}
          profileError={profileError}
          onProfileChange={setProfile}


          onBack={backToList}
          onCancel={backToList}
          onComplete={openSource}
        />
      )}

      {view.name === 'source' && (
        <SourceSelectPage
          mode={mode}
          merchantName={merchantName}
          shopName={profile?.shop?.name ?? null}
          onSelectSample={() => chooseMode('sample')}
          onSelectReal={() => chooseMode('real')}
        />
      )}

      {view.name === 'my' && (
        <section className='merchant-my' aria-label='我的'>
          <header className='merchant-view__header'>
            <h2>我的</h2>

          </header>
          <div className='merchant-my__card'>
            <div className='merchant-my__avatar'>
              <img src={merchantAvatar} alt='商家头像' />
            </div>
            <div className='merchant-my__identity'>
              <div className='merchant-my__name-row'>
                <h3>{myShopName}</h3>
                <span className={myIsOpen ? 'merchant-my__status is-open' : 'merchant-my__status'}>
                  <i />
                  {myIsOpen ? '营业中' : '休息中'}
                </span>
              </div>
              <small>
                {merchantName ?? accountDisplayName ?? (mode === 'sample' ? '档口演示账号' : '未登录')}
                {mode === 'sample' ? ` · 演示日 ${businessDateLabel}` : ' · 今日营业'}
              </small>
            </div>
          </div>

          <div className='merchant-my__group' data-my-profile>
            <h3 className='merchant-my__group-title'>个人信息</h3>
            <div className='merchant-my__row'>
              <span>商家名称</span>
              <span>{profileLoading ? '读取中…' : merchantName || '未填写'}</span>
            </div>
            <div className='merchant-my__row'>
              <span>店铺负责人</span>
              <span>{profileLoading ? '读取中…' : profile?.merchant?.contactName || '未填写'}</span>
            </div>
            <div className='merchant-my__row'>
              <span>联系电话</span>
              <span>{profileLoading ? '读取中…' : profile?.merchant?.contactPhone || '未填写'}</span>
            </div>
            <button type='button' className='merchant-my__row merchant-my__row--action' onClick={openMyInfo}>
              <span>我的信息</span>
              <span className='merchant-my__arrow'>→</span>
            </button>
          </div>

          <div className='merchant-my__group'>
            <h3 className='merchant-my__group-title'>店铺信息</h3>
            <div className='merchant-my__row'>
              <span>店铺名称</span>
              <span>{profileLoading ? '读取中…' : profile?.shop?.name || '未创建店铺'}</span>
            </div>
            <div className='merchant-my__row'>
              <span>档口位置</span>
              <span>{profileLoading ? '读取中…' : profile?.shop?.location || '未填写'}</span>
            </div>
            <button type='button' className='merchant-my__row merchant-my__row--action' onClick={openSetup}>
              <span>{profile?.onboardingStep === 'SHOP_CREATED' ? '编辑店铺资料' : '店铺信息与入驻'}</span>
              <span className='merchant-my__arrow'>→</span>
            </button>
          </div>

          <div className='merchant-my__group'>
            <h3 className='merchant-my__group-title'>营业设置</h3>
            <div className='merchant-my__row'>
              <span>今日营业时段</span>
              <span>{myHours}</span>
            </div>
            <div className='merchant-my__row'>
              <span>营业状态</span>
              <span>{myIsOpen ? '已开放接单' : '未开放接单'}</span>
            </div>
            <div className='merchant-my__row'>
              <span>打包盒收费</span>
              <span data-packaging-summary>{packagingFeeSummary(packagingSetting)}</span>
            </div>
            <button
              type='button'
              className='merchant-my__row merchant-my__row--action'
              onClick={togglePackagingPanel}
              aria-expanded={packagingOpen}
              aria-controls='merchant-packaging-panel'
            >
              <span>设置打包盒收费</span>
              <span className='merchant-my__arrow'>{packagingOpen ? '收起' : '→'}</span>
            </button>
            {packagingOpen && (
              <div className='merchant-my__packaging' id='merchant-packaging-panel' data-packaging-panel>
                <label className='merchant-my__packaging-switch'>
                  <input
                    type='checkbox'
                    checked={packagingDraftEnabled}
                    onChange={(event) => {
                      setPackagingDraftEnabled(event.target.checked);
                      setPackagingFeedback(null);
                    }}
                    data-packaging-enabled
                  />
                  <span>外带订单收取打包盒费</span>
                </label>
                <label className='merchant-my__packaging-fee'>
                  <span>打包盒单价</span>
                  <input
                    value={packagingFeeInput}
                    onChange={(event) => {
                      setPackagingFeeInput(event.target.value);
                      setPackagingFeedback(null);
                    }}
                    inputMode='decimal'
                    maxLength={5}
                    disabled={!packagingDraftEnabled}
                    data-packaging-fee
                  />
                  <span>元 / 单</span>
                </label>
                <button
                  type='button'
                  className='action-button action-button--primary merchant-my__packaging-save'
                  onClick={savePackagingSettings}
                  data-packaging-save
                >
                  保存打包盒设置
                </button>
                <p className='merchant-my__note'>
                  每笔外带订单只收一次，堂食不收；价格由商家自定（0.01—50 元）。
                  {mode === 'real' ? ' 真实服务尚未提供打包费字段，当前设置只保存在本机。' : ''}
                </p>
                {packagingFeedback && (
                  <p
                    className={`merchant-my__packaging-feedback${packagingFeedback.tone === 'error' ? ' is-error' : ''}`}
                    role={packagingFeedback.tone === 'error' ? 'alert' : 'status'}
                    data-packaging-feedback
                    data-feedback-tone={packagingFeedback.tone}
                  >
                    {packagingFeedback.text}
                  </p>
                )}
              </div>
            )}
            <button
              type='button'
              className='merchant-my__row merchant-my__row--action'
              onClick={() => {
                if (!hasShop) {
                  openSetup();
                  return;
                }
                setMenuDate(businessDate);
                openMenu();
              }}
            >
              <span>{hasShop ? '菜单与时段设置' : '先去完善店铺资料'}</span>
              <span className='merchant-my__arrow'>→</span>
            </button>
            {!hasShop && (
              <p className='merchant-my__note'>完成店铺资料后，营业时段与菜单上架才会对学生端生效。</p>
            )}
          </div>

          <div className='merchant-my__group'>
            <h3 className='merchant-my__group-title'>钱包</h3>
            <button type='button' className='merchant-my__row merchant-my__row--action' onClick={openWallet}>
              <span>钱包</span>
              <span className='merchant-my__row-side'>
                {mode === 'sample' ? '样例余额' : '暂未接通'}
                <span className='merchant-my__arrow'>→</span>
              </span>
            </button>
          </div>

          <details className='merchant-my__fold'>
            <summary>系统信息与开发调试</summary>
            <div className='merchant-my__fold-body'>
              <div className='merchant-my__row'>
                <span>数据源</span>
                <span>{mode === 'sample' ? '本地样例数据' : '真实 · 演示服务'}</span>
              </div>
              <div className='merchant-my__row'>
                <span>服务地址</span>
                <span>{apiBase.baseUrl ?? '未配置'}</span>
              </div>
              <div className='merchant-my__row'>
                <span>登录账号</span>
                <span>{session?.user.displayName ?? '未登录'}</span>
              </div>
              <p className='merchant-my__note'>
                {mode === 'sample'
                  ? '样例菜单、库存与订单保存在当前页面内存，刷新后还原；菜品图片与口味选项保存在本机浏览器。'
                  : '菜单、订单与账号资料来自演示服务；菜品图片与口味选项暂存在本机，尚未同步到服务端。'}
              </p>
            </div>
          </details>

          <div className='merchant-my__group merchant-my__group--signout'>
            {logoutConfirming ? (
              <div className='merchant-my__confirm'>
                <p>退出后将返回角色入口，需要重新登录档口账号；当前未保存的编辑会丢失。</p>
                <div className='action-bar'>
                  <button
                    type='button'
                    className='action-button action-button--danger'
                    onClick={() => void handleMerchantLogout()}
                  >
                    确认退出
                  </button>
                  <button type='button' className='action-button' onClick={() => setLogoutConfirming(false)}>
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                type='button'
                className='merchant-my__row merchant-my__row--action merchant-my__row--danger'
                onClick={() => setLogoutConfirming(true)}
              >
                <span>退出登录</span>
                <span className='merchant-my__arrow'>→</span>
              </button>
            )}
          </div>
        </section>
      )}
      {view.name === 'my-info' && (
        <MerchantMyInfoPage
          mode={mode}
          session={session}
          source={source}
          profile={profile}
          onProfileChange={(nextProfile) => {
            setProfile(nextProfile);
            setDataVersion((current) => current + 1);
          }}
          onBack={openMy}
        />
      )}
      {view.name === 'wallet' && (
        <WalletPage
          mode={mode}
          wallet={wallet}
          loading={walletLoading}
          error={walletError}
          walletUnavailable={walletUnavailable}
          walletUnavailableMessage={walletUnavailableMessage}
          withdrawInFlight={withdrawInFlight}
          onWithdraw={(amountFen) => void handleWithdrawDemo(amountFen)}
          onBack={openMy}
        />
      )}

      {(merchantLoggedIn || mode === 'sample') && view.name !== 'source' && (
      <nav className='merchant-tabbar' aria-label='底部导航'>
        <button
          type='button'
          className={`merchant-tab-item${view.name === 'home' ? ' is-active' : ''}`}
          onClick={openHome}
        >
          <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
            <path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' />
            <polyline points='9 22 9 12 15 12 15 22' />
          </svg>
          <span>首页</span>
        </button>
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
          className={`merchant-tab-item${view.name === 'my' ? ' is-active' : ''}`}
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