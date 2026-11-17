import { useEffect, useState } from 'react';
import { runAfterBackPress } from '../../../shared/backPress';
import type { OrderDraft } from '../state/orderDraft';
import { useStudentSessionGate } from '../state/useStudentSessionGate';
import type { DemoScenario, MenuResponse, ShopSummary, SlotDto, StudentSource } from '../types';
import { sanitizeMessage } from '../utils/errorSemantics';
import { filterDishesByShop } from '../utils/dishShopFilter';
import { CURRENT_SHOP_PREFIX, DEMO_DATA_LABEL } from '../utils/shopTexts';
import { formatYuan } from '../utils/money';
import { toSubmitErrorView } from '../utils/orderSubmitView';
import { ORDER_REMARK_MAX_LENGTH } from '../utils/remark';
import DemoModeNotice from '../components/DemoModeNotice';
import LoginGuide from '../components/LoginGuide';
import SampleBanner from '../components/SampleBanner';
import '../booking.css';

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

const QUICK_REMARKS = ['不要辣', '少放盐', '不要香菜', '多加饭', '打包带走'] as const;

function splitRemarks(value: string): string[] {
  return value
    .split(/[，,、\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
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

function PaperclipIcon() {
  return (
    <svg className="confirm-paperclip" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

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

function slotTimeRange(slot: SlotDto): string {
  const start = parseSlot(slot);
  const end = /T(\d{2}:\d{2})/.exec(slot.slotEnd);
  return `${start.time}—${end ? end[1] : ''}`.trim();
}

export interface ConfirmPageProps {
  source: StudentSource;
  draft: OrderDraft;
  shop: ShopSummary;
  onBack: () => void;
  onBackToMenu: () => void;
  onSubmitted: (orderId: string) => void;
}

export default function ConfirmPage({
  source,
  draft,
  shop,
  onBack,
  onBackToMenu,
  onSubmitted,
}: ConfirmPageProps) {
  const { gate, refresh } = useStudentSessionGate();
  const [snapshot, setSnapshot] = useState(() => draft.getState());
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [menuStatus, setMenuStatus] = useState<LoadStatus>('loading');
  const [scenario, setScenario] = useState<DemoScenario>(() => source.getScenario());
  const [busy, setBusy] = useState(false);
  const [queryError, setQueryError] = useState('');
  const [remark, setRemark] = useState(() => draft.getState().remark);

  useEffect(() => {
    if (draft.getState().status === 'success') {
      draft.resetSubmission();
      setSnapshot(draft.getState());
    }
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    const token = draft.beginMenuRead();
    setMenuStatus('loading');
    source.getMenu(snapshot.date).then(
      (data) => {
        if (!cancelled && draft.isMenuReadCurrent(token)) {
          setMenu(data);
          setMenuStatus('ready');
          draft.applyDishCatalog(filterDishesByShop(data.dishes, shop.merchantId));
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
  }, [source, draft, shop.merchantId, snapshot.date]);

  const realLoggedOut = source.mode === 'real' && !gate.usable;

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
  }

  function toggleRemarkTag(tag: string): void {
    const tags = splitRemarks(remark);
    const next = tags.includes(tag)
      ? tags.filter((item) => item !== tag)
      : [...tags, tag];
    updateRemark(next.join('，'));
  }

  const activeRemarkTags = splitRemarks(remark);

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
      ? '确认信息尚未就绪。'
      : !itemsReady
        ? '部分菜品已变化，请返回菜单重新确认。'
        : !slotReady
          ? '所选时段已失效，请返回时段页重新选择。'
          : '';

  if (realLoggedOut) {
    return (
      <section className="student-booking student-booking--confirm" aria-labelledby="student-confirm-title">
        <div className="booking-hero">
          <div className="booking-nav">
            <button type="button" className="booking-nav__back student-back" aria-label="返回时段" onClick={(event) => runAfterBackPress(event.currentTarget, onBack)}>
              <ChevronLeftIcon />
            </button>
            <h2 id="student-confirm-title" className="booking-nav__title">确认订单</h2>
            <span />
          </div>
        </div>
        <div className="booking-body" style={{ marginTop: '0.8rem' }}>
          <LoginGuide gate={gate} onRecheck={refresh} onBack={onBackToMenu} />
        </div>
      </section>
    );
  }

  return (
    <section className="student-booking student-booking--confirm" aria-labelledby="student-confirm-title">
      {source.mode === 'sample' ? <SampleBanner /> : null}

      <div className="booking-hero">
        <div className="booking-nav">
          <button type="button" className="booking-nav__back student-back" aria-label="返回时段" onClick={(event) => runAfterBackPress(event.currentTarget, onBack)}>
            <ChevronLeftIcon />
          </button>
          <h2 id="student-confirm-title" className="booking-nav__title">确认订单</h2>
          {source.mode === 'sample' ? <span className="booking-nav__mode">样例数据</span> : <span />}
        </div>
        <div className="confirm-bubble">
          <span className="confirm-bubble__spark" aria-hidden="true">✦</span>
          <span>核对一下，就可以啦</span>
        </div>
      </div>

      <div className="booking-body">
        {source.mode === 'real' && gate.usable ? (
          <p className="student-session-note">当前登录：{gate.identityText}（仅用于核对）</p>
        ) : null}

        {menuStatus === 'loading' ? (
          <p className="booking-notice">正在读取确认信息…</p>
        ) : null}

        {menuStatus === 'error' ? (
          <div className="booking-error" role="alert">
            <p>确认信息读取失败，请返回时段页重试。</p>
            <button type="button" className="student-back" onClick={(event) => runAfterBackPress(event.currentTarget, onBack)}>
              返回时段页
            </button>
          </div>
        ) : null}

        {menuStatus === 'ready' && menu ? (
          <>
            {/* 档口与菜品卡片 */}
            <section
              className="confirm-stall-card"
              aria-labelledby="student-confirm-summary-title"
              data-shop-demo={source.mode === 'sample' ? 'true' : 'false'}
            >
              <PaperclipIcon />
              <div className="confirm-stall-header">
                <span className="confirm-stall-header__badge">
                  {CURRENT_SHOP_PREFIX}：{shop.name}
                  {source.mode === 'sample' ? ` · ${DEMO_DATA_LABEL}` : ''}
                </span>
              </div>

              <h3 id="student-confirm-summary-title" className="booking-section-title" style={{ fontSize: '1.02rem', margin: '0 0 0.85rem' }}>
                订单摘要
              </h3>

              <ul className="confirm-dish-list">
                {lines.map((line) => (
                  <li key={line.dishId} className="confirm-dish-item">
                    <span className="confirm-dish-thumb" role="img" aria-label={`菜品图：${line.name}`} />
                    <div className="confirm-dish-info">
                      <p className="confirm-dish-name">{line.name} × {line.quantity}</p>
                      <p className="confirm-dish-qty">单价 {formatYuan(line.unitPriceFen)}</p>
                    </div>
                    <span className="confirm-dish-amount">{formatYuan(line.subtotalFen)}</span>
                  </li>
                ))}
              </ul>

              <div className="confirm-stall-total">
                <span className="confirm-stall-total__label">商品合计</span>
                <span className="confirm-stall-total__amount">合计 {formatYuan(snapshot.previewFen)}</span>
              </div>
              <p className="confirm-amount-note">金额以服务端返回为准，本地预估仅用于预览</p>
            </section>

            {/* 预约信息卡片 */}
            <section aria-labelledby="confirm-info-title">
              <div className="confirm-section-head">
                <h3 id="confirm-info-title" className="booking-section-title" style={{ margin: 0 }}>
                  预约信息
                </h3>
                <span className="confirm-sparkle" aria-hidden="true">✦</span>
              </div>

              <div className="confirm-info-table" aria-label="预约信息">
                <div className="confirm-info-row">
                  <span>取餐日期</span>
                  <span>今天</span>
                </div>
                <div className="confirm-info-row">
                  <span>取餐时段</span>
                  <span>{selectedSlot ? (slotTimeRange(selectedSlot) || slotLabel(selectedSlot)) : '未选择'}</span>
                </div>
                <div className="confirm-info-row">
                  <span>用餐方式</span>
                  <span>{snapshot.diningMode ? MODE_TEXT[snapshot.diningMode] : '未选择'}</span>
                </div>
                {selectedSlot ? (
                  <p className="confirm-info-note">时段核对：{slotLabel(selectedSlot)}</p>
                ) : null}
              </div>
            </section>

            {/* 订单备注 */}
            <section className="confirm-remark-card" aria-labelledby="confirm-remark-title">
              <div className="confirm-remark-head">
                <h3 id="confirm-remark-title" className="booking-section-title" style={{ margin: 0 }}>
                  订单备注<span className="confirm-remark-optional">选填</span>
                </h3>
                <span className="confirm-remark-count">{remark.length}/{ORDER_REMARK_MAX_LENGTH}</span>
              </div>
              <textarea
                className="confirm-remark-input"
                value={remark}
                maxLength={ORDER_REMARK_MAX_LENGTH}
                rows={3}
                placeholder="口味、忌口、取餐提醒等，档口会看到"
                aria-label="订单备注"
                disabled={busy}
                onChange={(event) => updateRemark(event.target.value)}
              />
              <div className="confirm-remark-tags" role="group" aria-label="常用备注">
                {QUICK_REMARKS.map((tag) => {
                  const active = activeRemarkTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`confirm-remark-tag${active ? ' is-active' : ''}`}
                      aria-pressed={active}
                      disabled={busy}
                      onClick={() => toggleRemarkTag(tag)}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <div className="confirm-remark-foot">
                <span>备注会随订单提交给档口</span>
                <button
                  type="button"
                  className="confirm-remark-clear"
                  disabled={busy || remark.length === 0}
                  onClick={() => updateRemark('')}
                >
                  清空备注
                </button>
              </div>
            </section>

            {/* 取消说明 */}
            <section className="confirm-rule-card" aria-label="取消说明">
              <div className="confirm-rule-head">
                <InfoIcon />
                <span>取消说明</span>
              </div>
              <ul>
                <li>接单前可直接取消</li>
                <li>接单后需由档口处理申请</li>
              </ul>
            </section>

            {/* 模拟付款/支付说明 */}
            <div className="confirm-pay-tape">
              {source.mode === 'real'
                ? '当前不发生真实资金交易。'
                : '模拟付款，不发生资金交易。'}
            </div>
          </>
        ) : null}

        {/* 超时错误 */}
        {timedOut ? (
          <div className="booking-error" role="alert">
            <p style={{ fontWeight: 800 }}>结果待确认</p>
            <p>网络超时，订单可能已创建。请先查询结果，不要重复下单。</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
              <button type="button" className="student-primary" disabled={busy} onClick={queryResult}>
                查询结果
              </button>
              <button type="button" disabled={busy} onClick={runSubmit}>
                重试同一请求
              </button>
            </div>
            {queryError ? <p style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>{queryError}</p> : null}
          </div>
        ) : null}

        {/* 业务错误 */}
        {!timedOut && snapshot.status === 'error' && errorView && errorView.action !== 'login' ? (
          <div className="booking-error" role="alert">
            <p>{errorView.message}</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
              {errorView.action === 'retry' ? (
                <button type="button" disabled={busy} onClick={runSubmit}>
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

        {/* 样例场景选择（仅样例模式，便于自测与评审） */}
        {source.mode === 'sample' ? (
          <section className="confirm-scenario-box" aria-labelledby="student-scenario-title">
            <p id="student-scenario-title" className="student-section-title">
              样例场景（仅演示）
            </p>
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
            <p style={{ margin: '0.4rem 0 0', color: '#6b7688', fontSize: '0.68rem', textAlign: 'center' }}>
              切换场景只影响下一次提交。
            </p>
          </section>
        ) : null}

        {source.mode === 'sample' ? <DemoModeNotice /> : null}
      </div>

      {/* 底部固定结算条 */}
      <footer className="confirm-bottom-bar">
        <div className="confirm-bottom-bar__left">
          <span className="confirm-bottom-bar__label">合计</span>
          <span className="confirm-bottom-bar__total">{formatYuan(snapshot.previewFen)}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: '14rem' }}>
          <button
            type="button"
            className="booking-submit student-primary"
            disabled={!canSubmit}
            onClick={runSubmit}
          >
            {busy ? '提交中…' : source.mode === 'real' ? '确认下单' : '确认下单（模拟付款）'}
          </button>
          {busy ? (
            <span style={{ fontSize: '0.66rem', color: '#5d6c85', marginTop: '0.2rem' }}>
              正在提交，请稍候…
            </span>
          ) : disabledReason ? (
            <span style={{ fontSize: '0.66rem', color: '#7f1d1d', marginTop: '0.2rem', textAlign: 'right' }}>
              {disabledReason}
            </span>
          ) : null}
        </div>
      </footer>
    </section>
  );
}
