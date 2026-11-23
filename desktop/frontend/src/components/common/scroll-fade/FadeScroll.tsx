import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { attachScrollFade } from "./scrollFade";

type FadeScrollProps = ComponentPropsWithRef<"div"> & {
  label?: string;
  viewportProps?: ComponentPropsWithRef<"div">;
  surface?: `--${string}`;
};

export function FadeScroll({
  children,
  className,
  label,
  style,
  surface = "--bg-card",
  ref,
  viewportProps,
  ...hostProps
}: FadeScrollProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const {
    ref: viewportRef,
    tabIndex,
    className: viewportClass,
    ...rest
  } = viewportProps ?? {};
  const focusOnOverflow = tabIndex === undefined;

  useImperativeHandle(ref, () => host.current!, []);
  useImperativeHandle(viewportRef, () => viewport.current!, []);
  useLayoutEffect(() => {
    const scroll = attachScrollFade(host.current!, viewport.current!, {
      content: content.current!,
      focusOnOverflow,
    });
    return scroll.dispose;
  }, [focusOnOverflow]);

  return (
    <div
      {...hostProps}
      className={`fade-scroll ${className ?? ""}`}
      ref={host}
      style={
        {
          "--scroll-fade-surface": `var(${surface})`,
          ...style,
        } as CSSProperties
      }
    >
      <div
        role={label ? "region" : undefined}
        aria-label={label}
        {...rest}
        className={`fade-scroll-viewport ${viewportClass ?? ""}`}
        ref={viewport}
        tabIndex={tabIndex}
      >
        <div className="fade-scroll-content" ref={content}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ScrollCodeBlock({
  children,
  maxHeight,
  label,
}: {
  children: ReactNode;
  maxHeight: number;
  label: string;
}) {
  return (
    <FadeScroll
      className="fade-code-block"
      surface="--bg-surface"
      style={{ maxHeight }}
      label={label}
    >
      <pre className="code-block selectable">{children}</pre>
    </FadeScroll>
  );
}
