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
  return (
    <div className="settings-card">
      <div className="row" style={{ gap: 10 }}>
        <ProviderIcon provider={provider} size={28} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>接入前准备步骤</div>
          <div className="text-xs text-muted">
            按以下步骤在服务商网页端获取专用凭据
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
