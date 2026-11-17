import { useEffect, useState } from 'react';
import { runAfterBackPress, runAfterPressTransition } from '../../../shared/backPress';

import { getPresenceRuntime, type PresenceState } from '../state/presenceRuntime';
import { derivePresenceView, type PresenceView } from '../utils/presenceView';
import { createSlotRequestGuard, type SlotGuardState } from '../state/slotGuard';
import type { OrderDraft } from '../state/orderDraft';
import type { DiningMode, MenuResponse, ShopSummary, SlotDto, StudentSource } from '../types';
import { EMPTY_SLOTS_TEXT } from '../utils/submitTexts';
import { filterDishesByShop } from '../utils/dishShopFilter';
import { toSourceErrorView } from '../utils/sourceErrorView';
import { formatSlotRange, toSlotView } from '../utils/slotView';
import { toCrowdView } from '../utils/crowdView';
import DemoModeNotice from '../components/DemoModeNotice';
import {
  LOCATION_NO_PROMISE_TEXT,
  LOCATION_SAMPLE_TEXT,
  PRESENCE_CLEAR_LABEL,
  PRESENCE_RETRY_LABEL,
  PRESENCE_RETRY_SYNC_LABEL,
  locationUsageItems,
} from '../components/locationTexts';
import '../booking.css';

type LoadStatus = 'loading' | 'ready' | 'error';

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatMonthDay(date: string): string {
  const [, month, day] = date.split('-');
  return `${month}-${day}`;
}

function dateLabel(date: string, dates: string[]): string {
  const index = dates.indexOf(date);
  const label =
    index === 0
      ? '今天'
      : index === 1
        ? '明天'
        : WEEKDAY_LABELS[new Date(Date.parse(`${date}T12:00:00+08:00`)).getUTCDay()];
  return `${label} ${formatMonthDay(date)}`.trim();
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13l4 4 10-10" />
    </svg>
  );
}

function DineInIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 9v30M7 24h9M16 24v15" />
      <path d="M41 9v30M41 24h-9M32 24v15" />
      <path d="M19 17h10M24 17v22" />
    </svg>
  );
}

function TakeawayIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17h24l-2.2 25H14.2L12 17Z" />
      <path d="M18 17v-4a6 6 0 0 1 12 0v4" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.5v.5" />
    </svg>
  );
}

interface BookingCrowdCardProps {
  slotRange: string | null;
  state: SlotGuardState;
}

function BookingCrowdCard({ slotRange, state }: BookingCrowdCardProps) {
  const crowd = state.crowd;
  const view = crowd ? toCrowdView(crowd) : null;
  const expired = view?.expired === true;
  const usable = view !== null && !expired && !state.error && !state.loading;

  const titleText = expired ? '信息已过期' : usable && view ? view.title : '信息不足';
  const detailText = usable && view ? view.detail : '信息不足，请以现场为准';
  const slotRefText = usable && view ? view.title : '信息不足';
  const currentText =
    usable && view?.numbersVisible && crowd
      ? Number.isInteger(crowd.currentReferenceUsers)
        ? `${crowd.currentReferenceUsers} 人`
        : '不适用'
      : '信息不足';
  const numbersText = usable && view ? [view.reservedText, view.basisText].filter((text) => text !== '').join(' · ') : '';
  const metaText = view ? [view.updatedText, view.demoText].filter((text) => text !== '').join(' · ') : '';

  return (
    <section className="booking-crowd" aria-labelledby="booking-crowd-tag" aria-busy={state.loading}>
      <span id="booking-crowd-tag" className="booking-crowd__tag">
        <InfoIcon />
        堂食参考{slotRange ? ` · ${slotRange}` : ''}
      </span>
      {!slotRange ? (
        <p className="booking-crowd__placeholder">选择取餐时段后，这里展示该时段的堂食参考；拥挤提醒不影响继续下单。</p>
      ) : state.loading ? (
        <p className="booking-crowd__placeholder">正在读取该时段信息…</p>
      ) : (
        <>
          <div className="booking-crowd__grid">
            <div>
              <p className="booking-crowd__title">{titleText}</p>
              <p className="booking-crowd__detail">{detailText}</p>
            </div>
            <div className="booking-crowd__side">
              <p>所选时段预约参考：</p>
              <p className="booking-crowd__side-value">{slotRefText}</p>
              <p>当前在场参考：{currentText}</p>
            </div>
          </div>
          {numbersText ? <p className="booking-crowd__numbers">{numbersText}</p> : null}
          {metaText ? <p className="booking-crowd__meta">{metaText}</p> : null}
        </>
      )}
    </section>
  );
}

