import { useLayoutEffect, useRef, type KeyboardEvent, type Ref } from "react";
import { createPortal } from "react-dom";
import type { CustomSelectOption } from "./CustomSelect";
import { CustomSelectOptionList } from "./CustomSelectOptionList";
import type { PopoverGeometry } from "./popoverPosition";
import { FadeScroll } from "./scroll-fade/FadeScroll";

export function CustomSelectPopover({
  ref,
  geo,
  closing,
  search,
  searchLabel,
  choices,
  value,
  focusIndex,
  mono,
  onFocusIndex,
  onChoose,
  onSearch,
  onKeyDown,
}: {
  ref: Ref<HTMLDivElement>;
  geo: PopoverGeometry;
  closing: boolean;
  search: string;
  searchLabel?: string;
  choices: CustomSelectOption[];
  value: string | number;
  focusIndex: number;
  mono: boolean;
  onFocusIndex: (index: number) => void;
  onChoose: (choice: CustomSelectOption) => void;
  onSearch: (query: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!closing) searchRef.current?.focus({ preventScroll: true });
  }, [closing, searchLabel]);

  useLayoutEffect(() => {
    if (closing) return;
    const viewport = viewportRef.current;
    const option = viewport?.querySelector(".custom-select-option.focused");
    if (!viewport || !option || option.matches(":hover")) return;
    const bounds = viewport.getBoundingClientRect();
    const optionBounds = option.getBoundingClientRect();
    const visibleTop = Math.max(
      bounds.top,
      searchRef.current?.getBoundingClientRect().bottom ?? 0,
    );
    if (optionBounds.top < visibleTop)
      viewport.scrollTop += optionBounds.top - visibleTop;
    else if (optionBounds.bottom > bounds.bottom)
      viewport.scrollTop += optionBounds.bottom - bounds.bottom;
  }, [focusIndex, search, closing]);

  return createPortal(
    <FadeScroll
      ref={ref}
      surface="--bg-popover"
      viewportProps={{
        ref: viewportRef,
        role: searchLabel ? undefined : "listbox",
        tabIndex: -1,
      }}
      inert={closing}
      data-omnimail-popover="select"
      data-side={geo.side}
      data-closing={closing ? "true" : "false"}
      className="custom-select-menu custom-select-popover"
      style={{
        left: geo.left,
        top: geo.top,
        bottom: geo.bottom,
        width: geo.width,
        maxHeight: geo.maxHeight,
      }}
    >
      {searchLabel && (
        <input
          ref={searchRef}
          className="input custom-select-search"
          type="search"
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          onKeyDown={(event) => {
            if (["ArrowUp", "ArrowDown", "Enter", "Tab"].includes(event.key))
              onKeyDown(event);
          }}
        />
      )}
      <CustomSelectOptionList
        choices={choices}
        value={value}
        focusIndex={focusIndex}
        mono={mono}
        searchLabel={searchLabel}
        onFocusIndex={onFocusIndex}
        onChoose={onChoose}
      />
    </FadeScroll>,
    document.body,
  );
}
