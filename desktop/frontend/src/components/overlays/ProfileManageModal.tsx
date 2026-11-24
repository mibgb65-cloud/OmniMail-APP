import { useState } from "react";
import { useI18n } from "../../i18n";
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
  const { t, localizeText } = useI18n();
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
  const closeModal = () =>
    !mustUnlock && workspace.setOverlay({ type: "none" });
  const finishWithToast = async (
    name: string,
    key: "toasts.switchedToProfile" | "toasts.createdProfile",
  ) => {
    await workspace.refreshProfilesAndAccounts();
    workspace.setOverlay({ type: "none" });
    toastStore.pushToast({
      tone: "success",
      title: t(key, { name: localizeText(name) }),
    });
  };

  const doSwitch = async (id: string, pin = "") => {
    setBusy(true);
    setErrorMsg("");
    try {
      const res = await profileApi.switchProfile(id, pin);
      setPinInput("");
      await finishWithToast(res.profile.name, "toasts.switchedToProfile");
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
      await finishWithToast(created.name, "toasts.createdProfile");
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
  const heading =
    mode === "unlock"
      ? t("overlays.profUnlockHeading")
      : mode === "create"
        ? t("overlays.profCreateHeading")
        : t("overlays.profManageHeading");
  const primaryText =
    mode === "create"
      ? t("overlays.profCreateAndSwitchBtn")
      : mode === "unlock"
        ? t("overlays.profUnlockEnterBtn")
        : t("overlays.profNewWorkspaceBtn");
  const rawTargetName =
    workspace.profiles.find((p) => p.id === unlockTargetId)?.name ??
    unlockTargetId;
  return (
    <ModalShell
      heading={heading}
      subtitle={t("overlays.profSubtitle")}
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
              {mode === "switch"
                ? t("common.close")
                : t("overlays.profBackToListBtn")}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={primaryDisabled}
            onClick={onPrimary}
          >
            {mode === "switch" && <Icon name="plus" size={14} />}
            {primaryText}
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
            {t("overlays.profTargetLabel", {
              name: localizeText(rawTargetName),
            })}
          </div>
          <PasswordInput
            value={pinInput}
            onChange={setPinInput}
            placeholder={t("overlays.profPinPlaceholder")}
            ariaLabel={t("overlays.profPinAria")}
          />
        </div>
      )}
      {mode === "create" && (
        <ProfileCreateForm
          val={form}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onPickDir={() =>
            void desktopBridge.pickDirectory().then((d) => {
              if (d) setForm((f) => ({ ...f, customDir: d }));
            })
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
