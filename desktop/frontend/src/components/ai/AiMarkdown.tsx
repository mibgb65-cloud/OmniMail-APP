import { memo } from "react";
import Markdown from "react-markdown";
import { aiMarkdownOptions } from "./aiMarkdownOptions";

export const AiMarkdown = memo(function AiMarkdown({ text }: { text: string }) {
  return (
    <div className="ai-markdown selectable">
      <Markdown {...aiMarkdownOptions}>{text}</Markdown>
    </div>
  );
});
