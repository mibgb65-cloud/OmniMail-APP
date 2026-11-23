import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type CSSProperties,
} from "react";
import { attachScrollFade } from "./scrollFade";

type FadeTextareaProps = ComponentPropsWithRef<"textarea"> & {
  frameClassName?: string;
  surface?: `--${string}`;
};

export function FadeTextarea({
  ref,
  surface = "--bg-card",
  frameClassName,
  ...textareaProps
}: FadeTextareaProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLTextAreaElement>(null);
  const refresh = useRef<(() => void) | undefined>(undefined);
  useImperativeHandle(ref, () => viewport.current!, []);
  useLayoutEffect(() => {
    const scroll = attachScrollFade(host.current!, viewport.current!, {
      editable: true,
    });
    refresh.current = scroll.refresh;
    return () => {
      scroll.dispose();
      refresh.current = undefined;
    };
  }, []);
  useLayoutEffect(
    () => refresh.current?.(),
    [textareaProps.value, textareaProps.defaultValue],
  );
  return (
    <div
      className={`fade-textarea ${frameClassName ?? ""}`}
      ref={host}
      style={{ "--scroll-fade-surface": `var(${surface})` } as CSSProperties}
    >
      <textarea {...textareaProps} ref={viewport} />
    </div>
  );
}
