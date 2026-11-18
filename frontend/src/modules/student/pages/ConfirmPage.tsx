import { useEffect, useState } from 'react';
import type { OrderDraft } from '../state/orderDraft';
import { useStudentSessionGate } from '../state/useStudentSessionGate';
import type { DemoScenario, DishDto, DraftItemInput, MenuResponse, ShopSummary, SlotDto, StudentSource } from '../types';
import { sanitizeMessage } from '../utils/errorSemantics';
import { filterDishesByShop } from '../utils/dishShopFilter';
import { formatYuan } from '../utils/money';
import { toSubmitErrorView } from '../utils/orderSubmitView';
import { resolveDishPhoto } from '../utils/orderVisuals';
import { ORDER_REMARK_MAX_LENGTH } from '../utils/remark';
import DemoModeNotice from '../components/DemoModeNotice';
import LoginGuide from '../components/LoginGuide';
import RealModeNotice from '../components/RealModeNotice';
import dishChickenLeg from '../assets/dish-chicken-leg.png';
import '../confirm-order.css';

type LoadStatus = 'loading' | 'ready' | 'error';

const MODE_TEXT = {
  DINE_IN: '堂食',
  TAKEAWAY: '外带',
} as const;

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

const SCENARIO_OPTIONS: Array<{ value: DemoScenario; label: string; hint: string }> = [
  { value: 'normal', label: '正常提交', hint: '按样例规则返回订单' },
  { value: 'slot-full', label: '时段不可用', hint: '提交返回时段不可用' },
  { value: 'out-of-stock', label: '菜品不足', hint: '提交返回菜品不足' },
  { value: 'timeout', label: '提交超时', hint: '提交超时，结果待确认' },
];

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function TitleRaysSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 26" fill="none" aria-hidden="true">
      <path d="M5 12L7.5 3.5" stroke="currentColor" strokeWidth="3.1" strokeLinecap="round" />
      <path d="M11.5 15.5L19.5 8.5" stroke="currentColor" strokeWidth="3.1" strokeLinecap="round" />
      <path d="M14 20.5L23.5 18.5" stroke="currentColor" strokeWidth="2.9" strokeLinecap="round" />
    </svg>
  );
}

function LeadRaysSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <path d="M18 11L13.5 3.8" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M14.5 15L6.5 10.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M14 19.5L5.2 20.2" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" />
    </svg>
  );
}

function TitleUnderlineSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 176 14" fill="none" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M3 8.5C44 3.2 118 2.8 172 6.8"
        stroke="#f5bb20"
        strokeWidth="4.4"
        strokeLinecap="round"
      />
      <path
        d="M92 11.6C120 10.1 149 9.8 173 10.8"
        stroke="#f5bb20"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PriceUnderlineSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 9" fill="none" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M2 6.2C38 2.4 98 2.2 138 5.4"
        stroke="#f5bb20"
        strokeWidth="3.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeroClocheSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 96 80" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform="rotate(8 48 46)">
        {/* 筷子/餐具 */}
        <path d="M62 34L77 10" />
        <path d="M67 37L82 13" />
        {/* 蒸汽 */}
        <path d="M35 19c-1.5-3 1-5.5 0-8" />
        <path d="M44 16c-1.5-3 1-5.5 0-8" />
        {/* 顶部圆钮 */}
        <path d="M47 24a4 4 0 1 1 6 0" />
        {/* 餐盖弧顶 */}
        <path d="M18 52c2-17 15-28 32-28s30 11 32 28" />
        {/* 托盘双层底边 */}
        <path d="M11 52h78" />
        <path d="M15 57h70c-3 3-9 4.5-35 4.5S18 60 15 57Z" />
      </g>
    </svg>
  );
}

function ShopAwningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9.5L5 4h14l2 5.5" />
      <path d="M3 9.5a2.6 2.6 0 0 0 4.5 1.7 2.6 2.6 0 0 0 4.5 0 2.6 2.6 0 0 0 4.5 0A2.6 2.6 0 0 0 21 9.5" />
      <path d="M5 12.2V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.8" />
      <path d="M9.5 20.5v-4.5h5v4.5" />
    </svg>
  );
}

