package mailproto

import (
	"database/sql"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/emersion/go-ical"
)

type CalendarAttendee struct {
	Name   string `json:"name"`
	Email  string `json:"email,omitempty"`
	Role   string `json:"role"`
	Status string `json:"status"`
}

type ParsedMeetingInvite struct {
	UID            string             `json:"uid"`
	Method         string             `json:"method"`
	Sequence       string             `json:"sequence"`
	OrganizerEmail string             `json:"organizerEmail"`
	Title          string             `json:"title"`
	MonthLabel     string             `json:"monthLabel"`
	DayNumber      string             `json:"dayNumber"`
	DateTimeText   string             `json:"dateTimeText"`
	LocationText   string             `json:"locationText"`
	MeetingLink    string             `json:"meetingLink"`
	ConflictStatus string             `json:"conflictStatus"`
	ConflictHint   string             `json:"conflictHint,omitempty"`
	ICSFileName    string             `json:"icsFileName"`
	StartAtMs      int64              `json:"startAtMs"`
	EndAtMs        int64              `json:"endAtMs"`
	Attendees      []CalendarAttendee `json:"attendees"`
	RSVP           string             `json:"rsvp"`
}

var reMeetingURL = regexp.MustCompile(`https?://[^\s<>"')]+`)

// ParseICSInvite 解析 RFC5545 VEVENT 并提取日程元数据与参会人状态。
func ParseICSInvite(rawICS, fileName, selfEmail, extraBody string) (*ParsedMeetingInvite, error) {
	if strings.TrimSpace(rawICS) == "" {
		return nil, nil
	}
	dec := ical.NewDecoder(strings.NewReader(rawICS))
	cal, err := dec.Decode()
	if err != nil {
		return nil, err
	}
	method := strings.ToUpper(propText(cal.Props, ical.PropMethod))
	events := cal.Events()
	if len(events) == 0 {
		return nil, nil
	}
	ev := events[0]
	uid := propText(ev.Props, ical.PropUID)
	summary := propText(ev.Props, ical.PropSummary)
	if summary == "" {
		summary = "日程会议邀请"
	}
	startT, err := ev.DateTimeStart(time.Local)
	if err != nil || startT.IsZero() {
		startT = parseICSTimeFallback(propText(ev.Props, ical.PropDateTimeStart))
	}
	endT, err := ev.DateTimeEnd(time.Local)
	if err != nil || endT.IsZero() || !endT.After(startT) {
		endT = startT.Add(1 * time.Hour)
	}
	startT, endT = startT.In(time.Local), endT.In(time.Local)

	loc := propText(ev.Props, ical.PropLocation)
	desc := propText(ev.Props, ical.PropDescription)
	link := extractMeetingURL(loc + "\n" + desc + "\n" + extraBody)
	if loc == "" && link != "" {
		loc = "线上视频会议"
	} else if loc == "" {
		loc = "待定地点"
	}

	orgEmail, attendees, selfRSVP := parseAttendeesAndOrganizer(ev, selfEmail)
	if method == "CANCEL" {
		summary = "[已取消] " + summary
	}
	if fileName == "" {
		fileName = "invite.ics"
	}

	return &ParsedMeetingInvite{
		UID:            uid,
		Method:         method,
		Sequence:       propText(ev.Props, ical.PropSequence),
		OrganizerEmail: orgEmail,
		Title:          summary,
		MonthLabel:     fmt.Sprintf("%d月", int(startT.Month())),
		DayNumber:      fmt.Sprintf("%02d", startT.Day()),
		DateTimeText:   fmt.Sprintf("%s - %s", startT.Format("2006-01-02 15:04"), endT.Format("15:04")),
		LocationText:   loc,
		MeetingLink:    link,
		ConflictStatus: "free",
		ICSFileName:    fileName,
		StartAtMs:      startT.UnixMilli(),
		EndAtMs:        endT.UnixMilli(),
		Attendees:      attendees,
		RSVP:           selfRSVP,
	}, nil
}

// CheckAndUpsertCalendarConflict 检测本地已接受/暂定日程冲突并记录至 calendar_events。
func CheckAndUpsertCalendarConflict(q interface {
	QueryRow(string, ...any) *sql.Row
	Exec(string, ...any) (sql.Result, error)
}, accountID, msgID string, inv *ParsedMeetingInvite) {
	if q == nil || inv == nil || inv.UID == "" {
		return
	}
	if inv.Method == "CANCEL" {
		_, _ = q.Exec(`DELETE FROM calendar_events WHERE uid=? AND account_id=?`, inv.UID, accountID)
		inv.RSVP = "declined"
		return
	}
	var confTitle string
	var confStart, confEnd int64
	err := q.QueryRow(`
		SELECT title, start_at, end_at FROM calendar_events
		WHERE uid != ? AND rsvp_status IN ('accepted', 'tentative')
		  AND start_at < ? AND end_at > ?
		ORDER BY start_at ASC LIMIT 1
	`, inv.UID, inv.EndAtMs, inv.StartAtMs).Scan(&confTitle, &confStart, &confEnd)
	if err == nil && confTitle != "" {
		inv.ConflictStatus = "conflict"
		inv.ConflictHint = fmt.Sprintf("与「%s」(%s-%s) 时间重叠",
			confTitle, time.UnixMilli(confStart).Format("15:04"), time.UnixMilli(confEnd).Format("15:04"))
	} else {
		inv.ConflictStatus = "free"
		inv.ConflictHint = ""
	}
	_, _ = q.Exec(`
		INSERT INTO calendar_events(uid, account_id, message_id, title, start_at, end_at, rsvp_status)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(uid, account_id) DO UPDATE SET
			message_id=CASE WHEN excluded.message_id != '' THEN excluded.message_id ELSE calendar_events.message_id END,
			title=excluded.title, start_at=excluded.start_at, end_at=excluded.end_at
	`, inv.UID, accountID, msgID, inv.Title, inv.StartAtMs, inv.EndAtMs, inv.RSVP)
}
