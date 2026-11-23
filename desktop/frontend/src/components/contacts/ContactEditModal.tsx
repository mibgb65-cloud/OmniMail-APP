import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { Checkbox } from "../common/Checkbox";
import { CustomSelect } from "../common/CustomSelect";
import { ModalShell } from "../common/ModalShell";

const GROUP_OPTIONS = [
  { value: "核心项目组", label: "核心项目组" },
  { value: "设计评审", label: "设计评审" },
  { value: "财务与法务", label: "财务与法务" },
  { value: "外部供应商", label: "外部供应商" },
];

export function ContactEditModal({ contactId }: { contactId?: string }) {
  const { workspace, toastStore } = useApp();
  const existing = workspace.contacts.find((c) => c.id === contactId);

  const [name, setName] = useState(existing?.name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [company, setCompany] = useState(existing?.company ?? "");
  const [roleTitle, setRoleTitle] = useState(existing?.title ?? "");
  const [group, setGroup] = useState(existing?.groups[0] ?? "核心项目组");
  const [vip, setVip] = useState(existing?.vip ?? false);
  const [note, setNote] = useState(existing?.note ?? "");

  const handleSave = () => {
    if (!name.trim() || !email.includes("@")) return;
    workspace.upsertContact({
      id: existing?.id ?? `ct-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      avatarText: name.trim().slice(0, 1),
      avatarTone: existing?.avatarTone ?? "blue",
      company: company.trim() || "未填写公司",
      title: roleTitle.trim() || "联系人",
      sourceAccountId:
        existing?.sourceAccountId ?? workspace.accounts[0]?.id ?? "acc-gmail",
      sourceTag:
        existing?.sourceTag ??
        workspace.accounts[0]?.shortTag ??
        "工作 · Gmail",
      groups: [group],
      vip,
      blocked: false,
      mailCount: existing?.mailCount ?? 1,
      lastContactText: existing?.lastContactText ?? "刚刚",
      note: note.trim() || undefined,
    });
    workspace.setOverlay({ type: "none" });
    toastStore.pushToast({
      tone: "success",
      title: existing ? `已更新联系人：${name}` : `已新建联系人：${name}`,
    });
  };

  return (
    <ModalShell
      heading={existing ? "编辑联系人" : "新建联系人"}
      subtitle="联系人信息默认保存在本地工作空间，支持在写信收件人自动补全"
      maxWidth={500}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">支持按邮箱来源与分组检索</span>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!name.trim() || !email.includes("@")}
              onClick={handleSave}
            >
              保存联系人
            </button>
          </div>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">姓名 *</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如 林知夏"
          />
        </div>
        <div>
          <label className="text-xs text-muted">邮箱地址 *</label>
          <input
            type="email"
            className="input"
            style={{ marginTop: 4 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@studio.example"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">公司 / 组织</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted">职位 / 角色</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          alignItems: "end",
        }}
      >
        <div>
          <label className="text-xs text-muted">所属分组</label>
          <CustomSelect
            fullWidth
            style={{ marginTop: 4 }}
            value={group}
            options={GROUP_OPTIONS}
            ariaLabel="所属分组"
            onChange={setGroup}
          />
        </div>
        <Checkbox
          checked={vip}
          onChange={setVip}
          style={{ height: 36 }}
          ariaLabel="标记为 VIP 重要发件人"
        >
          标记为 VIP 重要发件人
        </Checkbox>
      </div>

      <div>
        <label className="text-xs text-muted">备注</label>
        <textarea
          className="textarea"
          rows={3}
          style={{ marginTop: 4 }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="记录协作分工、偏好发件时间等…"
        />
      </div>
    </ModalShell>
  );
}
