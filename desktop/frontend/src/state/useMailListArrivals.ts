import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { mailApi, type MailSearchQuery } from "../services/backendClient";
import type { MailItem } from "../types/mail";
import {
  consumeArrivalsAtTop,
  mailListScrollFlags,
  selectArrivalIds,
} from "./mailListArrivalPolicy";

type Query = (cursor?: string) => MailSearchQuery;

interface ArrivalSession {
  query: Query;
  revision: number;
  top: number;
  visit: number;
  deferred: boolean;
  requested: Set<string>;
  matching: Set<string>;
}

const AT_TOP = { scrolled: false, showPill: false, newCount: 0 };

export function useMailListArrivals(
  query: Query,
  revision: number,
  reload: () => Promise<void>,
) {
  const session = useRef<ArrivalSession | null>(null);
  const [view, setView] = useState<{
    query: Query;
    revision: number;
    scrolled: boolean;
    showPill: boolean;
    newCount: number;
  }>();

  useLayoutEffect(() => {
    session.current = {
      query,
      revision,
      top: 0,
      visit: 0,
      deferred: false,
      requested: new Set(),
      matching: new Set(),
    };
    return () => {
      session.current = null;
    };
  }, [query, revision]);

  const publish = useCallback((active: ArrivalSession) => {
    const flags = mailListScrollFlags(active.top);
    const next = {
      query: active.query,
      revision: active.revision,
      ...flags,
      newCount: active.matching.size,
    };
    setView((prev) =>
      prev?.query === next.query &&
      prev.revision === next.revision &&
      prev.scrolled === next.scrolled &&
      prev.showPill === next.showPill &&
      prev.newCount === next.newCount
        ? prev
        : next,
    );
  }, []);

  const onScrollPosition = useCallback(
    (top: number) => {
      const active = session.current;
      if (!active || active.query !== query || active.top === top) return;
      active.top = top;
      if (top <= 0) active.visit++;
      if (consumeArrivalsAtTop(top, active.matching, active.deferred)) {
        active.deferred = false;
        void reload();
      }
      publish(active);
    },
    [publish, query, reload],
  );

  const deferMailDelta = useCallback(
    (
      ids: readonly string[],
      mails: readonly MailItem[],
      wouldReload: boolean,
    ) => {
      const active = session.current;
      if (!active || active.query !== query) return false;
      const { scrolled, showPill } = mailListScrollFlags(active.top);
      if (!scrolled || (!showPill && !active.deferred && !active.matching.size))
        return false;
      active.deferred ||= wouldReload;

      if (showPill && ids.length) {
        const visit = active.visit;
        const candidates = selectArrivalIds(
          ids,
          new Set(mails.map((mail) => mail.id)),
          active.requested,
        );
        void (async () => {
          const batchSize = 200;
          for (
            let i = 0;
            i < candidates.length && session.current === active;
            i += batchSize
          ) {
            const messageIds = candidates.slice(i, i + batchSize);
            // 交给现有查询校验账号、文件夹、标签和搜索条件，不把其他视图的新信算进来。
            const matches = await mailApi
              .matchMailIds(query(), messageIds)
              .catch(() => null);
            if (session.current !== active) return;
            if (!matches) {
              for (const id of messageIds) active.requested.delete(id);
              continue;
            }
            // 回顶后的旧查询只在未读清单需要补刷新时处理，不再点亮新一轮胶囊。
            if (visit !== active.visit) {
              if (!wouldReload && matches.length > 0) {
                if (active.top <= 0) void reload();
                else active.deferred = true;
              }
              continue;
            }
            for (const id of matches) active.matching.add(id);
            if (
              consumeArrivalsAtTop(active.top, active.matching, active.deferred)
            ) {
              active.deferred = false;
              void reload();
            }
            publish(active);
          }
        })();
      }
      return true;
    },
    [publish, query, reload],
  );

  const visible = view?.query === query && view.revision === revision;
  const { scrolled, showPill, newCount } = visible ? view : AT_TOP;
  return { scrolled, showPill, newCount, onScrollPosition, deferMailDelta };
}
