import type { MouseEvent } from "react";
import { Icon } from "../../common/Icon";
import {
  translatedSegment,
  type BodyTranslation,
} from "../translation/translatedText";
import { linkifyPlainText } from "./linkifyPlainText";

function PlainTextWithLinks({
  text,
  onExternalLink,
  onMailto,
}: {
  text: string;
  onExternalLink: (payload: { url: string; displayText: string }) => void;
  onMailto: (mailtoUrl: string) => void;
}) {
  const segments = linkifyPlainText(text);
  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.type === "url") {
          return (
            <a
              key={idx}
              href={seg.href}
              className="reader-plain-link"
              onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                e.preventDefault();
                e.stopPropagation();
                onExternalLink({ url: seg.href, displayText: seg.text });
              }}
            >
              <span>{seg.text}</span>
              <Icon
                name="external"
                size={11}
                className="reader-plain-link-icon"
              />
            </a>
          );
        }
        if (seg.type === "email") {
          return (
            <a
              key={idx}
              href={seg.href}
              className="reader-plain-link reader-plain-mailto"
              onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                e.preventDefault();
                e.stopPropagation();
                onMailto(seg.href);
              }}
            >
              {seg.text}
            </a>
          );
        }
        return <span key={idx}>{seg.text}</span>;
      })}
    </>
  );
}

export function PlainTextBody({
  paragraphs,
  localizeText,
  translation,
  onExternalLink,
  onMailto,
}: {
  paragraphs: string[];
  localizeText: (text: string) => string;
  translation?: BodyTranslation;
  onExternalLink: (payload: { url: string; displayText: string }) => void;
  onMailto: (mailtoUrl: string) => void;
}) {
  return (
    <>
      {paragraphs.map((para, pIdx) => {
        const text =
          translation && translatedSegment(para, translation.segments);
        const displayPara = localizeText(para);
        const mainText =
          translation?.mode === "translated" && text ? text : displayPara;
        return (
          <p key={pIdx}>
            <PlainTextWithLinks
              text={mainText}
              onExternalLink={onExternalLink}
              onMailto={onMailto}
            />
            {translation?.mode === "bilingual" && text && (
              <span
                className="reader-translated-paragraph"
                lang={translation.target}
              >
                <PlainTextWithLinks
                  text={text}
                  onExternalLink={onExternalLink}
                  onMailto={onMailto}
                />
              </span>
            )}
          </p>
        );
      })}
    </>
  );
}
