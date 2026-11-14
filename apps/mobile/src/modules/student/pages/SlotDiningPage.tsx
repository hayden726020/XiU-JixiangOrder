import { useEffect, useState } from 'react';

import { getPresenceRuntime, type PresenceState } from '../state/presenceRuntime';
import { derivePresenceView } from '../utils/presenceView';
import { createSlotRequestGuard, type SlotGuardState } from '../state/slotGuard';
import type { OrderDraft } from '../state/orderDraft';
import type { DiningMode, MenuResponse, SlotDto, StudentSource } from '../types';
import { EMPTY_SLOTS_TEXT } from '../utils/submitTexts';
import { toSourceErrorView } from '../utils/sourceErrorView';
import { formatSlotRange, toSlotView } from '../utils/slotView';
import CrowdHint from '../components/CrowdHint';
import DemoModeNotice from '../components/DemoModeNotice';
import RealModeNotice from '../components/RealModeNotice';
import LocationNote from '../components/LocationNote';
import SampleBanner from '../components/SampleBanner';

type LoadStatus = 'loading' | 'ready' | 'error';

const DAY_LABELS = ['今天', '明天'];
const MODE_TEXT: Record<DiningMode, string> = {
  DINE_IN: '堂食',
  TAKEAWAY: '外带',
};

function formatMonthDay(date: string): string {
  const [, month, day] = date.split('-');
  return `${month}-${day}`;
}

function dateLabel(date: string, dates: string[]): string {
  const index = dates.indexOf(date);
  const label = DAY_LABELS[index] ?? '';
  return `${label} ${formatMonthDay(date)}`.trim();
}

export interface SlotDiningPageProps {
  source: StudentSource;
  draft: OrderDraft;
  onBack: () => void;
  onConfirm: () => void;
}

export default function SlotDiningPage({
  source,
  draft,
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
    setStatus('loading');
    setErrorText('');
    source.getMenu(date).then(
      (data) => {
        if (!cancelled) {
          setMenu(data);
          setStatus('ready');
          draft.applyDishCatalog(data.dishes);
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setMenu(null);
          setStatus('error');
          setErrorText(toSourceErrorView(error));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, date, reloadToken]);

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

  const selectedSummary =
    snapshot.totalQuantity > 0
      ? `已选 ${snapshot.totalQuantity} 份${
          selectedNames.length > 0 ? ` · ${selectedNames.join('、')}` : ''
        }`
      : '尚未选择菜品';

  const selectedSlot = menu?.slots.find((slot) => slot.slotId === snapshot.slotId) ?? null;
  const allSlotsClosed =
    menu !== null && menu.slots.length > 0 && menu.slots.every((slot) => slot.enabled !== true);
  const hint =
    snapshot.slotId === null
      ? '请选择时段'
      : snapshot.diningMode === null
        ? '请选择堂食或外带'
        : '进入确认页核对后再提交。';

  return (
    <section className="student-page" aria-labelledby="student-slot-title">
      {source.mode === 'sample' ? <SampleBanner /> : <RealModeNotice />}

      <button type="button" className="student-secondary student-back" onClick={onBack}>
        ← 返回菜单
      </button>

      <header className="student-page__head">
        <p className="student-kicker">
          {source.mode === 'real' ? 'S9 · 真实时段与拥挤（只读）' : 'S5 · 时段与用餐方式（可进入确认页）'}
        </p>
        <h2 id="student-slot-title">选择时段与用餐方式</h2>
        <p className="student-page__lead">
          {source.mode === 'real'
            ? '时段与拥挤参考来自公共服务；用餐方式需显式选择。'
            : '已选菜品会保留；时段与用餐方式必须显式选择。'}
        </p>
      </header>

      <p className="student-selection-summary">{selectedSummary}</p>

      {status === 'loading' ? (
        <p className="student-loading">
          {source.mode === 'real' ? '正在读取时段信息…' : '正在读取样例时段信息…'}
        </p>
      ) : null}

      {status === 'error' ? (
        <div className="student-error" role="alert">
          <p>{errorText}</p>
          <button
            type="button"
            className="student-secondary"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            重新读取
          </button>
        </div>
      ) : null}

      {status === 'ready' && menu && menu.slots.length === 0 ? (
        <p className="student-loading">{EMPTY_SLOTS_TEXT}</p>
      ) : null}

      {status === 'ready' && allSlotsClosed ? (
        <p className="student-loading">{EMPTY_SLOTS_TEXT}</p>
      ) : null}

      {status === 'ready' && menu && menu.slots.length > 0 ? (
        <section aria-labelledby="student-slot-list-title">
          <h3 id="student-slot-list-title" className="student-section-title">
            选择时段 · {dateLabel(menu.date, snapshot.allowedDates)}
          </h3>
          <ul className="student-slot-list">
            {menu.slots.map((slot) => {
              const view = toSlotView(slot);
              const selected = snapshot.slotId === slot.slotId;
              return (
                <li key={slot.slotId}>
                  <button
                    type="button"
                    className={`student-slot${selected ? ' is-active' : ''}`}
                    aria-pressed={selected}
                    disabled={!view.selectable}
                    onClick={() => selectSlot(slot)}
                  >
                    <span className="student-slot__time">{view.selectedText}</span>
                    <span className="student-slot__meta">{view.metaText}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="student-mode-title">
        <h3 id="student-mode-title" className="student-section-title">
          用餐方式
        </h3>
        <div className="student-mode-grid">
          <button
            type="button"
            className={`student-mode${snapshot.diningMode === 'DINE_IN' ? ' is-active' : ''}`}
            aria-pressed={snapshot.diningMode === 'DINE_IN'}
            onClick={() => selectMode('DINE_IN')}
          >
            <span className="student-mode__title">堂食</span>
            <span className="student-mode__desc">在食堂用餐，需要座位请以现场为准</span>
          </button>
          <button
            type="button"
            className={`student-mode${snapshot.diningMode === 'TAKEAWAY' ? ' is-active' : ''}`}
            aria-pressed={snapshot.diningMode === 'TAKEAWAY'}
            onClick={() => selectMode('TAKEAWAY')}
          >
            <span className="student-mode__title">外带</span>
            <span className="student-mode__desc">打包带走，到点直接取餐</span>
          </button>
        </div>
      </section>

      <CrowdHint
        slotRange={selectedSlot ? formatSlotRange(selectedSlot) : null}
        state={crowd}
      />

      <LocationNote
        view={derivePresenceView(presence, source.mode === 'real' ? 'real' : 'sample')}
        mode={source.mode === 'real' ? 'real' : 'sample'}
        onRetry={retryPresence}
        onRetrySync={retryPresenceSync}
        onClear={clearPresenceRecord}
      />

      <footer className="student-summary">
        <p className="student-summary__main">
          {selectedSlot ? `时段 ${formatSlotRange(selectedSlot)}` : '尚未选择时段'}
        </p>
        <p className="student-summary__note">
          {snapshot.diningMode ? `用餐方式：${MODE_TEXT[snapshot.diningMode]}` : '用餐方式：未选择'}
        </p>
        <button
          type="button"
          className="student-primary"
          disabled={!snapshot.canConfirm}
          onClick={onConfirm}
        >
          去确认
        </button>
        <p className="student-summary__hint">{hint}</p>
      </footer>

      {source.mode === 'sample' ? <DemoModeNotice /> : null}
    </section>
  );
}