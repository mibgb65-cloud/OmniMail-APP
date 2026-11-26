import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n";
import { accountApi, parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import type { EmailAccount } from "../../types/account";
import {
  ACCOUNT_NAME_MAX_LEN,
  buildAccountNameSuggestions,
  resolveConciseProviderLabel,
  resolveSidebarAccountTitle,
} from "../../utils/accountDisplay";

export function AccountRenamePopover({
  account,
  anchorRect,
  onClose,
}: {
  account: EmailAccount;
  anchorRect: DOMRect;
  onClose: () => void;
}) {
  const { workspace, toastStore } = useApp();
  const { lang, t } = useI18n();
  const popRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const defaultConcise = resolveConciseProviderLabel(
    account.provider,
    account.email,
    lang,
  );
  const [draft, setDraft] = useState(() =>
    resolveSidebarAccountTitle(account, lang).slice(0, ACCOUNT_NAME_MAX_LEN),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node | null)) return;
      onClose();
    };
    const onKeyCapture = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onClose);
    window.addEventListener("keydown", onKeyCapture, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("keydown", onKeyCapture, true);
    };
  }, [onClose]);

  const handleSave = async () => {
    if (saving) return;
    const finalName =
      draft.trim().slice(0, ACCOUNT_NAME_MAX_LEN) || defaultConcise;
    setSaving(true);
    try {
      const updated = await accountApi.updateAccount({
        id: account.id,
        name: finalName,
        shortTag: finalName.slice(0, 10),
      });
      workspace.updateAccount(account.id, updated);
      toastStore.pushToast({
        tone: "success",
        title: t("toasts.renamedAccountDone", { name: finalName }),
      });
      onClose();
    } catch (err) {
      setSaving(false);
      toastStore.pushToast({
        tone: "danger",
        title: parseBackendError(err).message,
      });
    }
  };

  const suggestions = buildAccountNameSuggestions(
    account.provider,
    account.email,
    lang,
  );
  const popWidth = 306;
  const estHeight = 178;
  const placeRight = anchorRect.right + popWidth + 16 <= window.innerWidth;
  const left = placeRight
    ? anchorRect.right + 8
    : Math.max(
        12,
        Math.min(anchorRect.left, window.innerWidth - popWidth - 12),
      );
  const top = Math.max(
    12,
    Math.min(anchorRect.top - 6, window.innerHeight - estHeight - 12),
  );

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      aria-label={t("sidebar.renamePopoverTitle")}
      className="account-rename-popover"
      style={{ left, top, width: popWidth }}
    >
      <div className="arp-header">
        <strong className="arp-title">{t("sidebar.renamePopoverTitle")}</strong>
        <span className="arp-email truncate">{account.email}</span>
      </div>

      <div className="pcm-name-input-wrap">
        <input
          ref={inputRef}
          className="input pcm-name-input"
          maxLength={ACCOUNT_NAME_MAX_LEN}
          value={draft}
          onChange={(e) =>
            setDraft(e.target.value.slice(0, ACCOUNT_NAME_MAX_LEN))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSave();
            }
          }}
          placeholder={defaultConcise}
        />
        <span className="pcm-char-counter">
          {draft.length}/{ACCOUNT_NAME_MAX_LEN}
        </span>
      </div>

      <div className="pcm-quick-chips">
        {suggestions.map((chip) => (
          <button
            key={chip}
            type="button"
            className={`pcm-quick-chip ${draft.trim() === chip ? "is-active" : ""}`}
            onClick={() => {
              setDraft(chip);
              inputRef.current?.focus();
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="arp-footer">
        <button
          type="button"
          className="arp-reset-btn"
          onClick={() => {
            setDraft(defaultConcise);
            inputRef.current?.focus();
          }}
        >
          {t("sidebar.renameResetDefault")}
        </button>
        <div className="arp-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
