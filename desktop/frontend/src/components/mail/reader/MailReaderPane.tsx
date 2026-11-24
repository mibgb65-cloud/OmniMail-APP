import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import { mailReaderScrollFlags } from "../../../state/mailListArrivalPolicy";
import type { DarkHtmlMode } from "../../../types/settings";
import {
  ScrollToTopPill,
  scrollViewportToTop,
} from "../../common/ScrollToTopPill";
import { FadeScroll } from "../../common/scroll-fade/FadeScroll";
import { useTranslation } from "../translation/TranslationContext";
import { TranslationBanner } from "../translation/TranslationBanner";
import { MeetingInviteCard } from "./MeetingInviteCard";
import { QuickReplyBox } from "./QuickReplyBox";
import { ReaderAttachmentsSection } from "./ReaderAttachmentsSection";
import { ReaderSecurityBanners } from "./ReaderSecurityBanners";
import { ReaderEmptyOrSkeleton } from "./ReaderSkeleton";
import { ReaderSubjectSection } from "./ReaderSubjectSection";
import { ReaderThreadCard } from "./ReaderThreadCard";
import { ReaderToolbar } from "./ReaderToolbar";

const AT_TOP = { scrolled: false, showReturnTop: false };

export function MailReaderPane() {
  const { t: tr } = useI18n();
  const { workspace, mailStore } = useApp();
  const t = useTranslation();
  const { filteredMails, selectedMail, labels } = mailStore;
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [htmlModeOverride, setHtmlModeOverride] = useState<{
    mailId: string;
    mode: DarkHtmlMode;
  }>();
  const [scrollState, setScrollState] = useState<{
    scope: string;
    scrolled: boolean;
    showReturnTop: boolean;
  }>();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selectedMailId = selectedMail?.id;
  const scrollScope = selectedMailId
    ? `${workspace.activeProfileId}:${selectedMailId}`
    : "";
  const { scrolled, showReturnTop } =
    scrollScope && scrollState?.scope === scrollScope ? scrollState : AT_TOP;
  const defaultHtmlMode: DarkHtmlMode =
    workspace.settings.darkHtmlMode ?? "adaptive";
  const htmlThemeMode: DarkHtmlMode =
    selectedMailId && htmlModeOverride?.mailId === selectedMailId
      ? htmlModeOverride.mode
      : defaultHtmlMode;
  const content = t.result?.content;
  const translation = useMemo(
    () =>
      content && t.mode !== "original"
        ? { mode: t.mode, segments: content.segments, target: content.target }
        : undefined,
    [content, t.mode],
  );

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [scrollScope]);

  if (!selectedMail) {
    return (
      <ReaderEmptyOrSkeleton
        accountCount={workspace.accounts.length}
        isInitialLoading={mailStore.isInitialLoading}
      />
    );
  }

  const currentIndex = Math.max(
    0,
    filteredMails.findIndex((m) => m.id === selectedMail.id),
  );
  const navigate = (delta: -1 | 1) => {
    const next = filteredMails[currentIndex + delta];
    if (next) mailStore.openMail(next.id);
  };
  const hasHtmlBody = selectedMail.messages.some((m) => Boolean(m.bodyHtml));
  const showHtmlThemeToggle =
    workspace.settings.theme === "dark" && hasHtmlBody;
  const mailLabels = labels.filter((l) => selectedMail.labels.includes(l.id));
  const translatedSubject = translation ? content?.subject : undefined;

  return (
    <section
      className="panel-card mail-reader-pane"
      aria-label={tr("reader.ariaBodyPane")}
    >
      <ReaderToolbar
        mail={selectedMail}
        currentIndex={currentIndex}
        totalCount={filteredMails.length}
        scrolled={scrolled}
        showHtmlThemeToggle={showHtmlThemeToggle}
        htmlThemeMode={htmlThemeMode}
        onHtmlThemeModeChange={(mode) =>
          setHtmlModeOverride({ mailId: selectedMail.id, mode })
        }
        onNavigate={navigate}
      />
      <TranslationBanner />

      <div className="reader-body">
        <FadeScroll
          className="reader-scroll selectable"
          data-return-pill={showReturnTop}
          label={tr("reader.ariaBodyScroll")}
          viewportProps={{
            ref: scrollRef,
            onScroll: (event) => {
              const el = event.currentTarget;
              const flags =
                el.scrollHeight > el.clientHeight
                  ? mailReaderScrollFlags(el.scrollTop)
                  : AT_TOP;
              setScrollState((prev) =>
                prev?.scope === scrollScope &&
                prev.scrolled === flags.scrolled &&
                prev.showReturnTop === flags.showReturnTop
                  ? prev
                  : { scope: scrollScope, ...flags },
              );
            },
          }}
        >
          <div key={selectedMail.id} className="reader-motion-stage">
            <ReaderSubjectSection
              mail={selectedMail}
              labels={mailLabels}
              translatedSubject={translatedSubject}
              translationMode={t.mode}
              targetLanguage={content?.target}
            />
            <ReaderSecurityBanners mail={selectedMail} />
            {selectedMail.meetingInvite && (
              <MeetingInviteCard
                mailId={selectedMail.id}
                invite={selectedMail.meetingInvite}
              />
            )}
            {selectedMail.messages.map((msg, idx) => {
              const isLatest = idx === selectedMail.messages.length - 1;
              const isExpanded =
                isLatest ||
                !msg.collapsed ||
                Boolean(expandedIds[msg.id]) ||
                Boolean(t.result && msg.id === selectedMail.id);

              return (
                <ReaderThreadCard
                  key={msg.id}
                  mail={selectedMail}
                  msg={msg}
                  theme={workspace.settings.theme}
                  htmlThemeMode={htmlThemeMode}
                  translation={
                    msg.id === selectedMail.id ? translation : undefined
                  }
                  isLatest={isLatest}
                  isExpanded={isExpanded}
                  onExpand={() =>
                    setExpandedIds((prev) => ({ ...prev, [msg.id]: true }))
                  }
                />
              );
            })}
            <ReaderAttachmentsSection
              attachments={selectedMail.attachments}
              mailSubject={selectedMail.subject}
              bodyHtmlList={selectedMail.messages.map((m) => m.bodyHtml)}
            />
          </div>
        </FadeScroll>

        <ScrollToTopPill
          className="reader-return-top"
          visible={showReturnTop}
          label={tr("common.backToTop")}
          onClick={() => scrollViewportToTop(scrollRef.current)}
        />
      </div>

      <QuickReplyBox mail={selectedMail} />
    </section>
  );
}
