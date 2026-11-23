import { useLayoutEffect, useRef } from "react";
import type { AiChatTurn } from "../../types/workspace";

export function useAiChatScroll(
  mailId: string | undefined,
  outgoing: string | undefined,
  latest: AiChatTurn | undefined,
) {
  const viewport = useRef<HTMLDivElement>(null);
  const follow = useRef(false);
  const previous = useRef({ mailId, outgoing });

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    if (previous.current.mailId !== mailId) {
      el.scrollTop = 0;
      follow.current = false;
    }
    if (outgoing && previous.current.outgoing !== outgoing)
      follow.current = true;
    previous.current = { mailId, outgoing };
    if (follow.current) el.scrollTop = el.scrollHeight;
  }, [mailId, outgoing, latest]);

  return {
    ref: viewport,
    onScroll: () => {
      const el = viewport.current;
      if (el)
        follow.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 24;
    },
  };
}
