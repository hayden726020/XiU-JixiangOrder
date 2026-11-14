import { useEffect, useState } from 'react';
import type { OrderDraft } from '../state/orderDraft';
import type { DemoScenario, MenuResponse, SlotDto, StudentSource } from '../types';
import { isApiError } from '../types';
import { formatYuan } from '../utils/money';
import { toSubmitErrorView } from '../utils/orderSubmitView';
import DemoModeNotice from '../components/DemoModeNotice';
import RealModeNotice from '../components/RealModeNotice';
import SampleBanner from '../components/SampleBanner';

type LoadStatus = 'loading' | 'ready' | 'error';

const MODE_TEXT = {
  DINE_IN: '堂食',
  TAKEAWAY: '外带',
} as const;

const SCENARIO_OPTIONS: Array<{ value: DemoScenario; label: string; hint: string }> = [
  { value: 'normal', label: '正常提交', hint: '按样例规则返回订单' },
  { value: 'slot-full', label: '时段不可用', hint: '提交返回时段不可用' },
  { value: 'out-of-stock', label: '菜品不足', hint: '提交返回菜品不足' },
  { value: 'timeout', label: '提交超时', hint: '提交超时，结果待确认' },
];

function parseSlot(slot: SlotDto): { date: string; time: string } {
  const matched = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(slot.slotStart);
  if (!matched) {
    return { date: '', time: '' };
  }
  return {
    date: `${Number(matched[2])}月${Number(matched[3])}日`,
    time: `${matched[4]}:${matched[5]}`,
  };
}

function slotLabel(slot: SlotDto): string {
  const start = parseSlot(slot);
  const end = /T(\d{2}:\d{2})/.exec(slot.slotEnd);
  return `${start.date} ${start.time}—${end ? end[1] : ''}`.trim();
}

export interface ConfirmPageProps {
  source: StudentSource;
  draft: OrderDraft;
  onBack: () => void;
  onBackToMenu: () => void;
  onSubmitted: (orderId: string) => void;
}

