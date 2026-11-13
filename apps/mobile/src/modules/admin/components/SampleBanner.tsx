export default function SampleBanner() {
  return (
    <div className="admin-banner" role="status">
      <strong>样例数据 · 只读</strong>
      <span>不代表真实订单、库存与现场人数；未连接后端，保存功能尚未接入。</span>
      <span className="admin-banner__tag">DRAFT v0.2</span>
    </div>
  );
}