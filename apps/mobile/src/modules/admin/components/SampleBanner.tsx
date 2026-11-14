export default function SampleBanner() {
  return (
    <div className="admin-banner" role="status">
      <strong>样例数据 · 只读</strong>
      <span>筛选、分页与订单详情均为样例，不请求服务端；不代表真实订单、库存与现场人数。</span>
      <span className="admin-banner__tag">DRAFT v0.3</span>
    </div>
  );
}