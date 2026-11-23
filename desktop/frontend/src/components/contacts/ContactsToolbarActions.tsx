import { useEffect, useState } from "react";
import {
  contactApi,
  parseBackendError,
  type DuplicateGroupDTO,
} from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import { Icon } from "../common/Icon";

export function ContactsToolbarActions() {
  const { workspace, toastStore } = useApp();
  const [dupGroups, setDupGroups] = useState<DuplicateGroupDTO[]>([]);

  useEffect(() => {
    if (!isWailsDesktop()) return;
    let active = true;
    void contactApi
      .findDuplicates()
      .then((groups) => {
        if (active) setDupGroups(groups);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [workspace.contacts.length]);

  const handleImportVCard = () => {
    void contactApi
      .importVCard()
      .then(async (res) => {
        if (!res.filePath && res.imported === 0 && res.updated === 0) return;
        const fresh = await contactApi.listContacts();
        workspace.setContacts(fresh);
        toastStore.pushToast({
          tone: "success",
          title: `vCard 导入完成：新增 ${res.imported} 人，补全 ${res.updated} 人`,
        });
      })
      .catch((err) =>
        toastStore.pushToast({
          tone: "danger",
          title: "导入 vCard 失败",
          detail: parseBackendError(err).message,
        }),
      );
  };

  const handleExportVCard = () => {
    void contactApi
      .exportVCard([])
      .then((savedPath) => {
        if (savedPath) {
          toastStore.pushToast({
            tone: "success",
            title: "已导出 vCard 通讯录文件",
            detail: savedPath,
          });
        }
      })
      .catch((err) =>
        toastStore.pushToast({
          tone: "danger",
          title: "导出 vCard 失败",
          detail: parseBackendError(err).message,
        }),
      );
  };

  const firstDup = dupGroups[0];

  return (
    <>
      <div className="row" style={{ gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ height: 32 }}
          onClick={handleImportVCard}
        >
          导入 vCard
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ height: 32 }}
          onClick={handleExportVCard}
        >
          <Icon name="download" size={13} /> 导出
        </button>
      </div>

      {firstDup && (firstDup.candidates?.length ?? 0) >= 2 && (
        <div
          className="security-banner warning"
          style={{ marginTop: 6, padding: "6px 12px" }}
        >
          <span className="text-xs">
            检测到重复联系人（{firstDup.reason}）：
            <strong>
              {(firstDup.candidates ?? []).map((c) => c.email).join(" / ")}
            </strong>
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              const [primary, ...rest] = firstDup.candidates ?? [];
              if (!primary) return;
              void contactApi
                .mergeContacts(
                  primary.id,
                  rest.map((r) => r.id),
                )
                .then(async () => {
                  const fresh = await contactApi.listContacts();
                  workspace.setContacts(fresh);
                  setDupGroups((prev) => prev.slice(1));
                  toastStore.pushToast({
                    tone: "success",
                    title: `已合并重复联系人至 ${primary.name}`,
                  });
                });
            }}
          >
            一键合并
          </button>
        </div>
      )}
    </>
  );
}
