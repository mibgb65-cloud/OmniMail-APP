import { Icon } from "./Icon";
import type { CustomSelectOption } from "./CustomSelect";

function CustomSelectOptionRow({
  option,
  selected,
  focused,
  mono,
  onFocusIndex,
  onChoose,
}: {
  option: CustomSelectOption;
  selected: boolean;
  focused: boolean;
  mono: boolean;
  onFocusIndex: () => void;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      className={`custom-select-option${mono ? " mono" : ""}${selected ? " selected" : ""}${focused ? " focused" : ""}`}
      onMouseEnter={onFocusIndex}
      onClick={onChoose}
    >
      <span className="row" style={{ gap: 8, minWidth: 0 }}>
        {option.icon}
        <span style={{ minWidth: 0 }}>
          <span className="select-opt-label truncate">{option.label}</span>
          {option.sublabel && (
            <span className="select-opt-sub truncate">{option.sublabel}</span>
          )}
        </span>
      </span>
      <span className="row" style={{ gap: 6, flexShrink: 0 }}>
        {option.hint && <span className="select-opt-hint">{option.hint}</span>}
        {selected && <Icon name="check" size={13} />}
      </span>
    </button>
  );
}

export function CustomSelectOptionList({
  choices,
  value,
  focusIndex,
  mono,
  searchLabel,
  onFocusIndex,
  onChoose,
}: {
  choices: CustomSelectOption[];
  value: string | number;
  focusIndex: number;
  mono: boolean;
  searchLabel?: string;
  onFocusIndex: (index: number) => void;
  onChoose: (option: CustomSelectOption) => void;
}) {
  return (
    <div
      className="custom-select-options"
      role={searchLabel ? "listbox" : undefined}
      aria-label={searchLabel}
    >
      {choices.map((option, index) => (
        <CustomSelectOptionRow
          key={String(option.value)}
          option={option}
          selected={String(option.value) === String(value)}
          focused={focusIndex === index}
          mono={mono}
          onFocusIndex={() => onFocusIndex(index)}
          onChoose={() => onChoose(option)}
        />
      ))}
      {choices.length === 0 && (
        <span className="text-xs text-muted" role="status">
          没有匹配的选项
        </span>
      )}
    </div>
  );
}
