import type {
  AskMailRequest,
  ComposeAssistRequest,
  SaveConfigRequest,
  TestResult,
} from "../../bindings/omnimail/internal/ai/models";
import * as AiService from "../../bindings/omnimail/services/aiservice";
import { isWailsDesktop } from "../state/storageHelpers";
import type { AppSettings } from "../types/settings";
import type { AiChatTurn, AiMailInsight } from "../types/workspace";
import { mapBackendSettings } from "./profileApi";

export type {
  AskMailRequest,
  ComposeAssistRequest,
  SaveConfigRequest,
  TestResult,
};

export const aiApi = {
  async saveProviderConfig(
    req: SaveConfigRequest,
  ): Promise<AppSettings | null> {
    if (!isWailsDesktop()) return null;
    const saved = await AiService.SaveAiProviderConfig(req);
    return mapBackendSettings(saved as unknown as Partial<AppSettings>);
  },

  async clearApiKey(provider = ""): Promise<AppSettings | null> {
    if (!isWailsDesktop()) return null;
    const saved = await AiService.ClearAiApiKey(provider);
    return mapBackendSettings(saved as unknown as Partial<AppSettings>);
  },

  async testConnection(): Promise<TestResult> {
    if (!isWailsDesktop()) {
      return {
        ok: true,
        status: "idle",
        latencyMs: 120,
        message: "浏览器预览模式连接就绪",
      };
    }
    return AiService.TestAiConnection();
  },

  async getCachedInsight(mailId: string): Promise<{
    insight: AiMailInsight | null;
    turns: AiChatTurn[];
  }> {
    if (!isWailsDesktop() || !mailId) return { insight: null, turns: [] };
    const dto = await AiService.GetCachedMailInsight(mailId);
    const ins = dto.insight
      ? {
          summaryTitle: dto.insight.summaryTitle ?? "",
          summary: dto.insight.summary ?? "",
          deadlines: (dto.insight.deadlines ?? []).map((d) => ({
            label: d.label,
            timeText: d.timeText,
            urgent: Boolean(d.urgent),
          })),
          draftTag: dto.insight.draftTag ?? "建议回复",
          draftReply: dto.insight.draftReply ?? "",
        }
      : null;
    const turns: AiChatTurn[] = (dto.turns ?? []).map((t) => ({
      id: t.id,
      role: t.role === "assistant" ? "assistant" : "user",
      content: t.content,
      timestamp: t.timestamp,
    }));
    return { insight: ins, turns };
  },

  async analyzeMail(
    mailId: string,
    consentConfirmed = false,
    forceRefresh = false,
  ): Promise<AiMailInsight> {
    const res = await AiService.AnalyzeMail(
      mailId,
      consentConfirmed,
      forceRefresh,
    );
    return {
      summaryTitle: res.summaryTitle ?? "",
      summary: res.summary ?? "",
      deadlines: (res.deadlines ?? []).map((d) => ({
        label: d.label,
        timeText: d.timeText,
        urgent: Boolean(d.urgent),
      })),
      draftTag: res.draftTag ?? "建议回复",
      draftReply: res.draftReply ?? "",
    };
  },

  async askMailStream(req: {
    mailId: string;
    question: string;
    history: AiChatTurn[];
    consentConfirmed: boolean;
  }): Promise<string> {
    return AiService.AskMailStream(req);
  },

  async assistComposeStream(req: {
    draftId?: string;
    action: string;
    tone: string;
    subject?: string;
    body: string;
    prompt?: string;
    consentConfirmed: boolean;
  }): Promise<string> {
    return AiService.AssistComposeStream({
      draftId: req.draftId ?? "",
      action: req.action,
      tone: req.tone,
      subject: req.subject ?? "",
      body: req.body,
      prompt: req.prompt ?? "",
      consentConfirmed: req.consentConfirmed,
    });
  },

  async cancelRequest(requestId: string): Promise<void> {
    if (!isWailsDesktop() || !requestId) return;
    await AiService.CancelAiRequest(requestId);
  },
};
