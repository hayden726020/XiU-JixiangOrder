import { useEffect, useState } from 'react';
import type { AdminQualification } from '../types';
import type { AdminSource } from '../data/source';
import { createRequestId } from '../../../shared/requestId';

interface QualificationReviewPageProps {
  source: AdminSource;
}

export default function QualificationReviewPage({ source }: QualificationReviewPageProps) {
  const [items, setItems] = useState<AdminQualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setItems(await source.listQualifications());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '资质列表读取失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function review(item: AdminQualification, decision: 'APPROVE' | 'REJECT', reason?: string) {
    if (busyId) return;
    setBusyId(item.merchantId);
    setError('');
    setNotice('');
    try {
      const updated = await source.reviewQualification(item.merchantId, {
        requestId: createRequestId('admin-qualification-review'),
        expectedVersion: item.version,
        decision,
        ...(reason ? { reason } : {}),
      });
      setItems((current) => current.map((row) => (
        row.merchantId === updated.merchantId ? updated : row
      )));
      setNotice(
        decision === 'APPROVE'
          ? `已通过「${item.merchantName}」的资质审核。`
          : `已驳回「${item.merchantName}」的资质，原因已记录。`,
      );
      setRejectingId(null);
      setRejectReason('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '审核保存失败。');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-settings admin-review" data-admin-qualifications>
      <header className="admin-orders__header">
        <h2 className="admin-orders__title">档口资质审核</h2>
        <p className="admin-muted">接收档口上传的营业执照与食品经营许可证；通过后档口才能创建店铺。</p>
      </header>

      {error && <p className="check-error" role="alert" data-admin-error>{error}</p>}
      {notice && <p className="check-ok" role="status" data-admin-notice>{notice}</p>}
      {loading ? <p className="admin-orders__loading">正在读取待审核资质…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="admin-muted">暂无待审核资质。</p>
      ) : (
        <ul className="admin-order-list">
          {items.map((item) => (
            <li key={item.merchantId} className="admin-settings__card admin-review__card">
              <div className="admin-review__head">
                <strong>{item.merchantName}</strong>
                <span className={`admin-tag admin-tag--${item.status.toLowerCase()}`}>
                  {item.status === 'PENDING' ? '待审核' : item.status === 'APPROVED' ? '已通过' : '已驳回'}
                </span>
              </div>
              <dl className="admin-settings__kv">
                <div>
                  <dt>联系人</dt>
                  <dd>{item.contactName ?? '未填写'} · {item.contactPhone ?? '未填写'}</dd>
                </div>
                <div>
                  <dt>营业执照</dt>
                  <dd>{item.businessLicense.fileName}</dd>
                </div>
                <div>
                  <dt>食品经营许可证</dt>
                  <dd>{item.foodPermit.fileName}</dd>
                </div>
                <div>
                  <dt>提交时间</dt>
                  <dd>{item.submittedAt || '未记录'}</dd>
                </div>
                {item.reviewReason && (
                  <div>
                    <dt>驳回原因</dt>
                    <dd>{item.reviewReason}</dd>
                  </div>
                )}
              </dl>

              {item.status === 'PENDING' ? (
                <div className="action-bar">
                  <button
                    type="button"
                    className="action-button action-button--primary"
                    onClick={() => void review(item, 'APPROVE')}
                    disabled={busyId !== null}
                    data-action="approve-qualification"
                  >
                    {busyId === item.merchantId ? '保存中…' : '审核通过'}
                  </button>
                  <button
                    type="button"
                    className="action-button action-button--secondary"
                    onClick={() => { setRejectingId(item.merchantId); setRejectReason(''); }}
                    disabled={busyId !== null}
                    data-action="reject-qualification"
                  >
                    驳回
                  </button>
                </div>
              ) : null}

              {rejectingId === item.merchantId && (
                <div className="admin-review__reject">
                  <label>
                    驳回原因
                    <input
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      maxLength={200}
                      aria-label="驳回原因"
                    />
                  </label>
                  <button
                    type="button"
                    className="action-button action-button--secondary"
                    onClick={() => void review(item, 'REJECT', rejectReason.trim())}
                    disabled={rejectReason.trim().length < 2 || busyId !== null}
                    data-action="confirm-reject"
                  >
                    确认驳回
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="action-bar">
        <button type="button" className="action-button" onClick={() => void load()} data-action="refresh-qualifications">
          刷新列表
        </button>
      </div>
    </div>
  );
}