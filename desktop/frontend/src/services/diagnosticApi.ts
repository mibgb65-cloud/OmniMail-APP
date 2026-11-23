import type {
  DiagnosticReport,
  RawSourceView,
  StorageBreakdown,
  SyncLogEntry,
  SyncLogFilter,
} from "../../bindings/omnimail/internal/diagnostics/models";
import * as DiagnosticService from "../../bindings/omnimail/services/diagnosticservice";
import { DIAGNOSTIC_LOGS } from "../data/rulesAndDiagnostics";
import { isWailsDesktop } from "../state/storageHelpers";

export type {
  DiagnosticReport,
  RawSourceView,
  StorageBreakdown,
  SyncLogEntry,
  SyncLogFilter,
};

export const diagnosticApi = {
  async runAccountDiagnostics(
    accountId = "",
  ): Promise<DiagnosticReport | null> {
    if (!isWailsDesktop()) return null;
    return DiagnosticService.RunAccountDiagnostics(accountId);
  },

  async listSyncLogs(
    filter: Partial<SyncLogFilter> = {},
  ): Promise<SyncLogEntry[]> {
    if (!isWailsDesktop()) {
      return DIAGNOSTIC_LOGS.map((l, idx) => ({
        id: idx + 1,
        timeText: l.time,
        accountId: "",
        accountTag: "预览",
        protocol: "IMAP",
        level: l.level,
        stage: "SYNC",
        durationMs: 18,
        message: l.text,
        detail: "",
      }));
    }
    const rows = await DiagnosticService.ListSyncLogs({
      accountId: filter.accountId ?? "",
      level: filter.level ?? "",
      protocol: filter.protocol ?? "",
      limit: filter.limit ?? 150,
    });
    return rows ?? [];
  },

  async getMessageRawSource(mailId: string): Promise<RawSourceView | null> {
    if (!isWailsDesktop()) return null;
    return DiagnosticService.GetMessageRawSource(mailId);
  },

  async getStorageBreakdown(): Promise<StorageBreakdown | null> {
    if (!isWailsDesktop()) return null;
    return DiagnosticService.GetStorageBreakdown();
  },

  async clearAttachmentCache(): Promise<number> {
    if (!isWailsDesktop()) return 0;
    return DiagnosticService.ClearAttachmentCache();
  },

  async exportDiagnosticBundle(): Promise<string> {
    if (!isWailsDesktop()) return "omnimail-diag-preview.zip";
    return DiagnosticService.ExportDiagnosticBundle();
  },
};
