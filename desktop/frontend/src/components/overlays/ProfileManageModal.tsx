import { useState } from "react";
import { parseBackendError, profileApi } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { PasswordInput } from "../common/PasswordInput";
import {
  ProfileCreateForm,
  type CreateProfileFormValues,
} from "./ProfileCreateForm";
import { ProfileSwitchList } from "./ProfileSwitchList";

export function ProfileManageModal({
  initialMode = "switch",
  targetProfileId,
}: {
  initialMode?: "switch" | "create" | "unlock";
  targetProfileId?: string;
}) {
  const { workspace, desktopBridge, toastStore } = useApp();
  const [mode, setMode] = useState<"switch" | "create" | "unlock">(initialMode);
  const [unlockTargetId, setUnlockTargetId] = useState(
    targetProfileId || workspace.activeProfileId,
  );
  const [pinInput, setPinInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [askOnLaunch, setAskOnLaunch] = useState(
    workspace.launchBehavior === "ask-on-launch",
  );
  const [form, setForm] = useState<CreateProfileFormValues>({
    name: "",
    badge: "",
    color: "#2563EB",
    pin: "",
    customDir: "",
  });

  const mustUnlock = Boolean(
    workspace.activeProfile?.locked && mode === "unlock",
  );
  const closeModal = () => {
    if (!mustUnlock) workspace.setOverlay({ type: "none" });
  };

  const doSwitch = async (id: string, pin = "") => {
    setBusy(true);
    setErrorMsg("");
    try {
      const res = await profileApi.switchProfile(id, pin);
      setPinInput("");
      await workspace.refreshProfilesAndAccounts();
      workspace.setOverlay({ type: "none" });
      toastStore.pushToast({
        tone: "success",
        title: `已切换至「${res.profile.name}」`,
      });
    } catch (err) {
      const parsed = parseBackendError(err);
      if (parsed.code === "ERR_PIN_REQUIRED") {
        setUnlockTargetId(id);
        setMode("unlock");
      } else setErrorMsg(parsed.message);
    } finally {
      setBusy(false);
    }
  };

  const doCreate = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    setErrorMsg("");
    try {
      const created = await profileApi.createProfile({
        name: form.name.trim(),
        badge: (form.badge.trim() || form.name.trim()).slice(0, 1),
        color: form.color,
        customDir: form.customDir.trim() || undefined,
        themePreference: workspace.settings.themePreference,
        pin: form.pin.trim() || undefined,
      });
      await profileApi.switchProfile(created.id, form.pin.trim());
      await workspace.refreshProfilesAndAccounts();
      workspace.setOverlay({ type: "none" });
      toastStore.pushToast({
        tone: "success",
        title: `已创建空间「${created.name}」`,
      });
    } catch (err) {
      setErrorMsg(parseBackendError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const onPrimary = () => {
    if (mode === "create") void doCreate();
    else if (mode === "unlock") void doSwitch(unlockTargetId, pinInput);
    else setMode("create");
  };
  const primaryDisabled =
    busy ||
    (mode === "create" && !form.name.trim()) ||
    (mode === "unlock" && pinInput.trim().length < 4);

  return (
    <ModalShell
      heading={
        mode === "unlock"
          ? "输入 PIN 解锁工作空间"
          : mode === "create"
            ? "新建本地隔离工作空间"
            : "本地多工作空间管理"
      }
      subtitle="每个空间拥有物理隔离的 SQLite 数据库、缓存与 DPAPI 凭据盒"
      maxWidth={540}
      onClose={closeModal}
      footer={
        <>
          {!mustUnlock && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                mode === "switch" ? closeModal() : setMode("switch")
              }
            >
              {mode === "switch" ? "关闭" : "返回空间列表"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={primaryDisabled}
            onClick={onPrimary}
          >
            {mode === "switch" && <Icon name="plus" size={14} />}
            {mode === "create"
              ? "创建并切换"
              : mode === "unlock"
                ? "解锁进入"
                : "新建本地空间"}
          </button>
        </>
      }
    >
      {errorMsg && (
        <div className="pill pill-danger" style={{ alignSelf: "flex-start" }}>
          {errorMsg}
        </div>
      )}
      {mode === "unlock" && (
        <div className="settings-card" style={{ gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            目标空间：
            {workspace.profiles.find((p) => p.id === unlockTargetId)?.name ??
              unlockTargetId}
          </div>
          <PasswordInput
            value={pinInput}
            onChange={setPinInput}
            placeholder="请输入 4~32 位空间 PIN 码"
            ariaLabel="空间解锁 PIN 码"
          />
        </div>
      )}
      {mode === "create" && (
        <ProfileCreateForm
          val={form}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onPickDir={() =>
            void desktopBridge
              .pickDirectory()
              .then((d) => d && setForm((f) => ({ ...f, customDir: d })))
          }
        />
      )}
      {mode === "switch" && (
        <ProfileSwitchList
          busy={busy}
          askOnLaunch={askOnLaunch}
          onToggleAskOnLaunch={setAskOnLaunch}
          onSelectSwitch={(p) => void doSwitch(p.id)}
          onSelectUnlock={(p) => {
            setUnlockTargetId(p.id);
            setMode("unlock");
          }}
        />
      )}
    </ModalShell>
  );
}
