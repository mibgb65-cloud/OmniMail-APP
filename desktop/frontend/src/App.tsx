import { useState } from "react";
import { DesktopService } from "../bindings/omnimail";

export default function App() {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState("尚未检查");

  async function checkConnection() {
    setChecking(true);
    setStatus("正在连接桌面后端…");
    try {
      setStatus(await DesktopService.CheckConnection());
    } catch {
      setStatus("无法连接桌面后端，请在 OmniMail 桌面窗口中重试。");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">桌面开发预览</p>
        <h1>OmniMail</h1>
        <p className="intro">桌面项目已初始化，尚未接入邮箱账号。</p>
      </header>
      <section className="card" aria-labelledby="bridge-heading">
        <h2 id="bridge-heading">前后端连通检查</h2>
        <p>验证 React 界面能否通过 Wails 调用 Go 服务。</p>
        <button type="button" onClick={checkConnection} disabled={checking}>
          {checking ? "检查中…" : "检查连接"}
        </button>
        <p className="status" role="status">
          {status}
        </p>
      </section>
    </main>
  );
}
