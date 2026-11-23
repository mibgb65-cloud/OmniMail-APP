const PROFILE_COLORS = ["#141E2E", "#2563EB", "#059669", "#7C3AED", "#D97706"];

import { PasswordInput } from "../common/PasswordInput";

export interface CreateProfileFormValues {
  name: string;
  badge: string;
  color: string;
  pin: string;
  customDir: string;
}

export function ProfileCreateForm({
  val,
  onChange,
  onPickDir,
}: {
  val: CreateProfileFormValues;
  onChange: (patch: Partial<CreateProfileFormValues>) => void;
  onPickDir: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">空间名称</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={val.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="例如：开源社区 / 独立业务"
          />
        </div>
        <div>
          <label className="text-xs text-muted">徽章单字</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            maxLength={2}
            value={val.badge}
            onChange={(e) => onChange({ badge: e.target.value })}
            placeholder={val.name.slice(0, 1) || "开"}
          />
        </div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <span className="text-xs text-muted">标识色：</span>
        {PROFILE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange({ color: c })}
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: c,
              border:
                val.color === c ? "2px solid var(--brand-accent)" : "none",
            }}
            aria-label={`选择颜色 ${c}`}
          />
        ))}
      </div>

      <div>
        <label className="text-xs text-muted">
          本地 PIN 锁（可选，4~32 位）
        </label>
        <PasswordInput
          style={{ marginTop: 4 }}
          value={val.pin}
          onChange={(pin) => onChange({ pin })}
          placeholder="留空则不启用 PIN 锁"
          ariaLabel="新空间 PIN 码"
        />
      </div>

      <div>
        <label className="text-xs text-muted">独立物理目录（可选）</label>
        <div className="row" style={{ gap: 8, marginTop: 4 }}>
          <input
            className="input"
            value={val.customDir}
            onChange={(e) => onChange({ customDir: e.target.value })}
            placeholder="默认存放在主数据目录 profiles/ 下"
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onPickDir}
          >
            浏览
          </button>
        </div>
      </div>
    </div>
  );
}
