import { useEffect, useState } from 'react';
import { DATES } from '../data/sampleData';
import type { OrderDraft } from '../state/orderDraft';
import { createSlotRequestGuard, type SlotGuardState } from '../state/slotGuard';
import type { DiningMode, MenuResponse, SlotDto, StudentSource } from '../types';
import { isApiError } from '../types';
import CrowdHint from '../components/CrowdHint';
import DemoModeNotice from '../components/DemoModeNotice';
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

function dateLabel(date: string): string {
  const index = DATES.indexOf(date);
  const label = DAY_LABELS[index] ?? '';
  return `${label} ${formatMonthDay(date)}`.trim();
}

function timeOf(iso: string): string {
  const matched = /T(\d{2}:\d{2})/.exec(iso);
  return matched ? matched[1] : iso;
}

function slotRange(slot: SlotDto): string {
  return `${timeOf(slot.slotStart)}—${timeOf(slot.slotEnd)}`;
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

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setErrorText('');
    source.getMenu(date).then(
      (data) => {
        if (!cancelled) {
          setMenu(data);
          setStatus('ready');
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setMenu(null);
          setStatus('error');
          setErrorText(isApiError(error) ? error.message : '时段信息读取失败，请重试');
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, date, reloadToken]);

  function selectSlot(slot: SlotDto): void {
    if (!slot.enabled || slot.remainingCapacity <= 0) {
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
  const hint =
    snapshot.slotId === null
      ? '请选择时段'
      : snapshot.diningMode === null
        ? '请选择堂食或外带'
        : '进入确认页核对后再提交。';

  return (
    <section className="student-page" aria-labelledby="student-slot-title">
      <SampleBanner />

      <button type="button" className="student-secondary student-back" onClick={onBack}>
        ← 返回菜单
      </button>

      <header className="student-page__head">
        <p className="student-kicker">S5 · 时段与用餐方式（可进入确认页）</p>
        <h2 id="student-slot-title">选择时段与用餐方式</h2>
        <p className="student-page__lead">已选菜品会保留；时段与用餐方式必须显式选择。</p>
      </header>

      <p className="student-selection-summary">{selectedSummary}</p>

      {status === 'loading' ? <p className="student-loading">正在读取时段信息…</p> : null}

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
        <p className="student-loading">暂无可用时段，请稍后重试</p>
      ) : null}

      {status === 'ready' && menu && menu.slots.length > 0 ? (
        <section aria-labelledby="student-slot-list-title">
          <h3 id="student-slot-list-title" className="student-section-title">
            选择时段 · {dateLabel(menu.date)}
          </h3>
          <ul className="student-slot-list">
            {menu.slots.map((slot) => {
              const full = slot.remainingCapacity <= 0;
              const unavailable = !slot.enabled || full;
              const selected = snapshot.slotId === slot.slotId;
              return (
                <li key={slot.slotId}>
                  <button
                    type="button"
                    className={`student-slot${selected ? ' is-active' : ''}`}
                    aria-pressed={selected}
                    disabled={unavailable}
                    onClick={() => selectSlot(slot)}
                  >
                    <span className="student-slot__time">{slotRange(slot)}</span>
                    <span className="student-slot__meta">
                      {!slot.enabled
                        ? '该时段已关闭'
                        : full
                          ? '名额已满，不可选'
                          : `剩余 ${slot.remainingCapacity} 个名额`}
                    </span>
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
        slotRange={selectedSlot ? slotRange(selectedSlot) : null}
        state={crowd}
      />

      <LocationNote />

      <footer className="student-summary">
        <p className="student-summary__main">
          {selectedSlot ? `时段 ${slotRange(selectedSlot)}` : '尚未选择时段'}
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

      <DemoModeNotice />
    </section>
  );
}