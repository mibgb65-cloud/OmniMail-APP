import { useState } from "react";
import type { ContactMergeGroup } from "../../../../bindings/omnimail/internal/contacts/models";
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
    removed: items.reduce(
      (sum, plan) => sum + (plan.duplicateIds?.length ?? 0),
      0,
    ),
  });
  const { groups, removed } = counts(selected);
  const pending = counts(plans ?? []);

  if (plans)
    return (
      <ModalShell
        heading={
          mode === "confirm-all" ? "确认合并全部重复联系人" : "确认合并联系人"
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
                先审阅
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              disabled={center.busy}
              onClick={cancelConfirmation}
            >
              取消
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
              {center.busy ? "正在合并…" : "确认合并"}
            </button>
          </div>
        }
      >
        <p>
          将合并 {pending.groups} 组，精简 {pending.removed} 条联系人记录。
        </p>
        <p className="text-sm text-muted">
          {mode === "confirm-all"
            ? "每组默认保留往来邮件最多的联系人为主联系人。"
            : "保留所选主联系人，未选地址不受影响。"}
          其余地址归为备用邮箱，邮件不会被删除。
        </p>
      </ModalShell>
    );

  return (
    <ModalShell
      heading="整理重复联系人"
      subtitle="保留主联系人名称、VIP 和往来记录，选中的其他地址归入备用邮箱。"
      badge={
        rows.length > 0 && (
          <span className="pill contacts-dup-count">
            {rows.length} 组待处理
          </span>
        )
      }
      maxWidth={710}
      noPadding
      onClose={close}
      footer={
        <div className="contact-dup-review-footer">
          <span className="text-xs text-muted">
            已选 {groups} 组 · 合并后将精简 {removed} 条冗余联系人记录
          </span>
          <div className="contact-dup-footer-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={center.busy}
              onClick={close}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={center.busy || !groups}
              onClick={() => setConfirmation(selected)}
            >
              <Icon name="check" size={15} />
              合并已选 ({groups} 组)
            </button>
          </div>
        </div>
      }
    >
      <FadeScroll
        className="contact-dup-review-scroll"
        label="重复联系人审阅列表"
      >
        {center.error ? (
          <div className="contact-dup-empty">
            <p>{center.error}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={center.refresh}
            >
              重新检测
            </button>
          </div>
        ) : !rows.length ? (
          <p className="contact-dup-empty" role="status">
            {center.loading
              ? "正在检测重复联系人…"
              : "当前没有待整理的重复联系人"}
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
