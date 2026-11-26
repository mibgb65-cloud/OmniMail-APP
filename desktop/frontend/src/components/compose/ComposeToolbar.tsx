import { useRef } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { ComposeLinkPopover } from "./ComposeLinkPopover";
import {
  BASIC_FORMAT_BUTTONS,
  BLOCK_FORMAT_BUTTONS,
  FormatGlyph,
  type FormatBtnDef,
} from "./ComposeToolbarIcons";
import type {
  ComposeActiveFormats,
  ComposeFormatCommand,
} from "./composeEditorCommands";
import { useComposePickers } from "./useComposePickers";

interface ComposeToolbarProps {
  activeFormats: ComposeActiveFormats;
  linkPopoverOpen: boolean;
  linkInitialText: string;
  aiBusy?: boolean;
  onFormat: (cmd: ComposeFormatCommand) => void;
  onOpenLinkPopover: () => void;
  onCloseLinkPopover: () => void;
  onConfirmLink: (url: string, displayText: string) => void;
  onInsertInlineImage: (
    url: string,
    contentId: string,
    filename: string,
  ) => void;
  onSaveSelection: () => void;
}

export function ComposeToolbar(props: ComposeToolbarProps) {
  const { workspace, composeStore } = useApp();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { handlePickAttachments, handlePickImages, handleBrowserImageFiles } =
    useComposePickers(
      fileInputRef,
      props.onSaveSelection,
      props.onInsertInlineImage,
    );
  const draft = composeStore.draft;
  if (!draft) return null;

  const renderGroup = (items: FormatBtnDef[]) =>
    items.map((btn) => {
      const isActive = btn.activeKey
        ? props.activeFormats[btn.activeKey]
        : false;
      const label = t(btn.labelKey);
      return (
        <Tooltip key={btn.cmd} label={label} shortcut={btn.shortcut}>
          <button
            type="button"
            disabled={props.aiBusy}
            className={`compose-fmt-btn${isActive ? " active" : ""}`}
            aria-label={label}
            aria-pressed={btn.activeKey ? isActive : undefined}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => props.onFormat(btn.cmd)}
          >
            <FormatGlyph name={btn.glyph} />
          </button>
        </Tooltip>
      );
    });

  return (
    <div className="compose-toolbar">
      <div className="compose-toolbar-left">
        <div className="compose-toolbar-group">
          {renderGroup(BASIC_FORMAT_BUTTONS)}
        </div>
        <span className="compose-toolbar-divider" aria-hidden="true" />
        <div className="compose-toolbar-group">
          {renderGroup(BLOCK_FORMAT_BUTTONS)}
        </div>
        <span className="compose-toolbar-divider" aria-hidden="true" />
        <div className="compose-toolbar-group compose-link-anchor">
          <Tooltip label={t("compose.fmtLink")} shortcut="Ctrl+K">
            <button
              type="button"
              disabled={props.aiBusy}
              className={`compose-fmt-btn${props.linkPopoverOpen ? " active" : ""}`}
              aria-label={t("compose.fmtLink")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={props.onOpenLinkPopover}
            >
              <FormatGlyph name="link" />
            </button>
          </Tooltip>
          {props.linkPopoverOpen && !props.aiBusy && (
            <ComposeLinkPopover
              initialText={props.linkInitialText}
              onConfirm={props.onConfirmLink}
              onClose={props.onCloseLinkPopover}
            />
          )}
          <Tooltip label={t("compose.fmtImage")}>
            <button
              type="button"
              disabled={props.aiBusy}
              className="compose-fmt-btn"
              aria-label={t("compose.fmtImage")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handlePickImages}
            >
              <Icon name="image" size={14} />
            </button>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              handleBrowserImageFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Tooltip label={t("compose.addAttachment")}>
            <button
              type="button"
              className="compose-fmt-btn"
              aria-label={t("compose.addAttachment")}
              onClick={handlePickAttachments}
            >
              <Icon name="paperclip" size={14} />
            </button>
          </Tooltip>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ height: 26, padding: "0 8px", fontSize: 12 }}
            onClick={() =>
              workspace.setOverlay({
                type: "attachment-transfer",
                mode: "transfer",
              })
            }
          >
            {t("compose.transferQueue")}
          </button>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-ai btn-sm"
        style={{ flexShrink: 0 }}
        onClick={() =>
          composeStore.updateDraft({ inlineAiOpen: !draft.inlineAiOpen })
        }
      >
        <Icon name="sparkle" size={13} />
        {t(draft.inlineAiOpen ? "compose.hideInlineAi" : "compose.inlineAiCta")}
      </button>
    </div>
  );
}