export default function ConfirmPage({
  source,
  draft,
  onBack,
  onBackToMenu,
  onSubmitted,
}: ConfirmPageProps) {
  const [snapshot, setSnapshot] = useState(() => draft.getState());
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [menuStatus, setMenuStatus] = useState<LoadStatus>('loading');
  const [scenario, setScenario] = useState<DemoScenario>(() => source.getScenario());
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [queryError, setQueryError] = useState('');

  useEffect(() => {
    if (draft.getState().status === 'success') {
      draft.resetSubmission();
      setSnapshot(draft.getState());
    }
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    setMenuStatus('loading');
    source.getMenu(snapshot.date).then(
      (data) => {
        if (!cancelled) {
          setMenu(data);
          setMenuStatus('ready');
        }
      },
      () => {
        if (!cancelled) {
          setMenu(null);
          setMenuStatus('error');
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, snapshot.date]);

  async function runSubmit(): Promise<void> {
    if (busy) {
      return;
    }
    setBusy(true);
    setLocalError('');
    setQueryError('');
    try {
      const order = await draft.submit();
      setSnapshot(draft.getState());
      if (order) {
        onSubmitted(order.id);
      }
    } catch (error) {
      setLocalError(isApiError(error) ? error.message : '提交失败，请稍后重试。');
      setSnapshot(draft.getState());
    } finally {
      setBusy(false);
    }
  }

  async function queryResult(): Promise<void> {
    if (busy) {
      return;
    }
    setBusy(true);
    setQueryError('');
    try {
      const order = await draft.queryResult();
      setSnapshot(draft.getState());
      onSubmitted(order.id);
    } catch (error) {
      setQueryError(isApiError(error) ? error.message : '查询失败，请稍后重试。');
      setSnapshot(draft.getState());
    } finally {
      setBusy(false);
    }
  }

  function changeScenario(next: DemoScenario): void {
    if (busy || next === scenario) {
      return;
    }
    source.setScenario(next);
    setScenario(next);
    setLocalError('');
    setQueryError('');
    if (draft.getState().status !== 'idle') {
      draft.resetSubmission();
      setSnapshot(draft.getState());
    }
  }

  const selectedSlot = menu?.slots.find((slot) => slot.slotId === snapshot.slotId) ?? null;
  const lines = snapshot.items.map((item) => {
    const dish = menu?.dishes.find((candidate) => candidate.dishId === item.dishId);
    return {
      dishId: item.dishId,
      name: dish?.name ?? item.dishId,
      quantity: item.quantity,
      unitPriceFen: dish?.unitPriceFen ?? 0,
      subtotalFen: (dish?.unitPriceFen ?? 0) * item.quantity,
    };
  });
  const errorView = toSubmitErrorView(snapshot.error);
  const timedOut = snapshot.status === 'timeout';

  return (
    <section className="student-page" aria-labelledby="student-confirm-title">
      {source.mode === 'sample' ? <SampleBanner /> : <RealModeNotice />}

      <button type="button" className="student-secondary student-back" onClick={onBack}>
        ← 返回时段
      </button>

      <header className="student-page__head">
        <p className="student-kicker">
          {source.mode === 'real' ? 'S10 · 真实确认下单' : 'S5 · 确认下单与样例订单'}
        </p>
        <h2 id="student-confirm-title">确认订单</h2>
        <p className="student-page__lead">
          {source.mode === 'real'
            ? '核对菜品、时段与用餐方式；金额与订单结果以服务端返回为准。'
            : '核对菜品、时段与用餐方式；提交即模拟付款，不发生资金交易。'}
        </p>
      </header>

      {menuStatus === 'loading' ? <p className="student-loading">正在读取确认信息…</p> : null}

      {menuStatus === 'error' ? (
        <div className="student-error" role="alert">
          <p>确认信息读取失败，请返回时段页重试。</p>
          <div className="student-error__actions">
            <button type="button" className="student-secondary" onClick={onBack}>
              返回时段页
            </button>
          </div>
        </div>
      ) : null}

      {menuStatus === 'ready' && menu ? (
        <>
          <section className="student-confirm" aria-labelledby="student-confirm-summary-title">
            <h3 id="student-confirm-summary-title" className="student-section-title">
              订单摘要
            </h3>
            <ul className="student-confirm__lines">
              {lines.map((line) => (
                <li key={line.dishId} className="student-confirm__line">
                  <div>
                    <p className="student-confirm__name">
                      {line.name} × {line.quantity}
                    </p>
                    <p className="student-confirm__meta">单价 {formatYuan(line.unitPriceFen)}</p>
                  </div>
                  <span className="student-confirm__amount">{formatYuan(line.subtotalFen)}</span>
                </li>
              ))}
            </ul>
            <p className="student-total">合计 {formatYuan(snapshot.previewFen)}</p>
            <p className="student-total__note">金额以服务端返回为准，本地预估仅用于预览</p>
          </section>

          <section className="student-info" aria-label="预约信息">
            <p className="student-info__row">
              <span>时段</span>
              <span>{selectedSlot ? slotLabel(selectedSlot) : '未选择'}</span>
            </p>
            <p className="student-info__row">
              <span>用餐方式</span>
              <span>{snapshot.diningMode ? MODE_TEXT[snapshot.diningMode] : '未选择'}</span>
            </p>
          </section>

          <section className="student-rule" aria-label="下单规则说明">
            <p>取消规则：接单前可直接取消；接单后需提交申请，由档口处理。</p>
            <p>支付说明：{source.mode === 'real' ? '当前不发生真实资金交易。' : '模拟付款，不发生资金交易。'}</p>
          </section>
        </>
      ) : null}

      {timedOut ? (
        <div className="student-error student-timeout" role="alert">
          <p className="student-error__title">结果待确认</p>
          <p>网络超时，订单可能已创建。请先查询结果，不要重复下单。</p>
          <div className="student-error__actions">
            <button type="button" className="student-primary" disabled={busy} onClick={queryResult}>
              查询结果
            </button>
            <button type="button" className="student-secondary" disabled={busy} onClick={runSubmit}>
              重试同一请求
            </button>
          </div>
          {queryError ? <p className="student-error__note">{queryError}</p> : null}
        </div>
      ) : null}

      {snapshot.status === 'error' && errorView ? (
        <div className="student-error" role="alert">
          <p>{errorView.message}</p>
          <div className="student-error__actions">
            {errorView.action === 'retry' ? (
              <button type="button" className="student-secondary" disabled={busy} onClick={runSubmit}>
                {errorView.actionLabel}
              </button>
            ) : (
              <button
                type="button"
                className="student-secondary"
                onClick={errorView.action === 'back-to-slot' ? onBack : onBackToMenu}
              >
                {errorView.actionLabel}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {localError ? (
        <div className="student-error" role="alert">
          <p>{localError}</p>
        </div>
      ) : null}

      {source.mode === 'sample' ? (
        <section className="student-scenario" aria-labelledby="student-scenario-title">
        <h3 id="student-scenario-title" className="student-section-title">
          样例场景（仅演示）
        </h3>
        <div className="student-scenario__options" role="group" aria-label="选择样例提交场景">
          {SCENARIO_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`student-scenario__item${scenario === option.value ? ' is-active' : ''}`}
              aria-pressed={scenario === option.value}
              disabled={busy}
              onClick={() => changeScenario(option.value)}
            >
              <span className="student-scenario__label">{option.label}</span>
              <span className="student-scenario__hint">{option.hint}</span>
            </button>
          ))}
        </div>
        <p className="student-scenario__note">切换场景只影响下一次提交。</p>
        </section>
      ) : null}

      <footer className="student-summary">
        <button
          type="button"
          className="student-primary"
          disabled={busy || timedOut || !snapshot.canConfirm}
          onClick={runSubmit}
        >
          {busy ? '提交中…' : source.mode === 'real' ? '确认下单' : '确认下单（模拟付款）'}
        </button>
        {busy ? (
          <p className="student-progress" role="status">
            正在提交，请稍候…
          </p>
        ) : null}
        {timedOut ? (
          <p className="student-summary__hint">请先查询结果或重试同一请求，不要重复下单。</p>
        ) : null}
      </footer>

      {source.mode === 'sample' ? <DemoModeNotice /> : null}
    </section>
  );
}