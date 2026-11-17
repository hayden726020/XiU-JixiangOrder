interface SourceSelectPageProps {
  mode: 'sample' | 'real';
  merchantName: string | null;
  shopName: string | null;
  onSelectSample: () => void;
  onSelectReal: () => void;
}

export default function SourceSelectPage({
  mode,
  merchantName,
  shopName,
  onSelectSample,
  onSelectReal,
}: SourceSelectPageProps) {
  return (
    <div className="merchant-view source-select-page">
      <section className="source-select" aria-labelledby="source-select-title">
        <header className="merchant-view__header">
          <div>
            <h2 id="source-select-title">选择数据模式</h2>
            <p className="lead">
              {merchantName
                ? `已注册商家：${merchantName}${shopName ? ` · ${shopName}` : ''}。`
                : '注册完成后，请选择进入档口工作台的数据来源。'}
            </p>
          </div>
        </header>

        <div className="source-select__options">
          <button
            type="button"
            className={mode === 'sample' ? 'source-option source-option--active' : 'source-option'}
            onClick={onSelectSample}
            data-source-option="sample"
          >
            <span className="source-option__badge">样例模式</span>
            <strong className="source-option__title">立即体验完整流程</strong>
            <span className="source-option__desc">
              内置样例订单、菜单与时段保存在本机内存；商家资料保存在本机浏览器，不写入共同服务。
            </span>
            <span className="source-option__meta">
              {mode === 'sample' ? '当前已选' : '无需登录，随时体验'}
            </span>
            <span className="source-option__cta">使用样例数据 →</span>
          </button>

          <button
            type="button"
            className={mode === 'real' ? 'source-option source-option--active' : 'source-option'}
            onClick={onSelectReal}
            data-source-option="real"
          >
            <span className="source-option__badge source-option__badge--real">真实模式</span>
            <strong className="source-option__title">连接共同服务</strong>
            <span className="source-option__desc">
              读取真实订单与菜单，接单、制作、核销都会提交到服务端；需要档口演示账号登录。
            </span>
            <span className="source-option__meta">
              {mode === 'real' ? '当前已选 · 需档口账号登录' : '需档口账号登录'}
            </span>
            <span className="source-option__cta">使用真实数据 →</span>
          </button>
        </div>

        <p className="hint" data-source-select-hint>
          进入工作台后，可在页面顶部「数据源」处随时切换样例与真实模式。
        </p>
      </section>
    </div>
  );
}