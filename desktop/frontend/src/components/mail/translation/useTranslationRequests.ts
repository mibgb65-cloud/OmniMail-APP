import { Events } from "@wailsio/runtime";
import { useRef } from "react";
import { TranslateMail } from "../../../../bindings/omnimail/services/aiservice";
import { parseBackendError } from "../../../services/backendClient";
import { isWailsDesktop } from "../../../state/storageHelpers";
import { isLanguage } from "./translationLanguages";
import { runTranslationRequest } from "./translationRequest";
import {
  applyTranslationBatch,
  canReuseTranslation,
  changeTranslationMode,
  failTranslation,
  finishTranslation,
  matchesTranslationRequest,
  startTranslation,
  type TranslationBatch,
  type TranslationEntry,
  type TranslationRequestKey,
} from "./translationStreamState";
import type { TranslationOptions } from "./translationTypes";

export type UpdateTranslationEntry = (
  update: (entry?: TranslationEntry) => TranslationEntry | undefined,
) => void;

function readBatch(
  key: TranslationRequestKey,
  payload: unknown,
): TranslationBatch | undefined {
  if (!matchesTranslationRequest(key, payload)) return;
  const data = payload as Record<string, unknown>;
  const { totalBatches, completedBatches } = data;
  if (
    typeof totalBatches !== "number" ||
    !Number.isInteger(totalBatches) ||
    totalBatches < 1 ||
    typeof completedBatches !== "number" ||
    !Number.isInteger(completedBatches) ||
    completedBatches < 1 ||
    completedBatches > totalBatches ||
    typeof data.segments !== "object" ||
    !data.segments ||
    Array.isArray(data.segments)
  )
    return;
  const segments = Object.fromEntries(
    Object.entries(data.segments).filter(
      ([, value]) => typeof value === "string",
    ),
  );
  return {
    ...key,
    completedBatches,
    totalBatches,
    segments,
    source: isLanguage(data.source) ? data.source : "auto",
    subject: typeof data.subject === "string" ? data.subject : undefined,
  };
}

export function useTranslationRequests({
  profileId,
  mailId,
  token,
  disabled,
  entry,
  update,
}: {
  profileId: string;
  mailId: string;
  token: object;
  disabled: boolean;
  entry?: TranslationEntry;
  update: UpdateTranslationEntry;
}) {
  const running = useRef(new Map<object, Set<string>>());

  return async (options: TranslationOptions, preserveMode = false) => {
    if (!mailId || disabled || entry?.phase === "pending") return;
    if (canReuseTranslation(entry, options)) {
      update(
        (current) => current && changeTranslationMode(current, options.mode),
      );
      return;
    }
    const scope = running.current.get(token) ?? new Set<string>();
    if (scope.has(mailId)) return;
    scope.add(mailId);
    running.current.set(token, scope);
    const key = { profileId, mailId, requestId: crypto.randomUUID() };
    update((previous) =>
      startTranslation(key, options, previous, preserveMode),
    );
    try {
      if (!isWailsDesktop())
        throw new Error("请在 OmniMail 桌面应用中翻译邮件");
      const snapshot = await runTranslationRequest(
        key,
        (listener) =>
          Events.On("omnimail:mail:translation-batch", (event) =>
            listener(event.data),
          ),
        () =>
          TranslateMail({
            ...key,
            source: options.source,
            target: options.target,
            includeSubject: options.includeSubject,
            consentConfirmed: true,
          }),
        (payload) => {
          const batch = readBatch(key, payload);
          if (batch) update((current) => applyTranslationBatch(current, batch));
        },
        matchesTranslationRequest,
      );
      const result = readBatch(key, snapshot);
      if (!result) throw new Error("翻译结果无效，请重试");
      update((current) => finishTranslation(current, result));
    } catch (err) {
      update((current) =>
        failTranslation(
          current,
          key,
          parseBackendError(err).message || "翻译失败，请重试",
        ),
      );
    } finally {
      scope.delete(mailId);
      if (!scope.size) running.current.delete(token);
    }
  };
}