function BowlChopsticksWatermark() {
  return (
    <svg viewBox="0 0 44 40" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M24 18L36 5" />
      <path d="M28 19L40 8" />
      <ellipse cx="20" cy="19" rx="14" ry="4.2" />
      <path d="M6 19c0 8.5 6.2 14.5 14 14.5S34 27.5 34 19" />
      <path d="M14 33.5v2.5h12v-2.5" />
      <path d="M11 19c3-1.6 6.5-1.6 9.5 0s6 1.6 9 0" />
    </svg>
  );
}

function CalendarWatermark() {
  return (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform="rotate(9 20 20)">
        <rect x="7" y="8" width="26" height="24" rx="3.5" />
        <path d="M14 5.5v5M26 5.5v5M7 15h26" />
        <circle cx="14" cy="20.5" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="20" cy="20.5" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="26" cy="20.5" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="14" cy="25.5" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="20" cy="25.5" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="26" cy="25.5" r="0.9" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

function PencilWatermark() {
  return (
    <svg viewBox="0 0 38 38" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M25.5 7.5l5 5L14 29l-6.5 1.5L9 24 25.5 7.5Z" />
      <path d="M22.5 10.5l5 5" />
      <path d="M9.5 23.5l5 5" />
    </svg>
  );
}

function CalendarRowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
      <path d="m9.5 15 1.8 1.8 3.4-3.4" />
    </svg>
  );
}

function ClockRowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3.2 2" />
    </svg>
  );
}

function BagRowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5.5 8h13l-1 12.2a1.5 1.5 0 0 1-1.5 1.3H8a1.5 1.5 0 0 1-1.5-1.3L5.5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}

function MiniClocheIcon() {
  return (
    <svg viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5.5c-.6-1.4.6-2.4 0-3.6M15.5 5.5c-.6-1.4.6-2.4 0-3.6" />
      <path d="M12.2 9.2a1.8 1.8 0 0 1 3.6 0" />
      <path d="M4.5 18.5a9.5 9.5 0 0 1 19 0" />
      <path d="M2.5 18.5h23" />
      <path d="M5 21h18" />
    </svg>
  );
}

function formatMonthDay(date: string): string {
  const parts = date.split('-');
  if (parts.length < 3) return date;
  return `${parts[1]}-${parts[2]}`;
}

function formatConfirmDate(date: string, allowedDates: string[]): string {
  if (!date) return '未选择';
  const index = allowedDates.indexOf(date);
  const parsed = Date.parse(`${date}T12:00:00+08:00`);
  const prefix =
    index === 0
      ? '今天'
      : index === 1
        ? '明天'
        : Number.isNaN(parsed)
          ? ''
          : WEEKDAY_LABELS[new Date(parsed).getUTCDay()];
  return `${prefix} ${formatMonthDay(date)}`.trim();
}

function parseSlotTime(iso: string): string {
  const matched = /T(\d{2}:\d{2})/.exec(iso);
  return matched ? matched[1] : '';
}

function slotTimeRange(slot: SlotDto): string {
  const start = parseSlotTime(slot.slotStart);
  const end = parseSlotTime(slot.slotEnd);
  if (start && end) {
    return `${start} - ${end}`;
  }
  return start || end || '未选择';
}

type DishWithExtras = DishDto & {
  imageUrl?: string | null;
  flavorGroups?: Array<{
    id: string;
    name: string;
    options: Array<{ id: string; name: string; priceFen: number }>;
  }>;
  sides?: Array<{ id: string; name: string; priceFen: number }>;
  addOns?: Array<{ id: string; name: string; priceFen: number }>;
};

type DraftItemWithExtras = DraftItemInput & {
  selectedFlavors?: Array<{ groupId: string; optionId: string }>;
  selectedSides?: string[];
  selectedAddOns?: string[];
};

