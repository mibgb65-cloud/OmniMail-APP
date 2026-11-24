import { useState } from "react";
import { aiApi, parseBackendError } from "../../../services/backendClient";
import { AsyncActionButton } from "../../common/AsyncActionButton";

export function TranslationConnectionTest({ disabled }: { disabled: boolean }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string }>();
  const test = async () => {
    setTesting(true);
    setResult(undefined);
    try {
      const report = await aiApi.testTranslationConnection();
      setResult({
        ok: report.ok,
        message: report.ok
          ? `接口连通正常 · ${report.latencyMs} ms`
          : report.message,
      });
    } catch (err) {
      setResult({ ok: false, message: parseBackendError(err).message });
    } finally {
      setTesting(false);
    }
  };
  return (
    <div className="row translation-test-result">
      <AsyncActionButton
        status={testing ? "loading" : "idle"}
        variant="secondary"
        size="sm"
        idleLabel="测试连通性"
        loadingLabel="正在测试…"
        disabled={disabled}
        onClick={() => void test()}
      />
      {result && (
        <span
          role="status"
          className={result.ok ? "pill pill-success" : "text-xs text-muted"}
        >
          {result.message}
        </span>
      )}
    </div>
  );
}
