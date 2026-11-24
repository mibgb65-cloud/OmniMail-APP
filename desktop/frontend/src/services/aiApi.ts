import type {
  AskMailRequest,
  ComposeAssistRequest,
  AiMailInsight as BackendInsight,
  MailSummaryOptions,
  MailDraftOptions,
  ModelsRequest,
  SaveConfigRequest,
  TestResult,
} from "../../bindings/omnimail/internal/ai/models";
import * as AiService from "../../bindings/omnimail/services/aiservice";
import { t } from "../i18n";
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
  if (!isWailsDesktop()) throw new Error(t("ai.desktopOnlyAiError"));
}

function mapInsight(ins: BackendInsight): AiMailInsight {
  return {
    summaryTitle: ins.summaryTitle ?? "",
    summary: ins.summary ?? "",
    deadlines: ins.deadlines ?? [],
    draftTag: ins.draftTag ?? "",
    draftReply: ins.draftReply ?? "",
    sourceLanguage: ins.sourceLanguage,
    summaryLanguage: ins.summaryLanguage,
    draftLanguage: ins.draftLanguage,
    draftTargetLanguage: ins.draftTargetLanguage,
    draftTone: ins.draftTone,
    cached: ins.cached,
  };
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

  testTranslationConnection() {
    requireDesktop();
    return AiService.TestTranslationConnection();
  },

  async getCachedInsight(mailId: string): Promise<{
    insight: AiMailInsight | null;
    turns: AiChatTurn[];
  }> {
    if (!isWailsDesktop() || !mailId) return { insight: null, turns: [] };
    const dto = await AiService.GetCachedMailInsight(mailId);
    const ins = dto.insight ? mapInsight(dto.insight) : null;
    const turns: AiChatTurn[] = (dto.turns ?? []).map((t) => ({
      id: t.id,
      role: t.role === "assistant" ? "assistant" : "user",
      content: t.content,
      timestamp: t.timestamp,
    }));
    return { insight: ins, turns };
  },

  summarizeMail(
    mailId: string,
    consentConfirmed: boolean,
    forceRefresh: boolean,
    options: MailSummaryOptions,
  ) {
    return AiService.SummarizeMail(
      mailId,
      consentConfirmed,
      forceRefresh,
      options,
    ).then(mapInsight);
  },

  generateReplyDraft(
    mailId: string,
    consentConfirmed: boolean,
    options: MailDraftOptions,
  ) {
    return AiService.GenerateReplyDraft(mailId, consentConfirmed, options).then(
      mapInsight,
    );
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
