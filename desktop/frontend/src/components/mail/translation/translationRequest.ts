import type { TranslationRequestKey } from "./translationStreamState";

// 注册监听必须早于调用；模型可能在 IPC Promise 返回前就完成第一批。
export async function runTranslationRequest<T>(
  key: TranslationRequestKey,
  subscribe: (listener: (payload: unknown) => void) => () => void,
  call: () => PromiseLike<T>,
  onBatch: (payload: unknown) => void,
  matches: (key: TranslationRequestKey, payload: unknown) => boolean,
): Promise<T> {
  const unsubscribe = subscribe((payload) => {
    if (matches(key, payload)) onBatch(payload);
  });
  try {
    return await call();
  } finally {
    unsubscribe();
  }
}
