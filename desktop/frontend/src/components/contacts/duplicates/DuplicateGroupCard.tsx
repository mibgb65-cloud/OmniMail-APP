import { useId, useState } from "react";
import type { DuplicateGroupDTO } from "../../../../bindings/omnimail/internal/contacts/models";
import { useI18n } from "../../../i18n";
import { Checkbox } from "../../common/Checkbox";
import { Icon } from "../../common/Icon";
import { FadeScroll } from "../../common/scroll-fade/FadeScroll";
import {
  createMergePlan,
  sortedCandidates,
  visibleDuplicateCandidates,
  type GroupSelection,
} from "./duplicateSelection";

export function DuplicateGroupCard({
  group,
  selection,
  busy,
  onChange,
  onIgnore,
  onMerge,
}: {
  group: DuplicateGroupDTO;
  selection: GroupSelection;
  busy: boolean;
  onChange: (selection: GroupSelection) => void;
  onIgnore: () => void;
  onMerge: () => void;
}) {
  const { t, localizeText } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const members = sortedCandidates(group.candidates);
  const primary =
    members.find((member) => member.id === selection.primaryId) ?? members[0];
  if (!primary) return null;
  const plan = createMergePlan(group, selection);
  const name =
    primary.name && !primary.name.includes("@")
      ? primary.name
      : t("contacts.dupUnnamedContact");
  const extra = members.length - 2;
  const addresses = visibleDuplicateCandidates(members, expanded).map(
    (member) => {
      const isPrimary = member.id === selection.primaryId;
      const excluded = selection.excluded.includes(member.id);
      return (
        <div
          className="contact-dup-address"
          key={member.id}
          data-excluded={excluded}
        >
          {expanded && (
            <Checkbox
              size="sm"
              disabled={busy || isPrimary}
              checked={isPrimary || !excluded}
              ariaLabel={t("contacts.dupMergeEmailAria", {
                email: member.email,
              })}
              onChange={(checked) =>
                onChange({
                  ...selection,
                  excluded: checked
                    ? selection.excluded.filter((id) => id !== member.id)
                    : [...selection.excluded, member.id],
                })
              }
            />
          )}
          <button
            type="button"
            className="contact-dup-primary"
            aria-pressed={isPrimary}
            disabled={busy}
            aria-label={t("contacts.dupSetPrimaryAria", {
              email: member.email,
            })}
            title={
              isPrimary
                ? t("contacts.dupCurrentPrimaryTitle")
                : t("contacts.dupSetPrimaryTitle")
            }
            onClick={() =>
              onChange({
                ...selection,
                primaryId: member.id,
                excluded: selection.excluded.filter((id) => id !== member.id),
              })
            }
          >
            {isPrimary
              ? t("contacts.dupPrimaryTag")
              : excluded
                ? t("contacts.dupKeepTag")
                : t("contacts.dupMergeTag")}
          </button>
          <span className="contact-dup-email truncate" title={member.email}>
            {member.email}
          </span>
          <span className="contact-dup-mail-count">
            {t("contacts.dupMailCountRow", { count: member.mailCount })}
            {member.vip ? " · VIP" : ""}
          </span>
        </div>
      );
    },
  );
  return (
    <article className="contact-dup-group" data-selected={selection.selected}>
      <header className="contact-dup-group-header">
        <Checkbox
          checked={selection.selected}
          disabled={busy}
          size="sm"
          ariaLabel={t("contacts.dupSelectGroupAria", { name })}
          onChange={(selected) => onChange({ ...selection, selected })}
        />
        <span
          className={`avatar avatar-${primary.avatarTone} contact-dup-avatar`}
          aria-hidden="true"
        >
          {primary.avatarText}
        </span>
        <div className="contact-dup-group-label">
          <div className="contact-dup-group-title">
            <strong className="truncate" title={name}>
              {name}
            </strong>
            <span className="pill pill-neutral">
              {t("contacts.dupEmailsCountPill", { count: members.length })}
            </span>
            {group.hasRelay && (
              <span className="pill pill-neutral contact-dup-relay">
                {t("contacts.dupHasRelayPill")}
              </span>
            )}
          </div>
          <div className="truncate text-xs text-muted">
            {t("contacts.dupReasonSummary", {
              reason: localizeText(group.reason),
              count: plan?.duplicateIds.length ?? 0,
            })}
          </div>
        </div>
        <div className="contact-dup-group-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={onIgnore}
          >
            {t("contacts.dupIgnoreBtn")}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy || !plan}
            onClick={onMerge}
          >
            {t("contacts.dupMergeGroupBtn")}
          </button>
        </div>
      </header>
      <div className="contact-dup-addresses" id={listId}>
        {expanded ? (
          <FadeScroll
            className="contact-dup-address-scroll"
            surface="--bg-surface"
            label={t("contacts.dupAddressesScrollLabel", { name })}
          >
            {addresses}
          </FadeScroll>
        ) : (
          addresses
        )}
        {extra > 0 && (
          <button
            type="button"
            className="contact-dup-expand"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((value) => !value)}
          >
            <Icon name={expanded ? "chevronUp" : "chevronDown"} size={14} />
            {expanded
              ? t("contacts.dupCollapseEmails")
              : t("contacts.dupExpandEmails", { count: extra })}
          </button>
        )}
      </div>
    </article>
  );
}