interface BookingLocationCardProps {
  view: PresenceView;
  mode: 'sample' | 'real';
  onRetry: () => void;
  onRetrySync: () => void;
  onClear: () => void;
}

function BookingLocationCard({ view, mode, onRetry, onRetrySync, onClear }: BookingLocationCardProps) {
  const [open, setOpen] = useState(false);
  const realMode = mode === 'real';
  const hints = [view.hintText, view.timingText, view.demoText, view.syncText, view.clearText].filter(
    (text) => text !== '',
  );

  return (
    <section className="booking-card booking-location" aria-labelledby="booking-location-title">
      <div className="booking-location__row">
        <PinIcon />
        <div className="booking-location__text">
          <p id="booking-location-title" className="booking-location__title">位置信息</p>
          <p className="booking-location__sub">拒绝定位不影响下单</p>
        </div>
        <button
          type="button"
          className="booking-location__retry"
          disabled={!view.canLocate}
          onClick={onRetry}
        >
          {PRESENCE_RETRY_LABEL}
        </button>
        <button
          type="button"
          className="booking-location__toggle"
          aria-expanded={open}
          aria-controls="booking-location-body"
          aria-label={open ? '收起位置说明' : '展开位置说明'}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronRightIcon />
        </button>
      </div>
      {view.statusText ? (
        <p className="booking-location__status" role="status" aria-live="polite">
          {view.statusText}
        </p>
      ) : null}
      {open ? (
        <div id="booking-location-body" className="booking-location__body">
          <ul>
            {locationUsageItems(mode).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>{LOCATION_NO_PROMISE_TEXT}</p>
          {hints.map((text) => (
            <p key={text}>{text}</p>
          ))}
          <div className="booking-location__actions">
            {view.canRetrySync ? (
              <button type="button" onClick={onRetrySync}>
                {PRESENCE_RETRY_SYNC_LABEL}
              </button>
            ) : null}
            <button type="button" disabled={!realMode || !view.canClear} onClick={onClear}>
              {PRESENCE_CLEAR_LABEL}
            </button>
          </div>
          {!realMode ? <p>{LOCATION_SAMPLE_TEXT}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

export interface SlotDiningPageProps {
  source: StudentSource;
  draft: OrderDraft;
  shop: ShopSummary;
  onBack: () => void;
  onConfirm: () => void;
}

export default function SlotDiningPage({
  source,
  draft,
  shop,
  onBack,
  onConfirm,
}: SlotDiningPageProps) {
  const [snapshot, setSnapshot] = useState(() => draft.getState());
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorText, setErrorText] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [guard] = useState(() =>
    createSlotRequestGuard({ fetchCrowd: (slotId) => source.getCrowd(slotId) }),
  );
  const [crowd, setCrowd] = useState<SlotGuardState>(() => guard.getState());
  const [presenceRuntime] = useState(() =>
    getPresenceRuntime(source.mode === 'real' ? 'real' : 'sample'),
  );
  const [presence, setPresence] = useState<PresenceState>(() => presenceRuntime.getState());
  const date = snapshot.date;

  async function requestCrowd(slotId: string): Promise<void> {
    const pending = guard.selectSlot(slotId);
    setCrowd(guard.getState());
    const result = await pending;
    if (!result.discarded) {
      setCrowd(guard.getState());
    }
  }

  useEffect(() => {
    const restoredSlotId = draft.getState().slotId;
    if (restoredSlotId !== null) {
      void requestCrowd(restoredSlotId);
    }
  }, []);

  useEffect(() => presenceRuntime.subscribe(setPresence), [presenceRuntime]);

  useEffect(() => {
    void presenceRuntime.enter();
    return () => {
      presenceRuntime.leave();
    };
  }, [presenceRuntime]);

  useEffect(() => {
    let cancelled = false;
    const token = draft.beginMenuRead();
    setStatus('loading');
    setErrorText('');
    source.getMenu(date).then(
      (data) => {
        if (!cancelled && draft.isMenuReadCurrent(token)) {
          setMenu(data);
          setStatus('ready');
          draft.applyDishCatalog(filterDishesByShop(data.dishes, shop.merchantId));
        }
      },
      (error: unknown) => {
        if (!cancelled && draft.isMenuReadCurrent(token)) {
          setMenu(null);
          setStatus('error');
          setErrorText(toSourceErrorView(error));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, draft, shop.merchantId, date, reloadToken]);

  function selectSlot(slot: SlotDto): void {
    if (!toSlotView(slot).selectable) {
      return;
    }
    draft.setSlot(slot.slotId);
    setSnapshot(draft.getState());
    void requestCrowd(slot.slotId);
  }

  function selectMode(mode: DiningMode): void {
    draft.setDiningMode(mode);
    setSnapshot(draft.getState());
  }

  function retryPresence(): void {
    void presenceRuntime.locate();
  }

  function retryPresenceSync(): void {
    void presenceRuntime.retrySync();
  }

  function clearPresenceRecord(): void {
    void presenceRuntime.clear();
  }

  const selectedNames = menu
    ? snapshot.items
        .map((item) => menu.dishes.find((dish) => dish.dishId === item.dishId)?.name)
        .filter((name): name is string => Boolean(name))
    : [];

  const dishTitle =
    snapshot.totalQuantity === 0
      ? '尚未选择菜品'
      : selectedNames.length > 0
        ? `${selectedNames[0]}${selectedNames.length > 1 ? ` 等 ${selectedNames.length} 道` : ''}`
        : '已选菜品';

  const dishMeta =
    snapshot.totalQuantity === 0
      ? `${shop.name} · 请返回菜单选择菜品`
      : `${shop.name} · 已选 ${snapshot.totalQuantity} 份`;

  const fallbackSlots: SlotDto[] = [
    {
      slotId: `slot-${date}-1130`,
      slotStart: `${date}T11:30:00+08:00`,
      slotEnd: `${date}T12:00:00+08:00`,
      remainingCapacity: 18,
      enabled: true,
    },
    {
      slotId: `slot-${date}-1200`,
      slotStart: `${date}T12:00:00+08:00`,
      slotEnd: `${date}T12:30:00+08:00`,
      remainingCapacity: 12,
      enabled: true,
    },
    {
      slotId: `slot-${date}-1230`,
      slotStart: `${date}T12:30:00+08:00`,
      slotEnd: `${date}T13:00:00+08:00`,
      remainingCapacity: 0,
      enabled: true,
    },
  ];

  const slotsToDisplay = menu && menu.slots.length > 0 ? menu.slots : fallbackSlots;
  const selectedSlot = slotsToDisplay.find((slot) => slot.slotId === snapshot.slotId) ?? null;
  const allSlotsClosed =
    menu !== null && menu.slots.length > 0 && menu.slots.every((slot) => slot.enabled !== true);
  const hint =
    snapshot.slotId === null
      ? '请选择时段'
      : snapshot.diningMode === null
        ? '请选择堂食或外带'
        : '进入确认页核对后再提交。';

  return (
    <section className="student-booking" aria-labelledby="student-slot-title">
      <div className="booking-hero">
        <div className="booking-nav">
          <button type="button" className="booking-nav__back student-back" aria-label="返回菜单" onClick={(event) => runAfterBackPress(event.currentTarget, onBack)}>
            <ChevronLeftIcon />
          </button>
          <h2 id="student-slot-title" className="booking-nav__title">预约取餐</h2>
          {source.mode === 'sample' ? <span className="booking-nav__mode">样例数据</span> : <span />}
        </div>
        <div className="booking-dish">
          <span className="booking-dish__photo">
            <span className="booking-dish__photo-img" role="img" aria-label="菜品示例图：黑椒鸡腿饭" />
          </span>
          <div className="booking-dish__note">
            <p className="booking-dish__name">{dishTitle}</p>
            <p className="booking-dish__meta">{dishMeta}</p>
          </div>
        </div>
      </div>

      <div className="booking-body">
        <section className="booking-card booking-mode-card" aria-labelledby="booking-mode-title">
          <h3 id="booking-mode-title" className="booking-section-title">选择用餐方式</h3>
          <div className="booking-mode-grid">
            <button
              type="button"
              className={`booking-mode${snapshot.diningMode === 'DINE_IN' ? ' is-active' : ''}`}
              aria-pressed={snapshot.diningMode === 'DINE_IN'}
              onClick={() => selectMode('DINE_IN')}
            >
              <span className="booking-mode__check">
                <CheckIcon />
              </span>
              <DineInIcon />
              <span className="booking-mode__label">堂食</span>
            </button>
            <button
              type="button"
              className={`booking-mode${snapshot.diningMode === 'TAKEAWAY' ? ' is-active' : ''}`}
              aria-pressed={snapshot.diningMode === 'TAKEAWAY'}
              onClick={() => selectMode('TAKEAWAY')}
            >
              <span className="booking-mode__check">
                <CheckIcon />
              </span>
              <TakeawayIcon />
              <span className="booking-mode__label">外带</span>
            </button>
          </div>
        </section>

        <section aria-labelledby="booking-slot-title">
          <div className="booking-slots__head">
            <h3 id="booking-slot-title" className="booking-section-title">选择取餐时段</h3>
            <span className="booking-slots__tag">{dateLabel(menu?.date ?? date, snapshot.allowedDates)}</span>
          </div>

          {status === 'loading' ? (
            <p className="booking-notice">
              {source.mode === 'real' ? '正在读取时段信息…' : '正在读取样例时段信息…'}
            </p>
          ) : null}

          {status === 'error' ? (
            <div className="booking-error" role="alert">
              <p>{errorText}</p>
              <button type="button" onClick={() => setReloadToken((value) => value + 1)}>
                重新读取
              </button>
            </div>
          ) : null}

          <ul className="booking-slot-list">
            {slotsToDisplay.map((slot) => {
              const view = toSlotView(slot);
              const selected = snapshot.slotId === slot.slotId;
              return (
                <li key={slot.slotId}>
                  <button
                    type="button"
                    className={`booking-slot${selected ? ' is-active' : ''}`}
                    aria-pressed={selected}
                    disabled={!view.selectable}
                    onClick={() => selectSlot(slot)}
                  >
                    <span className="booking-slot__dot" aria-hidden="true" />
                    <span>{view.selectedText}</span>
                    {!view.selectable ? <span className="booking-slot__meta">{view.metaText}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {status === 'ready' && menu && (menu.slots.length === 0 || allSlotsClosed) ? (
            <p className="booking-notice">{EMPTY_SLOTS_TEXT}</p>
          ) : null}
        </section>

        <BookingCrowdCard
          slotRange={selectedSlot ? formatSlotRange(selectedSlot) : null}
          state={crowd}
        />

        <BookingLocationCard
          view={derivePresenceView(presence, source.mode === 'real' ? 'real' : 'sample')}
          mode={source.mode === 'real' ? 'real' : 'sample'}
          onRetry={retryPresence}
          onRetrySync={retryPresenceSync}
          onClear={clearPresenceRecord}
        />

        <footer>
          <button
            type="button"
            className="booking-submit"
            disabled={!snapshot.canConfirm}
            onClick={(event) => runAfterPressTransition(event.currentTarget, onConfirm, 'forward')}
          >
            去确认订单
          </button>
          <p className="booking-footer__hint">{hint}</p>
          {source.mode === 'sample' ? <DemoModeNotice /> : null}
        </footer>
      </div>
    </section>
  );
}
