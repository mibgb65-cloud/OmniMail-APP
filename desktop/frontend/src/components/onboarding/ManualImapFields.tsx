import { CustomSelect } from "../common/CustomSelect";
import { PasswordInput } from "../common/PasswordInput";

const SECURITY_OPTIONS = [
  { value: "SSL/TLS", label: "SSL / TLS", hint: "推荐 · 993/465" },
  { value: "STARTTLS", label: "STARTTLS", hint: "143/587" },
  { value: "NONE", label: "无加密 (不推荐)", hint: "仅内网调试" },
];

export interface ManualImapFormState {
  displayName: string;
  email: string;
  password: string;
  imapHost: string;
  imapPort: string;
  smtpHost: string;
  smtpPort: string;
  security: string;
}

export function ManualImapFields({
  val,
  onChange,
  onEmailBlur,
}: {
  val: ManualImapFormState;
  onChange: (patch: Partial<ManualImapFormState>) => void;
  onEmailBlur: (email: string) => void;
}) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">账户显示名称</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={val.displayName}
            onChange={(e) => onChange({ displayName: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-muted">邮箱地址</label>
          <input
            type="email"
            className="input"
            style={{ marginTop: 4 }}
            value={val.email}
            onChange={(e) => onChange({ email: e.target.value })}
            onBlur={(e) => onEmailBlur(e.target.value)}
            placeholder="name@company.example"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted">应用密码 / 授权码</label>
        <PasswordInput
          style={{ marginTop: 4 }}
          value={val.password}
          onChange={(password) => onChange({ password })}
          placeholder="密码将经 DPAPI 加密写入本地凭据盒"
          ariaLabel="应用密码或授权码"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">收件服务器（IMAP）</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={val.imapHost}
            onChange={(e) => onChange({ imapHost: e.target.value })}
            placeholder="imap.company.example"
          />
        </div>
        <div>
          <label className="text-xs text-muted">IMAP 端口</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={val.imapPort}
            onChange={(e) => onChange({ imapPort: e.target.value })}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1.25fr",
          gap: 10,
        }}
      >
        <div>
          <label className="text-xs text-muted">发件服务器（SMTP）</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={val.smtpHost}
            onChange={(e) => onChange({ smtpHost: e.target.value })}
            placeholder="smtp.company.example"
          />
        </div>
        <div>
          <label className="text-xs text-muted">SMTP 端口</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={val.smtpPort}
            onChange={(e) => onChange({ smtpPort: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-muted">加密方式</label>
          <CustomSelect
            mono
            fullWidth
            minMenuWidth={216}
            style={{ marginTop: 4 }}
            value={val.security}
            options={SECURITY_OPTIONS}
            ariaLabel="加密方式"
            onChange={(next) =>
              onChange({
                security: next,
                smtpPort:
                  next === "STARTTLS"
                    ? "587"
                    : next === "SSL/TLS"
                      ? "465"
                      : val.smtpPort,
              })
            }
          />
        </div>
      </div>
    </>
  );
}
