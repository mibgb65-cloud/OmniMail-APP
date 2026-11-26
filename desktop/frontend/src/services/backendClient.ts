export {
  accountApi,
  mapAccountDTO,
  type ConnectRequest,
  type ConnectionTestReport,
  type FlowStartResult,
  type UpdateRequest,
} from "./accountApi";
export {
  aiApi,
  type AskMailRequest,
  type ComposeAssistRequest,
  type SaveConfigRequest,
  type TestResult,
} from "./aiApi";
export {
  composeApi,
  type CreateDraftRequest,
  type OutboxJobDTO,
  type SendDraftRequest,
} from "./composeApi";
export {
  contactApi,
  type ContactQuery,
  type DuplicateGroupDTO,
  type VCardImportResult,
} from "./contactApi";
export {
  diagnosticApi,
  type DiagnosticReport,
  type RawSourceView,
  type StorageBreakdown,
  type SyncLogEntry,
  type SyncLogFilter,
} from "./diagnosticApi";
export { parseBackendError, type ParsedBackendError } from "./errorParser";
export { mailApi, mapMailDTO, type MailSearchQuery } from "./mailApi";
export { museMailApi } from "./museMailApi";
export { updaterApi, type UpdaterProgressEvent } from "./updaterApi";
export { workBuddyMailApi } from "./workBuddyMailApi";
export {
  mapBackendSettings,
  profileApi,
  type CreateProfileRequest,
  type NormalizedProfileList,
  type ProfileSummary,
  type UpdateProfileRequest,
} from "./profileApi";
export { ruleApi, type RulePreviewResult } from "./ruleApi";
