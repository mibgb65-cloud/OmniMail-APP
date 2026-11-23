import { useId, useState } from "react";
import type { DuplicateGroupDTO } from "../../../../bindings/omnimail/internal/contacts/models";
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
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const members = sortedCandidates(group.candidates);
  const primary =
    members.find((member) => member.id === selection.primaryId) ?? members[0];
  if (!primary) return null;
  const plan = createMergePlan(group, selection);
  const name =
    primary.name && !primary.name.includes("@") ? primary.name : "未命名联系人";
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
            <input
              type="checkbox"
              disabled={busy || isPrimary}
              checked={isPrimary || !excluded}
              aria-label={`合并邮箱 ${member.email}`}
              onChange={(e) =>
                onChange({
                  ...selection,
                  excluded: e.target.checked
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
            aria-label={`将 ${member.email} 设为主邮箱`}
            title={isPrimary ? "当前主邮箱" : "设为主邮箱"}
            onClick={() =>
              onChange({
                ...selection,
                primaryId: member.id,
                excluded: selection.excluded.filter((id) => id !== member.id),
              })
            }
          >
            {isPrimary ? "主邮箱" : excluded ? "保留" : "并入"}
          </button>
          <span className="contact-dup-email truncate" title={member.email}>
            {member.email}
          </span>
          <span className="contact-dup-mail-count">
            {member.mailCount} 封往来{member.vip ? " · VIP" : ""}
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
          size="sm"
          ariaLabel={`选择 ${name} 重复组`}
          onChange={(selected) => {
            if (!busy) onChange({ ...selection, selected });
          }}
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
              {members.length} 个重复邮箱
            </span>
            {group.hasRelay && (
              <span className="pill pill-neutral contact-dup-relay">
                含 noreply / 隐藏邮箱
              </span>
            )}
          </div>
          <div className="truncate text-xs text-muted">
            {group.reason} · 将精简 {plan?.duplicateIds.length ?? 0}{" "}
            条联系人记录
          </div>
        </div>
        <div className="contact-dup-group-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={onIgnore}
          >
            忽略
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy || !plan}
            onClick={onMerge}
          >
            合并此组
          </button>
        </div>
      </header>
      <div className="contact-dup-addresses" id={listId}>
        {expanded ? (
          <FadeScroll
            className="contact-dup-address-scroll"
            surface="--bg-surface"
            label={`${name}的重复邮箱`}
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
            {expanded ? "收起重复邮箱" : `展开查看其余 ${extra} 个重复邮箱`}
          </button>
        )}
      </div>
    </article>
  );
}