function resolveConfirmDishPhoto(dish: DishWithExtras | undefined, fallbackName: string, index: number): string {
  if (dish?.imageUrl) {
    return dish.imageUrl;
  }
  if (/黑椒|鸡腿|鸡|堡/.test(fallbackName)) {
    return dishChickenLeg;
  }
  return resolveDishPhoto(fallbackName, index);
}

export interface ConfirmPageProps {
  source: StudentSource;
  draft: OrderDraft;
  shop: ShopSummary;
  onBack: () => void;
  onBackToMenu: () => void;
  onSubmitted: (orderId: string) => void;
  onEditCustomization?: (dishId: string) => void;
  hideSampleTools?: boolean;
}

export default function ConfirmPage({
  source,
  draft,
  shop,
  onBack,
  onBackToMenu,
  onSubmitted,
  onEditCustomization,
  hideSampleTools = false,
}: ConfirmPageProps) {
  const { gate, refresh } = useStudentSessionGate();
  const [snapshot, setSnapshot] = useState(() => draft.getState());
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [menuStatus, setMenuStatus] = useState<LoadStatus>('loading');
  const [scenario, setScenario] = useState<DemoScenario>(() => source.getScenario());
  const [busy, setBusy] = useState(false);
  const [queryError, setQueryError] = useState('');
  const [remark, setRemark] = useState(() => draft.getState().remark);

  const realLoggedOut = source.mode === 'real' && !gate.usable;

  useEffect(() => {
    if (draft.getState().status === 'success') {
      draft.resetSubmission();
      setSnapshot(draft.getState());
    }
  }, [draft]);

  useEffect(() => {
    if (realLoggedOut) {
      return;
    }
    let cancelled = false;
    const token = draft.beginMenuRead();
    setMenuStatus('loading');
    source.getMenu(snapshot.date).then(
      (data) => {
        if (!cancelled && draft.isMenuReadCurrent(token)) {
          setMenu(data);
          setMenuStatus('ready');
          draft.applyDishCatalog(filterDishesByShop(data.dishes, shop.merchantId));
          setSnapshot(draft.getState());
        }
      },
      () => {
        if (!cancelled && draft.isMenuReadCurrent(token)) {
          setMenu(null);
          setMenuStatus('error');
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, draft, shop.merchantId, snapshot.date, realLoggedOut]);

  async function runSubmit(): Promise<void> {
    if (busy) {
      return;
    }
    if (source.mode === 'real' && !gate.usable) {
      refresh();
      return;
    }
    setBusy(true);
    setQueryError('');
    try {
      const order = await draft.submit();
      setSnapshot(draft.getState());
      if (order) {
        onSubmitted(order.id);
      }
    } finally {
      setSnapshot(draft.getState());
      setBusy(false);
    }
  }

  async function queryResult(): Promise<void> {
    if (busy) {
      return;
    }
    if (source.mode === 'real' && !gate.usable) {
      refresh();
      return;
    }
    setBusy(true);
    setQueryError('');
    try {
      const order = await draft.queryResult();
      setSnapshot(draft.getState());
      onSubmitted(order.id);
    } catch (error) {
      setQueryError(sanitizeMessage(error instanceof Error ? error.message : '', '查询失败，请稍后重试。'));
      setSnapshot(draft.getState());
    } finally {
      setBusy(false);
    }
  }

  function endRequest(): void {
    draft.resetSubmission();
    setSnapshot(draft.getState());
    setQueryError('');
  }

  function changeScenario(next: DemoScenario): void {
    if (busy || next === scenario) {
      return;
    }
    source.setScenario(next);
    setScenario(next);
    setQueryError('');
    if (draft.getState().status !== 'idle') {
      draft.resetSubmission();
      setSnapshot(draft.getState());
    }
  }

  function updateRemark(next: string): void {
    const text = next.slice(0, ORDER_REMARK_MAX_LENGTH);
    setRemark(text);
    draft.setRemark(text);
    setSnapshot(draft.getState());
  }

  const selectedSlot = menu?.slots.find((slot) => slot.slotId === snapshot.slotId) ?? null;
  const lines = snapshot.items.map((rawItem, index) => {
    const item = rawItem as DraftItemWithExtras;
    const dish = menu?.dishes.find((candidate) => candidate.dishId === item.dishId) as DishWithExtras | undefined;
    const name = dish?.name ?? item.dishId;
    const selectedGroups = new Set((item.selectedFlavors ?? []).map((entry) => entry.groupId));
    const flavorTexts = dish?.flavorGroups?.flatMap((group) => {
      if (!selectedGroups.has(group.id)) return [];
      const entry = item.selectedFlavors?.find((choice) => choice.groupId === group.id);
      const option = group.options.find((candidate) => candidate.id === entry?.optionId);
      return option ? [`${group.name}：${option.name}`] : [];
    }) ?? [];
    const sideTexts = (item.selectedSides ?? []).flatMap((id) => {
      const side = dish?.sides?.find((candidate) => candidate.id === id);
      return side ? [side.name] : [];
    });
    const addOnTexts = (item.selectedAddOns ?? []).flatMap((id) => {
      const addOn = dish?.addOns?.find((candidate) => candidate.id === id);
      return addOn ? [`${addOn.name} +${formatYuan(addOn.priceFen)}`] : [];
    });
    const addOnFen = (item.selectedAddOns ?? []).reduce((sum, id) => {
      const addOn = dish?.addOns?.find((candidate) => candidate.id === id);
      return sum + (addOn?.priceFen ?? 0);
    }, 0);
    const unitPriceFen = (dish?.unitPriceFen ?? 0) + addOnFen;
    return {
      dishId: item.dishId,
      name,
      quantity: item.quantity,
      unitPriceFen,
      addOnFen,
      subtotalFen: unitPriceFen * item.quantity,
      customizationText: [...flavorTexts, ...sideTexts, ...addOnTexts].join('、'),
      hasOptions: Boolean(
        dish &&
        ((dish.flavorGroups?.length ?? 0) > 0 ||
          (dish.sides?.length ?? 0) > 0 ||
          (dish.addOns?.length ?? 0) > 0),
      ),
      photo: resolveConfirmDishPhoto(dish, name, index),
    };
  });

  const errorView = toSubmitErrorView(snapshot.error);
  const timedOut = snapshot.status === 'timeout';
  const menuReady = menuStatus === 'ready' && menu !== null;
  const itemsReady =
    menuReady &&
    snapshot.items.every((item) => {
      const dish = menu.dishes.find((candidate) => candidate.dishId === item.dishId);
      return (
        dish !== undefined &&
        dish.onSale === true &&
        (dish.availableQuantity ?? 0) >= item.quantity
      );
    });
  const slotReady = menuReady && selectedSlot !== null;
  const canSubmit =
    menuReady &&
    itemsReady &&
    slotReady &&
    snapshot.canConfirm &&
    !timedOut &&
    !busy &&
    (source.mode === 'sample' || gate.usable);

  const disabledReason = realLoggedOut
    ? ''
    : !menuReady
      ? '确认信息尚未就绪'
      : !itemsReady
        ? '部分菜品已变化，请返回菜单重新确认'
        : !slotReady
          ? '所选时段已失效，请返回时段页重新选择'
          : '';

  if (realLoggedOut) {
    return (
      <section className="confirm-order-page" aria-labelledby="student-confirm-title">
        <RealModeNotice />
        <header className="confirm-order__hero">
          <div className="confirm-order__nav">
            <button type="button" className="confirm-order__back" aria-label="返回时段" onClick={onBack}>
              <ChevronLeftIcon />
            </button>
            <div className="confirm-order__title-wrap">
              <h1 id="student-confirm-title" className="confirm-order__title">确认订单</h1>
              <TitleRaysSvg className="confirm-order__title-rays" />
              <TitleUnderlineSvg className="confirm-order__title-underline" />
            </div>
            <span aria-hidden="true" />
          </div>
          <HeroClocheSvg className="confirm-order__cloche" />
        </header>
        <div className="confirm-order__main">
          <LoginGuide gate={gate} onRecheck={refresh} onBack={onBackToMenu} />
        </div>
      </section>
    );
  }

  return (
    <section className="confirm-order-page" aria-labelledby="student-confirm-title">
      {source.mode === 'real' ? <RealModeNotice /> : null}

      <header className="confirm-order__hero">
        <div className="confirm-order__nav">
          <button type="button" className="confirm-order__back" aria-label="返回时段" onClick={onBack}>
            <ChevronLeftIcon />
          </button>
          <div className="confirm-order__title-wrap">
            <h1 id="student-confirm-title" className="confirm-order__title">确认订单</h1>
            <TitleRaysSvg className="confirm-order__title-rays" />
            <TitleUnderlineSvg className="confirm-order__title-underline" />
          </div>
          <span aria-hidden="true" />
        </div>

        <HeroClocheSvg className="confirm-order__cloche" />

        <div className="confirm-order__lead">
          <LeadRaysSvg className="confirm-order__lead-rays" />
          <span className="confirm-order__lead-text">核对一下，就可以啦！</span>
        </div>
      </header>

      <div className="confirm-order__main">
        {/* 当前店铺轻量信息行（纯展示，无点击交互） */}
        <div
          className="confirm-shop-bar"
          data-shop-demo={source.mode === 'sample' ? 'true' : 'false'}
        >
          <div className="confirm-shop-bar__left">
            <ShopAwningIcon className="confirm-shop-bar__icon" />
            <span className="confirm-shop-bar__label">当前店铺</span>
            <span className="confirm-shop-bar__name">{shop.name}</span>
          </div>
        </div>

        {source.mode === 'real' && gate.usable ? (
          <p className="confirm-contract-note">当前登录：{gate.identityText}（仅用于核对）</p>
        ) : null}

        {menuStatus === 'loading' ? (
          <p className="confirm-state-card">正在读取确认信息…</p>
        ) : null}

        {menuStatus === 'error' ? (
          <div className="confirm-alert-card" role="alert">
            <p>确认信息读取失败，请返回时段页重试。</p>
            <div className="confirm-alert-card__actions">
              <button type="button" onClick={onBack}>
                返回时段页
              </button>
            </div>
          </div>
        ) : null}

        {menuStatus === 'ready' && menu ? (
          <div className="confirm-receipt-wrap">
            <article className="confirm-receipt" aria-label="确认订单明细单">
              <div className="confirm-receipt__body">
                {/* 1. 订单明细 */}
                <section aria-labelledby="confirm-items-title">
                  <div className="confirm-sec-head">
                    <div className="confirm-sec-head__left">
                      <h2 id="confirm-items-title" className="confirm-brush-tag" style={{ margin: 0 }}>
                        订单明细
                        <TitleRaysSvg className="confirm-brush-tag__rays" />
                      </h2>
                    </div>
                    <span className="confirm-sec-head__watermark">
                      <BowlChopsticksWatermark />
                    </span>
                  </div>

                  <ul className="confirm-items">
                    {lines.map((line) => (
                      <li key={line.dishId} className="confirm-item">
                        <div className="confirm-item__polaroid">
                          <span className="confirm-item__tape" aria-hidden="true" />
                          <img src={line.photo} alt={`${line.name}（仅供参考）`} />
                        </div>
                        <div className="confirm-item__info">
                          <h3 className="confirm-item__name">{line.name}</h3>
                          {line.customizationText ? (
                            <p className="confirm-item__custom">{line.customizationText}</p>
                          ) : null}
                          <p className="confirm-item__unit">
                            单价 {formatYuan(line.unitPriceFen)}
                            {line.addOnFen > 0 ? `（含加购 ${formatYuan(line.addOnFen)}）` : ''}
                          </p>
                          <span className="confirm-item__qty">× {line.quantity}</span>
                          {line.hasOptions && onEditCustomization ? (
                            <button
                              type="button"
                              className="confirm-item__edit"
                              onClick={() => onEditCustomization(line.dishId)}
                            >
                              修改配菜
                            </button>
                          ) : null}
                        </div>
                        <strong className="confirm-item__subtotal">
                          {formatYuan(line.subtotalFen)}
                        </strong>
                      </li>
                    ))}
                  </ul>

                  <hr className="confirm-divider" />

                  <div className="confirm-subtotal-row">
                    <span className="confirm-subtotal-row__label">商品合计</span>
                    <strong className="confirm-subtotal-row__amount">
                      {formatYuan(snapshot.previewFen)}
                    </strong>
                  </div>
                </section>

                <hr className="confirm-divider" />

                {/* 2. 预约信息 */}
                <section aria-labelledby="confirm-booking-title">
                  <div className="confirm-sec-head" style={{ marginBottom: '0.45rem' }}>
                    <div className="confirm-sec-head__left">
                      <h2 id="confirm-booking-title" className="confirm-brush-tag" style={{ margin: 0 }}>
                        预约信息
                        <TitleRaysSvg className="confirm-brush-tag__rays" />
                      </h2>
                    </div>
                    <span className="confirm-sec-head__watermark">
                      <CalendarWatermark />
                    </span>
                  </div>

                  <div className="confirm-meta-list" aria-label="预约信息">
                    <div className="confirm-meta-row">
                      <span className="confirm-meta-row__key">
                        <CalendarRowIcon />
                        取餐日期
                      </span>
                      <strong className="confirm-meta-row__val">
                        {formatConfirmDate(menu.date || snapshot.date, snapshot.allowedDates)}
                      </strong>
                    </div>

                    <div className="confirm-meta-row">
                      <span className="confirm-meta-row__key">
                        <ClockRowIcon />
                        取餐时段
                      </span>
                      <button
                        type="button"
                        className="confirm-meta-row__slot-btn"
                        aria-label="修改取餐时段"
                        disabled={busy}
                        onClick={onBack}
                      >
                        <span>{selectedSlot ? slotTimeRange(selectedSlot) : '未选择'}</span>
                        <ChevronRightIcon />
                      </button>
                    </div>

                    <div className="confirm-meta-row">
                      <span className="confirm-meta-row__key">
                        <BagRowIcon />
                        用餐方式
                      </span>
                      <strong className="confirm-meta-row__val">
                        {snapshot.diningMode ? MODE_TEXT[snapshot.diningMode] : '未选择'}
                      </strong>
                    </div>
                  </div>
                </section>

                <hr className="confirm-divider" />

                {/* 3. 订单备注 */}
                <section aria-labelledby="confirm-remark-title">
                  <div className="confirm-sec-head" style={{ marginBottom: '0.52rem' }}>
                    <div className="confirm-sec-head__left">
                      <h2 id="confirm-remark-title" className="confirm-brush-tag" style={{ margin: 0 }}>
                        订单备注
                      </h2>
                      <span className="confirm-sec-head__sub">选填</span>
                    </div>
                    <span className="confirm-sec-head__watermark">
                      <PencilWatermark />
                    </span>
                  </div>

                  <div className="confirm-remark-box">
                    <textarea
                      className="confirm-remark-box__input"
                      value={remark}
                      maxLength={ORDER_REMARK_MAX_LENGTH}
                      rows={2}
                      placeholder="口味、忌口、取餐提醒等，档口会看到"
                      aria-label="订单备注"
                      disabled={busy}
                      onChange={(event) => updateRemark(event.target.value)}
                    />
                    <span className="confirm-remark-box__count" aria-live="polite">
                      {remark.length}/{ORDER_REMARK_MAX_LENGTH}
                    </span>
                  </div>
                </section>

                <hr className="confirm-divider" />

                {/* 4. 票据底部合计金额与取餐提醒 */}
                <div className="confirm-summary-foot">
                  <div className="confirm-summary-foot__left">
                    <span className="confirm-summary-foot__label">合计金额</span>
                    <div className="confirm-summary-foot__price-wrap">
                      <strong className="confirm-summary-foot__price">
                        {formatYuan(snapshot.previewFen)}
                      </strong>
                      <PriceUnderlineSvg className="confirm-summary-foot__underline" />
                    </div>
                  </div>

                  <span className="confirm-summary-foot__sep" aria-hidden="true" />

                  <div className="confirm-summary-foot__right">
                    <div className="confirm-pickup-pill">
                      <MiniClocheIcon />
                      <span>请按预约时段取餐</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        ) : null}

        {/* 超时待确认提示 */}
        {timedOut ? (
          <div className="confirm-alert-card" role="alert">
            <p style={{ fontWeight: 800 }}>结果待确认</p>
            <p>网络超时，订单可能已创建。请先查询结果，不要重复下单。</p>
            <div className="confirm-alert-card__actions">
              <button type="button" className="is-primary" disabled={busy} onClick={queryResult}>
                查询结果
              </button>
              <button type="button" disabled={busy} onClick={runSubmit}>
                重试同一请求
              </button>
            </div>
            {queryError ? <p style={{ fontSize: '0.75rem' }}>{queryError}</p> : null}
          </div>
        ) : null}

        {/* 业务错误提示 */}
        {!timedOut && snapshot.status === 'error' && errorView && errorView.action !== 'login' ? (
          <div className="confirm-alert-card" role="alert">
            <p>{errorView.message}</p>
            <div className="confirm-alert-card__actions">
              {errorView.action === 'retry' ? (
                <button type="button" className="is-primary" disabled={busy} onClick={runSubmit}>
                  {errorView.actionLabel}
                </button>
              ) : errorView.action === 'reconfirm' ? (
                <button type="button" onClick={endRequest}>
                  {errorView.actionLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={errorView.action === 'back-to-slot' ? onBack : onBackToMenu}
                >
                  {errorView.actionLabel}
                </button>
              )}
            </div>
          </div>
        ) : null}

        {!hideSampleTools ? (
          <div className="confirm-sub-notes">
            <p className="confirm-contract-note">
              金额以服务端下单结果为准 · {source.mode === 'real' ? '当前不发生真实资金交易' : '模拟付款，不发生真实资金交易'} · 接单前可取消，接单后需档口确认
            </p>

            {source.mode === 'sample' ? (
              <details className="confirm-scenario-details">
                <summary>样例提交场景调试（当前：{SCENARIO_OPTIONS.find((item) => item.value === scenario)?.label}）</summary>
                <div className="confirm-scenario-grid" role="group" aria-label="选择样例提交场景">
                  {SCENARIO_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`confirm-scenario-btn${scenario === option.value ? ' is-active' : ''}`}
                      aria-pressed={scenario === option.value}
                      disabled={busy}
                      onClick={() => changeScenario(option.value)}
                    >
                      <span>{option.label}</span>
                      <span className="confirm-scenario-btn__hint">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </details>
            ) : null}

            {source.mode === 'sample' ? <DemoModeNotice /> : null}
          </div>
        ) : null}
      </div>

      {/* 底部固定齿孔结算票条 */}
      <footer className="confirm-checkout-wrap">
        <div className="confirm-checkout-ticket">
          <div className="confirm-checkout">
            <div className="confirm-checkout__left">
              <span className="confirm-checkout__label">合计</span>
              <strong className="confirm-checkout__total">{formatYuan(snapshot.previewFen)}</strong>
            </div>

            <span className="confirm-checkout__sep" aria-hidden="true" />

            <div className="confirm-checkout__right">
              <button
                type="button"
                className="confirm-submit-btn"
                disabled={!canSubmit}
                onClick={runSubmit}
              >
                <span>{busy ? '提交中…' : '确认下单'}</span>
                {!busy ? <ArrowRightIcon /> : null}
              </button>
              {busy ? (
                <span className="confirm-checkout__reason">正在提交，请稍候…</span>
              ) : disabledReason ? (
                <span className="confirm-checkout__reason">{disabledReason}</span>
              ) : null}
            </div>
          </div>
        </div>
      </footer>
    </section>
  );
}
