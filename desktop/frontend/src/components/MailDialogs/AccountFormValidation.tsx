import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { useTranslation } from '../../lib/i18n/useTranslation';
import styles from './AccountFormValidation.module.css';
import { ACCOUNT_FIELD_FOCUS, requestAccountFieldFocus } from './accountFieldFocus';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type IssueCode =
  | 'validationRequired'
  | 'validationEmail'
  | 'validationNumber'
  | 'validationRange'
  | 'validationLength'
  | 'validationInvalid';
interface Issue {
  id: string;
  label: string;
  code: IssueCode;
  min: string;
  max: string;
}
interface ValidationContext {
  issues: ReadonlyMap<string, Issue>;
  clear: (id: string) => void;
  recheck: (control: Control, force?: boolean) => void;
}
const Context = createContext<ValidationContext | null>(null);
const isControl = (element: EventTarget | null): element is Control =>
  element instanceof HTMLInputElement ||
  element instanceof HTMLSelectElement ||
  element instanceof HTMLTextAreaElement;

function issueFor(control: Control): Issue | undefined {
  if (!control.willValidate) return;
  const validity = control.validity;
  const textControl = control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement;
  const tooLong = textControl && control.maxLength >= 0 && control.value.length > control.maxLength;
  if (validity.valid && !tooLong) return;
  const label = control.labels?.item(0)?.textContent?.trim() ?? '';
  const scope = control.closest('fieldset')?.querySelector(':scope > legend')?.textContent?.trim();
  let code: IssueCode = 'validationInvalid';
  let min = '',
    max = '';
  if (validity.badInput || validity.stepMismatch) code = 'validationNumber';
  else if (validity.valueMissing) code = 'validationRequired';
  else if (
    validity.typeMismatch &&
    control instanceof HTMLInputElement &&
    control.type === 'email'
  ) {
    code = 'validationEmail';
  } else if (validity.rangeOverflow || validity.rangeUnderflow) {
    code = 'validationRange';
    if (control instanceof HTMLInputElement) {
      min = control.min;
      max = control.max;
    }
  } else if (tooLong || validity.tooLong) {
    code = 'validationLength';
    if (textControl) max = String(control.maxLength);
  }
  return { id: control.id, label: scope ? `${scope} · ${label}` : label, code, min, max };
}
function equalIssue(first: Issue | undefined, second: Issue | undefined) {
  return (
    first?.code === second?.code &&
    first?.label === second?.label &&
    first?.min === second?.min &&
    first?.max === second?.max
  );
}

export function ValidatedAccountForm({
  onSubmit,
  onInvalid,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<'form'>, 'noValidate'>) {
  const prefix = useId();
  const [issues, setIssues] = useState<ReadonlyMap<string, Issue>>(new Map());
  const touchedRef = useRef(new Set<string>());
  const pendingFocusRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const focus = (event: Event) => {
      if (!isControl(event.target)) return;
      pendingFocusRef.current = event.target.id;
      setIssues((previous) => new Map(previous));
    };
    form.addEventListener(ACCOUNT_FIELD_FOCUS, focus);
    return () => form.removeEventListener(ACCOUNT_FIELD_FOCUS, focus);
  }, []);
  useLayoutEffect(() => {
    const id = pendingFocusRef.current;
    pendingFocusRef.current = null;
    if (id) document.getElementById(id)?.focus();
  }, [issues]);
  const clear = useCallback((id: string) => {
    touchedRef.current.delete(id);
    setIssues((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Map(previous);
      next.delete(id);
      return next;
    });
  }, []);
  const recheck = useCallback((control: Control, force = false) => {
    if (!force && !touchedRef.current.has(control.id)) return;
    touchedRef.current.add(control.id);
    const issue = issueFor(control);
    setIssues((previous) => {
      if (equalIssue(previous.get(control.id), issue)) return previous;
      const next = new Map(previous);
      if (issue) next.set(control.id, issue);
      else next.delete(control.id);
      return next;
    });
  }, []);
  const context = useMemo(() => ({ issues, clear, recheck }), [issues, clear, recheck]);
  return (
    <Context.Provider value={context}>
      <form
        {...props}
        ref={formRef}
        noValidate
        onInvalid={(event) => {
          event.preventDefault();
          if (isControl(event.target)) recheck(event.target, true);
          onInvalid?.(event);
        }}
        onSubmit={(event) => {
          event.preventDefault();
          const invalid: Control[] = [];
          const next = new Map<string, Issue>();
          // 读取原生约束状态，不调用 reportValidity，避免浏览器气泡覆盖表单。
          Array.from(event.currentTarget.elements).forEach((element, index) => {
            if (!isControl(element)) return;
            if (!element.id) element.id = `${prefix}-control-${index}`;
            touchedRef.current.add(element.id);
            const issue = issueFor(element);
            if (issue) {
              invalid.push(element);
              next.set(element.id, issue);
            }
          });
          if (invalid.length) {
            // 错误节点和 ARIA 关联提交到 DOM 后再聚焦，确保读屏能读到对应原因。
            const first =
              invalid.find((control) => !control.closest('[data-account-editor][hidden]')) ??
              invalid[0];
            pendingFocusRef.current = first?.id ?? null;
            if (pendingFocusRef.current) requestAccountFieldFocus(pendingFocusRef.current);
            setIssues(next);
            return;
          }
          setIssues(next);
          onSubmit?.(event);
        }}
      >
        {children}
      </form>
    </Context.Provider>
  );
}

