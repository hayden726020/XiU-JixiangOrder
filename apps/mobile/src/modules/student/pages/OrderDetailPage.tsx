import { useEffect, useState } from 'react';
import type { StudentOrder, StudentSource } from '../types';
import { isApiError } from '../types';
import type { CrowdView } from '../utils/crowdView';
import { toCrowdView } from '../utils/crowdView';
import { CANCEL_RULES, CHANGE_DINING_NOTE } from '../utils/orderDetailTexts';
import { toOrderStatusView } from '../utils/orderStatusView';
import DemoModeNotice from '../components/DemoModeNotice';
import OrderCrowdNote from '../components/OrderCrowdNote';
import RealModeNotice from '../components/RealModeNotice';
import SampleBanner from '../components/SampleBanner';

type LoadStatus = 'loading' | 'ready' | 'error';

export interface OrderDetailPageProps {
  source: StudentSource;
  orderId: string;
  onBack: () => void;
}

export default function OrderDetailPage({ source, orderId, onBack }: OrderDetailPageProps) {
  const [order, setOrder] = useState<StudentOrder | null>(null);
  const [crowd, setCrowd] = useState<CrowdView | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorText, setErrorText] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setErrorText('');
    setCrowd(null);
    source.getOrder(orderId).then(
      (data) => {
        if (cancelled) {
          return;
        }
        setOrder(data);
        setStatus('ready');
        source.getCrowd(data.slotId).then(
          (reference) => {
            if (!cancelled) {
              setCrowd(toCrowdView(reference));
            }
          },
          () => {
            if (!cancelled) {
              setCrowd(null);
            }
          },
        );
      },
      (error: unknown) => {
        if (!cancelled) {
          setOrder(null);
          setStatus('error');
          setErrorText(
            isApiError(error) && error.code === 'ORDER_NOT_FOUND'
              ? '订单不存在或对当前身份不可见。'
              : '订单信息读取失败，请重试',
          );
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, orderId, reloadToken]);

  const view = order ? toOrderStatusView(order) : null;

  return (
    <section className="student-page" aria-labelledby="student-order-title">
      {source.mode === 'sample' ? <SampleBanner /> : <RealModeNotice />}

      <button type="button" className="student-secondary student-back" onClick={onBack}>
        ← 返回菜单
      </button>

      <header className="student-page__head">
        <p className="student-kicker">
          {source.mode === 'real' ? 'S10 · 订单详情（只读）' : 'S6 · 订单详情（只读）'}
        </p>
        <h2 id="student-order-title">订单详情</h2>
        <p className="student-page__lead">
          {source.mode === 'real'
            ? '只读展示服务端订单；状态与取餐码按返回展示。'
            : '只读展示样例订单；当前不会发生真实取餐或资金交易。'}
        </p>
      </header>

      {status === 'loading' ? <p className="student-loading">正在读取订单信息…</p> : null}

      {status === 'error' ? (
        <div className="student-error" role="alert">
          <p>{errorText}</p>
          <div className="student-error__actions">
            <button
              type="button"
              className="student-secondary"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              重新读取
            </button>
          </div>
        </div>
      ) : null}

      {status === 'ready' && view ? (
        <>
          <section className="student-order-head" aria-label="订单状态">
            <span className="student-status-badge">{view.statusLabel}</span>
            {view.demoLabel ? <span className="student-order-demo">{view.demoLabel}</span> : null}
            <p className="student-order-id">订单号 {view.orderId}</p>
          </section>

          {view.status === 'CANCELLED' ? (
            <section className="student-cancel-path" aria-label="取消路径">
              <p className="student-cancel-path__title">订单已取消</p>
              <p className="student-cancel-path__reason">{view.cancelText || '未提供取消原因'}</p>
            </section>
          ) : (
            <section aria-labelledby="student-timeline-title">
              <h3 id="student-timeline-title" className="student-section-title">
                订单进度
              </h3>
              <ol className="student-timeline">
                {view.steps.map((step) => (
                  <li
                    key={step.name}
                    className={`student-timeline__step${step.reached ? ' is-reached' : ''}${
                      step.current ? ' is-current' : ''
                    }`}
                  >
                    <span className="student-timeline__dot" aria-hidden="true" />
                    <span className="student-timeline__name">{step.name}</span>
                  </li>
                ))}
              </ol>
              {view.delayText ? <p className="student-order-note">{view.delayText}</p> : null}
              {view.pickedUpText ? <p className="student-order-note">{view.pickedUpText}</p> : null}
            </section>
          )}

          <section className="student-confirm" aria-labelledby="student-order-items-title">
            <h3 id="student-order-items-title" className="student-section-title">
              菜品与金额
            </h3>
            <ul className="student-confirm__lines">
              {view.items.map((item, index) => (
                <li key={`${item.name}-${index}`} className="student-confirm__line">
                  <div>
                    <p className="student-confirm__name">
                      {item.name} × {item.quantity}
                    </p>
                    <p className="student-confirm__meta">单价 {item.unitPriceText}</p>
                  </div>
                  <span className="student-confirm__amount">{item.subtotalText}</span>
                </li>
              ))}
            </ul>
            <p className="student-total">合计 {view.totalText}</p>
            <p className="student-total__note">
              金额为{source.mode === 'real' ? '服务端' : '样例服务端'}返回结果
            </p>
          </section>

          <section className="student-info" aria-label="预约与订单信息">
            <p className="student-info__row">
              <span>时段</span>
              <span>{view.slotRangeText || '未提供'}</span>
            </p>
            <p className="student-info__row">
              <span>用餐方式</span>
              <span>{view.diningModeText}</span>
            </p>
            <p className="student-info__row">
              <span>创建时间</span>
              <span>{view.createdText || '未提供'}</span>
            </p>
          </section>

          <section className="student-info" aria-label="取餐码">
            <p className="student-info__row">
              <span>取餐码</span>
              <span>{view.pickupCodeText}</span>
            </p>
            {view.pickupCodeNotice ? (
              <p className="student-order-note">{view.pickupCodeNotice}</p>
            ) : null}
          </section>

          <section className="student-rule" aria-label="取消规则">
            <h3 className="student-section-title">取消规则</h3>
            {CANCEL_RULES.map((rule) => (
              <p key={rule}>{rule}</p>
            ))}
          </section>

          <section className="student-rule" aria-label="变更用餐方式">
            <h3 className="student-section-title">变更用餐方式</h3>
            <p>{view.changeDiningRuleText}</p>
            <p>{CHANGE_DINING_NOTE}</p>
          </section>

          <section className="student-rule" aria-label="支付说明">
            <h3 className="student-section-title">支付说明</h3>
            <p>{view.paymentText}</p>
          </section>

          <OrderCrowdNote crowd={crowd} />
        </>
      ) : null}

      {source.mode === 'sample' ? <DemoModeNotice /> : null}
    </section>
  );
}