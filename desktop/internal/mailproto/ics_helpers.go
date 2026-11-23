package mailproto

import (
	"fmt"
	"strings"
	"time"

	"github.com/emersion/go-ical"
)

func propText(props ical.Props, name string) string {
	p := props.Get(name)
	if p == nil {
		return ""
	}
	t, err := p.Text()
	if err != nil {
		return strings.TrimSpace(p.Value)
	}
	return strings.TrimSpace(t)
}

func parseICSTimeFallback(raw string) time.Time {
	s := strings.TrimSpace(raw)
	for _, layout := range []string{"20060102T150405Z", "20060102T150405", "20060102"} {
		loc := time.Local
		if strings.HasSuffix(layout, "Z") {
			loc = time.UTC
		}
		if t, err := time.ParseInLocation(layout, s, loc); err == nil {
			return t
		}
	}
	return time.Now()
}

func extractMeetingURL(text string) string {
	matches := reMeetingURL.FindAllString(text, -1)
	for _, m := range matches {
		low := strings.ToLower(m)
		if strings.Contains(low, "zoom.us") || strings.Contains(low, "teams.microsoft") ||
			strings.Contains(low, "meet.google") || strings.Contains(low, "meeting.tencent") ||
			strings.Contains(low, "feishu.cn") || strings.Contains(low, "larksuite.com") {
			return m
		}
	}
	if len(matches) > 0 {
		return matches[0]
	}
	return ""
}

func parseAttendeesAndOrganizer(ev ical.Event, selfEmail string) (string, []CalendarAttendee, string) {
	var attendees []CalendarAttendee
	var orgEmail string
	selfRSVP := "pending"
	cleanMailto := func(v string) string {
		return strings.ToLower(strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(v, "mailto:"), "MAILTO:")))
	}

	if org := ev.Props.Get(ical.PropOrganizer); org != nil {
		orgEmail = cleanMailto(org.Value)
		cn := org.Params.Get(ical.ParamCommonName)
		if cn == "" {
			cn = orgEmail
		}
		attendees = append(attendees, CalendarAttendee{
			Name: cn, Email: orgEmail, Role: "发起人", Status: "organizer",
		})
	}

	for _, p := range ev.Props.Values(ical.PropAttendee) {
		addr := cleanMailto(p.Value)
		cn := p.Params.Get(ical.ParamCommonName)
		if cn == "" {
			cn = addr
		}
		partStat := strings.ToUpper(p.Params.Get(ical.ParamParticipationStatus))
		st := "pending"
		switch partStat {
		case "ACCEPTED":
			st = "accepted"
		case "TENTATIVE":
			st = "tentative"
		case "DECLINED":
			st = "declined"
		}
		if selfEmail != "" && strings.EqualFold(addr, selfEmail) {
			selfRSVP = st
		}
		attendees = append(attendees, CalendarAttendee{
			Name: cn, Email: addr, Role: "参会人", Status: st,
		})
	}
	return orgEmail, attendees, selfRSVP
}

// BuildICSReplyPayload 构造标准 RFC5545 METHOD:REPLY iCalendar 响应体。
func BuildICSReplyPayload(inv ParsedMeetingInvite, attendeeName, attendeeEmail, rsvp string) string {
	partStat := "ACCEPTED"
	switch strings.ToLower(strings.TrimSpace(rsvp)) {
	case "tentative":
		partStat = "TENTATIVE"
	case "declined":
		partStat = "DECLINED"
	}
	seq := inv.Sequence
	if seq == "" {
		seq = "0"
	}
	uid := inv.UID
	if uid == "" {
		uid = fmt.Sprintf("omnimail-evt-%d", time.Now().UnixMilli())
	}
	dtStamp := time.Now().UTC().Format("20060102T150405Z")
	dtStart := time.UnixMilli(inv.StartAtMs).UTC().Format("20060102T150405Z")
	dtEnd := time.UnixMilli(inv.EndAtMs).UTC().Format("20060102T150405Z")
	cn := strings.TrimSpace(attendeeName)
	if cn == "" {
		cn = attendeeEmail
	}

	var b strings.Builder
	b.WriteString("BEGIN:VCALENDAR\r\n")
	b.WriteString("PRODID:-//OmniMail Desktop//Calendar 1.0//CN\r\n")
	b.WriteString("VERSION:2.0\r\n")
	b.WriteString("METHOD:REPLY\r\n")
	b.WriteString("BEGIN:VEVENT\r\n")
	b.WriteString(fmt.Sprintf("UID:%s\r\n", uid))
	b.WriteString(fmt.Sprintf("SEQUENCE:%s\r\n", seq))
	b.WriteString(fmt.Sprintf("DTSTAMP:%s\r\n", dtStamp))
	b.WriteString(fmt.Sprintf("DTSTART:%s\r\n", dtStart))
	b.WriteString(fmt.Sprintf("DTEND:%s\r\n", dtEnd))
	b.WriteString(fmt.Sprintf("SUMMARY:%s\r\n", inv.Title))
	if inv.OrganizerEmail != "" {
		b.WriteString(fmt.Sprintf("ORGANIZER:mailto:%s\r\n", inv.OrganizerEmail))
	}
	b.WriteString(fmt.Sprintf("ATTENDEE;CN=%s;PARTSTAT=%s:mailto:%s\r\n", cn, partStat, strings.ToLower(attendeeEmail)))
	b.WriteString("END:VEVENT\r\n")
	b.WriteString("END:VCALENDAR\r\n")
	return b.String()
}
