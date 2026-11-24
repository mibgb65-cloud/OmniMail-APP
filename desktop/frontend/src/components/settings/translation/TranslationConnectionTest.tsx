import { useState } from "react";
import { useI18n } from "../../../i18n";
import { aiApi, parseBackendError } from "../../../services/backendClient";
import { AsyncActionButton } from "../../common/AsyncActionButton";

export function TranslationConnectionTest({ disabled }: { disabled: boolean }) {
  const { t } = useI18n();
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
          ? t("settings.transConnOkLatency", { ms: report.latencyMs })
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
        idleLabel={t("settings.transTestConnection")}
        loadingLabel={t("settings.transTestingConnection")}
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
