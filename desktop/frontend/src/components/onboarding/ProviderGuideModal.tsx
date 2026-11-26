import { isEnterpriseProviderId } from "../../data/providers";
import { useI18n } from "../../i18n";
import type { ProviderId } from "../../types/account";
import { AsyncActionButton } from "../common/AsyncActionButton";
import { SidebarLivePreviewCard } from "./AccountNamingWidgets";
import { PreparationGuideCard } from "./ProbeReportList";
import {
  ProviderConnectShell,
  ProviderSummaryCard,
} from "./ProviderConnectShell";
import { ProviderGuideForm } from "./ProviderGuideForm";
import { useProviderGuideController } from "./useProviderGuideController";

export function ProviderGuideModal({ provider }: { provider: ProviderId }) {
  const { t } = useI18n();
  const c = useProviderGuideController(provider);
  const isEnterprise = isEnterpriseProviderId(provider);

  return (
    <ProviderConnectShell
      heading={t("onboarding.connectHeading", { provider: c.meta.name })}
      badgeText={
        isEnterprise ? t("onboarding.connectBadgeEnterprise") : undefined
      }
      subtitle={
        isEnterprise ? t("onboarding.connectSubtitleEnterprise") : undefined
      }
      backDisabled={c.status === "loading" || c.status === "success"}
      onClose={() => c.workspace.setOverlay({ type: "none" })}
      onBack={() => c.workspace.setOverlay({ type: "add-account" })}
      primaryAction={
        <AsyncActionButton
          className="pcm-btn-connect"
          idleIcon="check"
          status={c.status}
          disabled={!c.formReady}
          idleLabel={t("onboarding.testAndConnectBtn")}
          loadingLabel={c.stepLabel || t("common.handshakeRunningIdle")}
          successLabel={t("onboarding.testAndConnectSuccess")}
          errorLabel={t("onboarding.testAndConnectError")}
          onClick={() => void c.handleTestAndConnect()}
        />
      }
    >
      <ProviderSummaryCard
        provider={provider}
        name={c.meta.name}
        domainHint={c.meta.domainHint}
        mode="tls"
      />

      <div className="pcm-columns">
        <PreparationGuideCard
          provider={provider}
          steps={c.meta.steps}
          officialGuideUrl={c.meta.officialGuideUrl}
          previewSlot={
            <SidebarLivePreviewCard
              provider={provider}
              displayName={c.accountName}
              email={c.email}
              placeholderEmail={c.meta.emailPlaceholder}
            />
          }
        />
        <ProviderGuideForm
          provider={provider}
          meta={c.meta}
          email={c.email}
          accountName={c.accountName}
          secret={c.secret}
          imapHost={c.imapHost}
          imapPort={c.imapPort}
          smtpHost={c.smtpHost}
          smtpPort={c.smtpPort}
          detectedMxHost={c.detectedMx?.[0]}
          detectedProviderLabel={c.detectedMx?.[1]}
          status={c.status}
          report={c.report}
          onEmailChange={c.bindField(c.setEmail)}
          onEmailBlur={(val) => void c.autoResolveEmail(val)}
          onAccountNameChange={(next) => {
            c.setUserEditedName(true);
            c.bindField(c.setAccountName)(next);
          }}
          onSecretChange={c.bindField(c.setSecret)}
          onImapHostChange={c.bindField(c.setImapHost)}
          onImapPortChange={c.bindField(c.setImapPort)}
          onSmtpHostChange={c.bindField(c.setSmtpHost)}
          onSmtpPortChange={c.bindField(c.setSmtpPort)}
          onStepLabelChange={c.setStepLabel}
        />
      </div>
    </ProviderConnectShell>
  );
}
