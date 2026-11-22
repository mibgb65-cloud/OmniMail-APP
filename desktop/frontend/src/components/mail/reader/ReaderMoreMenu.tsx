import { useEffect, useRef, useState } from "react";
import { useApp } from "../../../state/AppContext";
import type { MailItem } from "../../../types/mail";
import { Icon } from "../../common/Icon";

export function ReaderMoreMenu({ mail }: { mail: MailItem }) {
  const { viewport, workspace, composeStore } = useApp();
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(
    null,
  );
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!menuPos) return;
    const close = () => setMenuPos(null);
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
    };
  }, [menuPos]);

  const foldedActions = [
    ...(viewport === "compact"
      ? [
          {
            label: "转发此封邮件",
            run: () => composeStore.openReplyCompose(mail, "forward", false),
          },
        ]
      : []),
    ...(viewport !== "wide"
      ? [
          {
            label: "稍后处理提醒…",
            run: () =>
              workspace.setOverlay({ type: "snooze", mailIds: [mail.id] }),
          },
          {
            label: "管理邮件标签…",
            run: () =>
              workspace.setOverlay({
                type: "label-manage",
                mailIds: [mail.id],
                mode: "assign",
              }),
          },
        ]
      : []),
  ];

  const baseActions = [
    {
      label: "移动到文件夹…",
      run: () =>
        workspace.setOverlay({ type: "move-folder", mailIds: [mail.id] }),
    },
    {
      label: "查看邮件原始源码与邮件头",
      run: () => workspace.setOverlay({ type: "mail-source", mailId: mail.id }),
    },
    {
      label: "打印与导出邮件 (.pdf / .eml)",
      run: () =>
        workspace.setOverlay({ type: "print-export", mailId: mail.id }),
    },
    {
      label: "附件传输队列与失败恢复",
      run: () =>
        workspace.setOverlay({ type: "attachment-transfer", mode: "transfer" }),
    },
  ];

  const toggleMenu = () => {
    if (menuPos) {
      setMenuPos(null);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - 236));
    const top = Math.min(rect.bottom + 6, window.innerHeight - 280);
    setMenuPos({ left, top });
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="icon-btn icon-btn-bordered reader-icon-btn"
        onClick={(e) => {
          e.stopPropagation();
          toggleMenu();
        }}
        title="更多邮件操作"
        aria-label="更多邮件操作"
      >
        <Icon name="more" size={14} />
      </button>

      {menuPos && (
        <div
          className="context-menu"
          style={{ left: menuPos.left, top: menuPos.top }}
          onClick={(e) => e.stopPropagation()}
        >
          {foldedActions.map((act) => (
            <button
              key={act.label}
              type="button"
              className="context-menu-item"
              onClick={() => {
                setMenuPos(null);
                act.run();
              }}
            >
              <span>{act.label}</span>
            </button>
          ))}
          {foldedActions.length > 0 && <div className="context-menu-divider" />}
          {baseActions.map((act) => (
            <button
              key={act.label}
              type="button"
              className="context-menu-item"
              onClick={() => {
                setMenuPos(null);
                act.run();
              }}
            >
              <span>{act.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
