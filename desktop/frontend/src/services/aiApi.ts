import type {
  AskMailRequest,
  ComposeAssistRequest,
  MailAnalysisOptions,
  ModelsRequest,
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
  ModelsRequest,
  SaveConfigRequest,
  TestResult,
};

function requireDesktop() {
  if (!isWailsDesktop())
    throw new Error("请在 OmniMail 桌面应用中配置 AI 服务");
}

export const aiApi = {
  async saveProviderConfig(req: SaveConfigRequest): Promise<AppSettings> {
    requireDesktop();
    const saved = await AiService.SaveAiProviderConfig(req);
    return mapBackendSettings(saved as unknown as Partial<AppSettings>);
  },

  async getApiKeyMask(provider: string, baseUrl: string): Promise<string> {
    return isWailsDesktop() ? AiService.GetAiApiKeyMask(provider, baseUrl) : "";
  },

  async clearApiKey(provider: string, baseUrl: string): Promise<AppSettings> {
    requireDesktop();
    const saved = await AiService.ClearAiApiKey(provider, baseUrl);
    return mapBackendSettings(saved as unknown as Partial<AppSettings>);
  },

  async fetchModels(req: ModelsRequest): Promise<string[]> {
    requireDesktop();
    return (await AiService.FetchAiModels(req)) ?? [];
  },

  async testConnection(req: SaveConfigRequest): Promise<TestResult> {
    requireDesktop();
    return AiService.TestAiConnection(req);
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
          summaryLanguage: dto.insight.summaryLanguage,
          draftLanguage: dto.insight.draftLanguage,
          draftTone: dto.insight.draftTone,
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
    consentConfirmed: boolean,
    {
      forceRefresh,
      ...options
    }: MailAnalysisOptions & { forceRefresh: boolean },
  ): Promise<AiMailInsight> {
    const res = await AiService.AnalyzeMail(
      mailId,
      consentConfirmed,
      forceRefresh,
      options,
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
      summaryLanguage: res.summaryLanguage,
      draftLanguage: res.draftLanguage,
      draftTone: res.draftTone,
    };
  },

  async askMailStream(req: {
    requestId: string;
    mailId: string;
    question: string;
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
