import { composeApi, parseBackendError } from "../../../services/backendClient";
import { useApp } from "../../../state/AppContext";
import { isWailsDesktop } from "../../../state/storageHelpers";
import type { MailItem } from "../../../types/mail";
import { Icon } from "../../common/Icon";

export function ReaderOutboxBanners({ mail }: { mail: MailItem }) {
  const { workspace, mailStore, composeStore, toastStore } = useApp();

  return (
    <>
      {mail.folder === "drafts" && (
        <div className="security-banner warning" role="status">
          <div className="row" style={{ gap: 8 }}>
            <Icon name="edit" size={16} />
            <span>这是一封未发出的本地草稿，可随时恢复编辑或发送。</span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => composeStore.openSavedDraft(mail.id)}
          >
            继续编辑草稿
          </button>
        </div>
      )}

      {mail.folder === "scheduled" && (
        <div className="security-banner warning" role="status">
          <div className="row" style={{ gap: 8 }}>
            <Icon name="clock" size={16} />
            <span>
              该邮件已加入定时队列
              {mail.scheduledAt ? `（计划于 ${mail.scheduledAt} 发出）` : ""}
            </span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                void composeApi
                  .retryOutboxJob(mail.id)
                  .then(() => {
                    void mailStore.reloadMessages();
                    toastStore.pushToast({
                      tone: "info",
                      title: "已跳过定时等待立即投递",
                    });
                  })
                  .catch((err) =>
                    toastStore.pushToast({
                      tone: "danger",
                      title: "立即发送失败",
                      detail: parseBackendError(err).message,
                    }),
                  );
              }}
            >
              立即发出
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => {
                void composeApi
                  .cancelOutboxJob(mail.id)
                  .then(() => {
                    void mailStore.reloadMessages();
                    toastStore.pushToast({
                      tone: "info",
                      title: "已取消定时任务并还原回草稿箱",
                    });
                  })
                  .catch((err) =>
                    toastStore.pushToast({
                      tone: "danger",
                      title: "取消定时失败",
                      detail: parseBackendError(err).message,
                    }),
                  );
              }}
            >
              取消定时
            </button>
          </div>
        </div>
      )}

      {mail.outboxError && (
        <div className="security-banner danger" role="alert">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="alertCircle" size={16} />
            <span>
              <strong>发送失败：</strong>
              {mail.outboxError}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => {
                if (!isWailsDesktop()) {
                  mailStore.moveMails([mail.id], "sent", {
                    outboxError: undefined,
                    statusBadge: undefined,
                  });
                  return;
                }
                void composeApi
                  .retryOutboxJob(mail.id)
                  .then(() => {
                    void mailStore.reloadMessages();
                    toastStore.pushToast({
                      tone: "info",
                      title: "已重新加入发送队列重试",
                    });
                  })
                  .catch((err) =>
                    toastStore.pushToast({
                      tone: "danger",
                      title: "重试发送失败",
                      detail: parseBackendError(err).message,
                    }),
                  );
              }}
            >
              立即重试发送
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() =>
                workspace.setOverlay({
                  type: "diagnostics",
                  accountId: mail.accountId,
                })
              }
            >
              连接诊断
            </button>
          </div>
        </div>
      )}
    </>
  );
}
