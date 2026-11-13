export default function StudentHome() {
  return (
    <section className="module-panel" aria-labelledby="student-title">
      <p className="badge">S0 · 样例占位（非学生业务页面）</p>
      <h2 id="student-title">学生端入口已接通</h2>
      <p className="lead">
        这段文字在统一应用内显示，说明学生模块已经由公共入口加载。
      </p>

      <div className="notice">
        <strong>魈嘶改这里即可验证：</strong>
        <code>apps/mobile/src/modules/student/StudentHome.tsx</code>
        <p>把标题或本段文字改成任意内容，刷新浏览器即可看到变化，不需要修改公共文件。</p>
      </div>

      <h3>当前范围</h3>
      <ul className="plain-list">
        <li>已接入：模块导出、路由 <code>#/student</code>、返回角色入口。</li>
        <li>未实现：菜单、时段、下单、订单、定位、登录和后端请求（S0 不扩展）。</li>
      </ul>

      <p className="hint">
        入口文件 <code>apps/mobile/src/modules/student/index.ts</code> 导出模块；
        公共注册表 <code>apps/mobile/src/app/moduleRegistry.ts</code> 负责挂载。
      </p>
    </section>
  );
}