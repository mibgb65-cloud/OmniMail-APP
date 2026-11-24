import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { attachOverlayScrollbarInteraction } from "./overlayScrollbar";
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
  const track = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
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
    const hostEl = host.current!;
    const viewportEl = viewport.current!;
    const trackEl = track.current!;
    const thumbEl = thumb.current!;
    const overlay = attachOverlayScrollbarInteraction(
      hostEl,
      viewportEl,
      trackEl,
      thumbEl,
    );
    const scroll = attachScrollFade(hostEl, viewportEl, {
      content: content.current!,
      track: trackEl,
      thumb: thumbEl,
      focusOnOverflow,
      onScrollActivity: overlay.notifyScrollActivity,
    });
    return () => {
      scroll.dispose();
      overlay.dispose();
    };
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
      <div className="fade-scroll-track" ref={track} aria-hidden="true">
        <div className="fade-scroll-thumb" ref={thumb} />
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
