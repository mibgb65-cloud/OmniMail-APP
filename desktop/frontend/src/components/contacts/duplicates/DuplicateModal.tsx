import { useState } from "react";
import type { ContactMergeGroup } from "../../../../bindings/omnimail/internal/contacts/models";
import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import { Icon } from "../../common/Icon";
import { ModalShell } from "../../common/ModalShell";
import { FadeScroll } from "../../common/scroll-fade/FadeScroll";
import { useDuplicateCenter } from "./DuplicateCenter";
import { DuplicateGroupCard } from "./DuplicateGroupCard";
import {
  createMergePlan,
  groupSelection,
  type GroupSelection,
} from "./duplicateSelection";

export function DuplicateModal({ mode }: { mode: "review" | "confirm-all" }) {
  const { workspace } = useApp();
  const { t } = useI18n();
  const center = useDuplicateCenter();
  const [choices, setChoices] = useState<Record<string, GroupSelection>>({});
  const [confirmation, setConfirmation] = useState<ContactMergeGroup[] | null>(
    null,
  );
  const rows = center.groups.map((group) => ({
    group,
    selection: groupSelection(group, choices[group.key]),
  }));
  const [allPlans] = useState(() =>
    mode === "confirm-all"
      ? center.groups.flatMap((group) => createMergePlan(group) ?? [])
      : [],
  );
  const selected = rows.flatMap(({ group, selection }) =>
    selection.selected ? (createMergePlan(group, selection) ?? []) : [],
  );
  const close = () => {
    if (!center.busy) workspace.setOverlay({ type: "none" });
  };
  const toReview = () =>
    workspace.setOverlay({ type: "contact-duplicates", mode: "review" });
  const plans = mode === "confirm-all" ? allPlans : confirmation;
  const cancelConfirmation = () => {
    if (center.busy) return;
    if (mode === "confirm-all") close();
    else setConfirmation(null);
  };
  const counts = (items: ContactMergeGroup[]) => ({
    groups: items.length,
    removed: items.reduce((sum, p) => sum + (p.duplicateIds?.length ?? 0), 0),
  });
  const { groups, removed } = counts(selected);
  const pending = counts(plans ?? []);

  if (plans)
    return (
      <ModalShell
        heading={
          mode === "confirm-all"
            ? t("contacts.dupConfirmAllHeading")
            : t("contacts.dupConfirmSelectedHeading")
        }
        maxWidth={470}
        onClose={cancelConfirmation}
        footer={
          <div className="contact-dup-footer-actions">
            {mode === "confirm-all" && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={center.busy}
                onClick={toReview}
              >
                {t("contacts.dupReviewFirstBtn")}
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              disabled={center.busy}
              onClick={cancelConfirmation}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={center.busy || !pending.groups}
              onClick={() =>
                void center.merge(plans).then((ok) => {
                  if (!ok) return;
                  if (mode === "confirm-all")
                    workspace.setOverlay({ type: "none" });
                  else setConfirmation(null);
                })
              }
            >
              {center.busy
                ? t("contacts.dupMergingBtn")
                : t("contacts.dupConfirmMergeBtn")}
            </button>
          </div>
        }
      >
        <p>{t("contacts.dupConfirmSummary", pending)}</p>
        <p className="text-sm text-muted">
          {mode === "confirm-all"
            ? t("contacts.dupConfirmAllHint")
            : t("contacts.dupConfirmSelectedHint")}
        </p>
      </ModalShell>
    );

  return (
    <ModalShell
      heading={t("contacts.dupModalHeading")}
      subtitle={t("contacts.dupModalSubtitle")}
      badge={
        rows.length > 0 && (
          <span className="pill contacts-dup-count">
            {t("contacts.dupPendingBadge", { count: rows.length })}
          </span>
        )
      }
      maxWidth={710}
      noPadding
      onClose={close}
      footer={
        <div className="contact-dup-review-footer">
          <span className="text-xs text-muted">
            {t("contacts.dupFooterSummary", { groups, removed })}
          </span>
          <div className="contact-dup-footer-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={center.busy}
              onClick={close}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={center.busy || !groups}
              onClick={() => setConfirmation(selected)}
            >
              <Icon name="check" size={15} />
              {t("contacts.dupMergeSelectedBtn", { count: groups })}
            </button>
          </div>
        </div>
      }
    >
      <FadeScroll
        className="contact-dup-review-scroll"
        label={t("contacts.dupScrollLabel")}
      >
        {center.error ? (
          <div className="contact-dup-empty">
            <p>{center.error}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={center.refresh}
            >
              {t("contacts.dupRedetectBtn")}
            </button>
          </div>
        ) : !rows.length ? (
          <p className="contact-dup-empty" role="status">
            {center.loading
              ? t("contacts.dupDetectingStatus")
              : t("contacts.dupNoneStatus")}
          </p>
        ) : (
          rows.map(({ group, selection }) => (
            <DuplicateGroupCard
              key={group.key}
              group={group}
              selection={selection}
              busy={center.busy}
              onChange={(next) =>
                setChoices((prev) => ({ ...prev, [group.key]: next }))
              }
              onIgnore={() => void center.ignore(group.key)}
              onMerge={() => {
                const plan = createMergePlan(group, selection);
                if (plan) setConfirmation([plan]);
              }}
            />
          ))
        )}
      </FadeScroll>
    </ModalShell>
  );
}
