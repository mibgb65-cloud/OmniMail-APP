import { useI18n, type TranslationKey } from "../../i18n";
import { Checkbox } from "../common/Checkbox";
import { Icon } from "../common/Icon";
import type {
  ExternalLinkInspection,
  ExternalLinkReason,
} from "../mail/reader/externalLinkGuard";

const REASON_KEYS: Record<ExternalLinkReason, TranslationKey> = {
  "spoofed-text": "externalLink.reasonSpoofed",
  punycode: "externalLink.reasonPunycode",
  "mail-danger": "externalLink.reasonMailDanger",
  "ip-address": "externalLink.reasonIpAddress",
  "insecure-http": "externalLink.reasonInsecureHttp",
};

export function getExternalLinkHeaderKeys(
  info: ExternalLinkInspection,
): readonly [TranslationKey, TranslationKey] {
  if (info.risk !== "danger") {
    return ["externalLink.normalTitle", "externalLink.normalSubtitle"];
  }
  if (info.reasons.includes("spoofed-text")) {
    return [
      "externalLink.dangerTitleSpoofed",
      "externalLink.dangerSubtitleSpoofed",
    ];
  }
  if (info.reasons.includes("punycode")) {
    return [
      "externalLink.dangerTitlePunycode",
      "externalLink.dangerSubtitlePunycode",
    ];
  }
  return [
    "externalLink.dangerTitleMailDanger",
    "externalLink.dangerSubtitleMailDanger",
  ];
}

function getWarningNoteKey(info: ExternalLinkInspection): TranslationKey {
  const hasIp = info.reasons.includes("ip-address");
  const hasHttp = info.reasons.includes("insecure-http");
  if (hasIp && hasHttp) return "externalLink.warningNoticeHttpIp";
  return hasIp
    ? "externalLink.warningNoticeIp"
    : "externalLink.warningNoticeHttp";
}

export function ExternalLinkModalBody({
  info,
  trustChecked,
  onTrustChange,
}: {
  info: ExternalLinkInspection;
  trustChecked: boolean;
  onTrustChange: (checked: boolean) => void;
}) {
  const { t } = useI18n();

  if (info.risk === "danger") {
    const extraReasons = info.reasons.filter((r) => r !== "spoofed-text");
    const dangerUrlText =
      info.protocol === "http:"
        ? `${info.fullUrl}${t("externalLink.insecureHttpSuffix")}`
        : info.fullUrl;

    return (
      <div className="ext-link-body">
        <div className="ext-link-box is-danger">
          {info.displayText && (
            <>
              <div className="ext-link-row">
                <span className="ext-link-k">
                  {t("externalLink.shownTextLabel")}
                </span>
                <span className="ext-link-v">{info.displayText}</span>
              </div>
              <div className="ext-link-div" />
            </>
          )}
          <div className="ext-link-row">
            <span className="ext-link-k-err">
              {t("externalLink.actualDomainLabel")}
            </span>
            <span className="ext-link-host-err">{info.hostname}</span>
          </div>
          {extraReasons.length > 0 && (
            <div className="ext-link-reasons">
              {extraReasons.map((r) => (
                <span key={r} className="ext-link-reason-pill">
                  {t(REASON_KEYS[r])}
                </span>
              ))}
            </div>
          )}
          <div className="ext-link-url">{dangerUrlText}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ext-link-body">
      <div className="ext-link-box">
        <div className="ext-link-row">
          <div className="ext-link-host">
            <Icon name="globe" size={15} />
            <span className="ext-link-host-text">{info.hostname}</span>
          </div>
          <div className="ext-link-chips">
            <span
              className={`ext-link-chip ${info.protocol === "https:" ? "is-https" : "is-warn"}`}
            >
              <Icon
                name={info.protocol === "https:" ? "lock" : "spam"}
                size={11}
              />
              {t(
                info.protocol === "https:"
                  ? "externalLink.httpsBadge"
                  : "externalLink.httpBadge",
              )}
            </span>
            {info.reasons.includes("ip-address") && (
              <span className="ext-link-chip is-warn">
                <Icon name="alertCircle" size={11} />
                {t("externalLink.ipBadge")}
              </span>
            )}
          </div>
        </div>
        <div className="ext-link-url">{info.fullUrl}</div>
      </div>
      {info.canTrust ? (
        <Checkbox size="sm" checked={trustChecked} onChange={onTrustChange}>
          {t("externalLink.trustDomainLabel", { hostname: info.hostname })}
        </Checkbox>
      ) : (
        <div className="ext-link-warn-note">{t(getWarningNoteKey(info))}</div>
      )}
    </div>
  );
}
