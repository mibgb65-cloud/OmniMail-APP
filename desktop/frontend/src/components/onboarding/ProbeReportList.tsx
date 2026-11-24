import { useI18n } from "../../i18n";
import type { ConnectionTestReport } from "../../services/backendClient";
import type { ProviderId } from "../../types/account";
import { HandshakeSteps } from "../common/HandshakeSteps";
import { ProviderIcon } from "../common/ProviderIcon";

export function ProbeReportList({ report }: { report: ConnectionTestReport }) {
  return <HandshakeSteps running={false} report={report} />;
}

export function ProviderStepsCard({
  provider,
  steps,
}: {
  provider: ProviderId;
  steps: string[];
}) {
  const { t } = useI18n();

  return (
    <div className="settings-card">
      <div className="row" style={{ gap: 10 }}>
        <ProviderIcon provider={provider} size={28} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {t("onboarding.prepStepsTitle")}
          </div>
          <div className="text-xs text-muted">
            {t("onboarding.prepStepsSub")}
          </div>
        </div>
      </div>
      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