function useField(id: string, value: unknown, label: string, scopeLabel?: string) {
  const context = useContext(Context);
  const clear = context?.clear,
    recheck = context?.recheck;
  const controlRef = useRef<Control | null>(null);
  useEffect(() => () => clear?.(id), [clear, id]);
  useEffect(() => {
    if (controlRef.current) recheck?.(controlRef.current);
  }, [value, label, scopeLabel, recheck]);
  return { issue: context?.issues.get(id), controlRef, recheck };
}
function describedBy(existing: string | undefined, issue: Issue | undefined) {
  const ids = existing?.split(/\s+/).filter(Boolean) ?? [];
  if (issue) ids.push(`${issue.id}-error`);
  return ids.length ? [...new Set(ids)].join(' ') : undefined;
}
function FieldShell({
  id,
  label,
  issue,
  fullWidth,
  children,
  action,
}: {
  id: string;
  label: string;
  issue: Issue | undefined;
  fullWidth?: boolean;
  children: ReactNode;
  action?: ReactNode;
}) {
  const { t } = useTranslation('mail');
  const validation = useContext(Context);
  return (
    <div className={`${styles.field} ${fullWidth ? styles.wide : ''}`}>
      <label htmlFor={id}>{label}</label>
      {action ? (
        <div className={styles.controls}>
          {children}
          {action}
        </div>
      ) : (
        children
      )}
      {issue && (
        <span
          id={`${id}-error`}
          className={styles.error}
          role={validation?.issues.size === 1 ? 'alert' : undefined}
        >
          {t(issue.code, { min: issue.min, max: issue.max })}
        </span>
      )}
    </div>
  );
}
type FieldProps = { label: string; fullWidth?: boolean; scopeLabel?: string };
export function AccountInput({
  label,
  fullWidth,
  scopeLabel,
  id: suppliedId,
  onChange,
  action,
  ...props
}: ComponentPropsWithoutRef<'input'> & FieldProps & { action?: ReactNode }) {
  const generated = useId(),
    id = suppliedId || generated;
  const { issue, controlRef, recheck } = useField(id, props.value, label, scopeLabel);
  return (
    <FieldShell id={id} label={label} issue={issue} fullWidth={fullWidth} action={action}>
      <input
        {...props}
        id={id}
        ref={(node) => {
          controlRef.current = node;
        }}
        aria-invalid={issue ? true : props['aria-invalid']}
        aria-describedby={describedBy(props['aria-describedby'], issue)}
        onChange={(event) => {
          const control = event.currentTarget;
          onChange?.(event);
          recheck?.(control);
        }}
      />
    </FieldShell>
  );
}
export function AccountSelect({
  label,
  fullWidth,
  scopeLabel,
  id: suppliedId,
  onChange,
  ...props
}: ComponentPropsWithoutRef<'select'> & FieldProps) {
  const generated = useId(),
    id = suppliedId || generated;
  const { issue, controlRef, recheck } = useField(id, props.value, label, scopeLabel);
  return (
    <FieldShell id={id} label={label} issue={issue} fullWidth={fullWidth}>
      <select
        {...props}
        id={id}
        ref={(node) => {
          controlRef.current = node;
        }}
        aria-invalid={issue ? true : props['aria-invalid']}
        aria-describedby={describedBy(props['aria-describedby'], issue)}
        onChange={(event) => {
          const control = event.currentTarget;
          onChange?.(event);
          recheck?.(control);
        }}
      />
    </FieldShell>
  );
}
export function AccountValidationSummary() {
  const context = useContext(Context);
  const { t } = useTranslation('mail');
  if (!context || context.issues.size < 2) return null;
  return (
    <div role="alert" className={styles.summary}>
      <p>{t('validationSummary', { count: context.issues.size })}</p>
      <ul>
        {Array.from(context.issues.values()).map((issue) => (
          <li key={issue.id}>
            <a
              href={`#${issue.id}`}
              onClick={(event) => {
                event.preventDefault();
                requestAccountFieldFocus(issue.id);
              }}
            >
              {issue.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
