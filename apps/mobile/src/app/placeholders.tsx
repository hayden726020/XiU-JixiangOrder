export function MerchantPlaceholder() {
  return (
    <section className="module-panel" aria-labelledby="merchant-title">
      <p className="badge">公共占位 · 非档口业务实现</p>
      <h2 id="merchant-title">档口入口待接入</h2>
      <p className="lead">该入口由公共层预留，档口页面由漪x3在 merchant 模块内实现后注册。</p>
    </section>
  );
}

export function AdminPlaceholder() {
  return (
    <section className="module-panel" aria-labelledby="admin-title">
      <p className="badge">公共占位 · 非管理业务实现</p>
      <h2 id="admin-title">管理员入口待实现</h2>
      <p className="lead">该入口由公共层预留，S0 不包含管理功能。</p>
    </section>
  );
}