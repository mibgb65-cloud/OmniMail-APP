import { useApp } from "../../../state/AppContext";
import type { MeetingInvite } from "../../../types/mail";
import { Icon } from "../../common/Icon";

export function MeetingInviteCard({
  mailId,
  invite,
}: {
  mailId: string;
  invite: MeetingInvite;
}) {
  const { mailStore, toastStore } = useApp();

  const setRsvp = (next: MeetingInvite["rsvp"], label: string) => {
    mailStore.updateMail(mailId, {
      meetingInvite: { ...invite, rsvp: next },
      statusBadge: `会议 · ${label}`,
    });
    toastStore.pushToast({
      tone: "success",
      title: `已将会议状态更新为「${label}」`,
    });
  };

  return (
    <div className="ics-card">
      <div className="ics-header">
        <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
          <div className="ics-cal-box">
            <div className="ics-cal-month">{invite.monthLabel}</div>
            <div className="ics-cal-day">{invite.dayNumber}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-ink)",
              }}
            >
              {invite.title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="clock" size={13} /> {invite.dateTimeText}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="video" size={13} /> {invite.locationText}
            </div>
          </div>
        </div>
        <span className="pill pill-success">
          ● {invite.conflictStatus === "free" ? "日程无冲突" : "时间冲突"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          参会人员（{invite.attendees.length} 人）
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          附件：{invite.icsFileName}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {invite.attendees.map((a) => (
          <span
            key={a.name}
            className="pill pill-neutral"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
            }}
          >
            <strong>{a.name}</strong> · {a.role}
          </span>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
          paddingTop: 6,
          borderTop: "1px solid var(--border-default)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            你的回复：
          </span>
          <button
            type="button"
            className={`btn btn-sm ${invite.rsvp === "accepted" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setRsvp("accepted", "已接受")}
          >
            <Icon name="check" size={13} /> 接受
          </button>
          <button
            type="button"
            className={`btn btn-sm ${invite.rsvp === "tentative" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setRsvp("tentative", "暂定")}
          >
            <Icon name="clock" size={13} /> 暂定
          </button>
          <button
            type="button"
            className={`btn btn-sm ${invite.rsvp === "declined" ? "btn-danger" : "btn-danger-soft"}`}
            onClick={() => setRsvp("declined", "已拒绝")}
          >
            <Icon name="x" size={13} /> 拒绝
          </button>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() =>
              toastStore.pushToast({
                tone: "success",
                title: "已复制会议链接至剪贴板",
              })
            }
          >
            <Icon name="copy" size={13} /> 复制会议链接
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() =>
              toastStore.pushToast({
                tone: "info",
                title: `已导出日程文件 ${invite.icsFileName}`,
              })
            }
          >
            <Icon name="download" size={13} /> 导出 .ics
          </button>
        </div>
      </div>
    </div>
  );
}
