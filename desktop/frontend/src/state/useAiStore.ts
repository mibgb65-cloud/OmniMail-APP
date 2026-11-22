import { useCallback, useState } from "react";
import { AI_INSIGHTS_BY_MAIL, DEFAULT_AI_INSIGHT } from "../data/mails";
import type { MailItem } from "../types/mail";
import type { AiChatTurn, AiRunStatus } from "../types/workspace";

export function useAiStore() {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiRunStatus>("idle");
  const [chatsByMail, setChatsByMail] = useState<Record<string, AiChatTurn[]>>(
    {},
  );
  const [customDraftByMail, setCustomDraftByMail] = useState<
    Record<string, string>
  >({});

  const getInsight = useCallback(
    (mail: MailItem | null) => {
      if (!mail) return DEFAULT_AI_INSIGHT;
      const base = AI_INSIGHTS_BY_MAIL[mail.id] ?? DEFAULT_AI_INSIGHT;
      const customDraft = customDraftByMail[mail.id];
      return customDraft ? { ...base, draftReply: customDraft } : base;
    },
    [customDraftByMail],
  );

  const runPrompt = useCallback((mail: MailItem, prompt: string) => {
    setAiStatus("processing");
    const userTurn: AiChatTurn = {
      id: `u-${Date.now()}`,
      role: "user",
      content: prompt,
      timestamp: "刚刚",
    };
    setChatsByMail((prev) => ({
      ...prev,
      [mail.id]: [...(prev[mail.id] ?? []), userTurn],
    }));

    window.setTimeout(() => {
      let reply = `已基于《${mail.subject}》正文分析：核心需在截止时间前反馈确认；如涉及附件或发件人列表，当前遵循隐私边界未外传。`;
      if (prompt.includes("翻译")) {
        reply = `英文译文参考：\nHi Xinghe, the OmniMail 0.1 modular floating three-column workspace and multi-account onboarding boundaries are ready for review. Please share your feedback before tomorrow noon and join the 14:00 review session.`;
      } else if (prompt.includes("更正式") || prompt.includes("重写")) {
        const formal = `知夏你好：\n感谢整理 OmniMail 0.1 版本的核心方案与接入规范。我已审阅三栏浮层工作台及多邮箱来源区分方案，将于明日 12:00 前补充详细书面意见，并准时出席明日 14:00 评审会议。\n此致，\n陆星河`;
        setCustomDraftByMail((prev) => ({ ...prev, [mail.id]: formal }));
        reply =
          "已将建议回复调整为更正式的商务语气，并同步更新到上方草稿卡片，你可以点击「插入回复框」进行人工核对。";
      } else if (prompt.includes("重新生成")) {
        const alt = `知夏，方案看完了，三栏浮层卡片和原收件账户锁定逻辑很顺手。明天 14:00 评审会我准时参加，中午前把补充细节发你。`;
        setCustomDraftByMail((prev) => ({ ...prev, [mail.id]: alt }));
        reply = "已重新生成一版更简明直接的回复建议。";
      }

      const aiTurn: AiChatTurn = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: reply,
        timestamp: "刚刚",
      };
      setChatsByMail((prev) => ({
        ...prev,
        [mail.id]: [...(prev[mail.id] ?? []), aiTurn],
      }));
      setAiStatus("idle");
    }, 650);
  }, []);

  const stopGeneration = useCallback(() => {
    setAiStatus("idle");
  }, []);

  return {
    aiOpen,
    setAiOpen,
    aiStatus,
    setAiStatus,
    chatsByMail,
    getInsight,
    runPrompt,
    stopGeneration,
  };
}
