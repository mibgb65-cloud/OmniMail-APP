import { useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Checkbox } from "../common/Checkbox";
import { CustomSelect } from "../common/CustomSelect";
import { ModalShell } from "../common/ModalShell";
import { FadeTextarea } from "../common/scroll-fade/FadeTextarea";

export function ContactEditModal({ contactId }: { contactId?: string }) {
  const { workspace, toastStore } = useApp();
  const { t } = useI18n();
  const existing = workspace.contacts.find((c) => c.id === contactId);

  const [name, setName] = useState(existing?.name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [company, setCompany] = useState(existing?.company ?? "");
  const [roleTitle, setRoleTitle] = useState(existing?.title ?? "");
  const [group, setGroup] = useState(existing?.groups[0] ?? "核心项目组");
  const [vip, setVip] = useState(existing?.vip ?? false);
  const [note, setNote] = useState(existing?.note ?? "");

  const groupOptions = [
    { value: "核心项目组", label: t("contacts.groupCoreTeam") },
    { value: "设计评审", label: t("contacts.groupDesignReview") },
    { value: "财务与法务", label: t("contacts.groupFinanceLegal") },
    { value: "外部供应商", label: t("contacts.groupExternalVendors") },
  ];

  const handleSave = () => {
    const cleanName = name.trim();
    if (!cleanName || !email.includes("@")) return;
    workspace.upsertContact({
      id: existing?.id ?? `ct-${Date.now()}`,
      name: cleanName,
      email: email.trim(),
      alternateEmails: existing?.alternateEmails,
      avatarText: cleanName.slice(0, 1),
      avatarTone: existing?.avatarTone ?? "blue",
      company: company.trim() || t("contacts.defaultNoCompany"),
      title: roleTitle.trim() || t("contacts.defaultRoleContact"),
      sourceAccountId:
        existing?.sourceAccountId ?? workspace.accounts[0]?.id ?? "acc-gmail",
      sourceTag:
        existing?.sourceTag ??
        workspace.accounts[0]?.shortTag ??
        t("contacts.defaultSourceTag"),
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
      title: existing
        ? t("toasts.updatedContact", { name: cleanName })
        : t("toasts.createdContact", { name: cleanName }),
    });
  };

  return (
    <ModalShell
      heading={
        existing ? t("contacts.editHeading") : t("contacts.createHeading")
      }
      subtitle={t("contacts.editSubtitle")}
      maxWidth={500}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">
            {t("contacts.editFooterHint")}
          </span>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!name.trim() || !email.includes("@")}
              onClick={handleSave}
            >
              {t("contacts.saveContactBtn")}
            </button>
          </div>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">
            {t("contacts.fieldName")}
          </label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("contacts.fieldNamePlaceholder")}
          />
        </div>
        <div>
          <label className="text-xs text-muted">
            {t("contacts.fieldEmail")}
          </label>
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
          <label className="text-xs text-muted">
            {t("contacts.fieldCompany")}
          </label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted">
            {t("contacts.fieldRole")}
          </label>
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
          <label className="text-xs text-muted">
            {t("contacts.fieldGroup")}
          </label>
          <CustomSelect
            fullWidth
            style={{ marginTop: 4 }}
            value={group}
            options={groupOptions}
            ariaLabel={t("contacts.fieldGroup")}
            onChange={setGroup}
          />
        </div>
        <Checkbox
          checked={vip}
          onChange={setVip}
          style={{ height: 36 }}
          ariaLabel={t("contacts.markAsVip")}
        >
          {t("contacts.markAsVip")}
        </Checkbox>
      </div>

      <div>
        <label className="text-xs text-muted">{t("contacts.fieldNote")}</label>
        <FadeTextarea
          aria-label={t("contacts.fieldNoteAria")}
          className="textarea"
          rows={3}
          style={{ marginTop: 4 }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("contacts.fieldNotePlaceholder")}
        />
      </div>
    </ModalShell>
  );
}
