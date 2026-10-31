export const ACCOUNT_FIELD_FOCUS = 'omnimail:account-field-focus';

// 用同一请求先展开所属账号，再由表单在 DOM 就绪后聚焦，避免聚焦隐藏输入失败。
export function requestAccountFieldFocus(id: string) {
  document.getElementById(id)?.dispatchEvent(new Event(ACCOUNT_FIELD_FOCUS, { bubbles: true }));
}
