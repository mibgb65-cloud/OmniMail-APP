import { Events } from "@wailsio/runtime";
import { useEffect, useRef } from "react";
import { TranslateMail } from "../../../../bindings/omnimail/services/aiservice";
import { useI18n } from "../../../i18n";
import { parseBackendError } from "../../../services/backendClient";
import { isWailsDesktop } from "../../../state/storageHelpers";
import type { TranslationProvider } from "../../../types/settings";
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
    failureMessage:
      typeof data.failureMessage === "string" ? data.failureMessage : undefined,
  };
}

export function useTranslationRequests({
  profileId,
  provider,
  mailId,
  token,
  disabled,
  entry,
  update,
}: {
  profileId: string;
  provider: TranslationProvider;
  mailId: string;
  token: object;
  disabled: boolean;
  entry?: TranslationEntry;
  update: UpdateTranslationEntry;
}) {
  const { t } = useI18n();
  const running = useRef(new Map<object, Map<string, () => void>>());
  useEffect(() => {
    const requests = running.current;
    return () => {
      for (const cancel of requests.get(token)?.values() ?? []) cancel();
      requests.delete(token);
    };
  }, [token]);

  return async (options: TranslationOptions, preserveMode = false) => {
    if (!mailId || disabled || entry?.phase === "pending") return;
    if (canReuseTranslation(entry, options, provider)) {
      update(
        (current) => current && changeTranslationMode(current, options.mode),
      );
      return;
    }
    const scope = running.current.get(token) ?? new Map<string, () => void>();
    if (scope.has(mailId)) return;
    scope.set(mailId, () => undefined);
    running.current.set(token, scope);
    const key = { profileId, mailId, requestId: crypto.randomUUID() };
    update((previous) =>
      startTranslation(key, options, provider, previous, preserveMode),
    );
    try {
      if (!isWailsDesktop()) throw new Error(t("translation.desktopOnlyError"));
      const snapshot = await runTranslationRequest(
        key,
        (listener) =>
          Events.On("omnimail:mail:translation-batch", (event) =>
            listener(event.data),
          ),
        () => {
          const request = TranslateMail({
            ...key,
            provider,
            source: options.source,
            target: options.target,
            includeSubject: options.includeSubject,
            consentConfirmed: true,
          });
          scope.set(mailId, () => void request.cancel().catch(() => undefined));
          return request;
        },
        (payload) => {
          const batch = readBatch(key, payload);
          if (batch) update((current) => applyTranslationBatch(current, batch));
        },
        matchesTranslationRequest,
      );
      const result = readBatch(key, snapshot);
      if (!result) throw new Error(t("translation.invalidResultError"));
      update((current) => finishTranslation(current, result));
    } catch (err) {
      const { code, message } = parseBackendError(err);
      update((current) =>
        failTranslation(
          current,
          key,
          code ? message : t("translation.failedCheckSettings"),
        ),
      );
    } finally {
      scope.delete(mailId);
      if (!scope.size) running.current.delete(token);
    }
  };
}
