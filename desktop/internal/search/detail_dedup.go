package search

import "strings"

type rawThreadMsgRow struct {
	id         string
	folder     string
	rfcMsgID   string
	rawBlobSHA string
	senderName string
	senderMail string
	toJSON     string
	ccJSON     string
	sentAt     int64
	receivedAt int64
	bodyText   string
	bodyHTML   string
	allowInt   int
	securityJ  string
}

func threadMessageDedupKey(r rawThreadMsgRow) string {
	rfc := strings.ToLower(strings.Trim(strings.TrimSpace(r.rfcMsgID), "<>"))
	if rfc != "" {
		return "rfc:" + rfc
	}
	sha := strings.ToLower(strings.TrimSpace(r.rawBlobSHA))
	if sha != "" {
		return "sha:" + sha
	}
	return "id:" + r.id
}

func dedupThreadMessageRows(rows []rawThreadMsgRow, currentMsgID string) []rawThreadMsgRow {
	if len(rows) <= 1 {
		return rows
	}
	out := make([]rawThreadMsgRow, 0, len(rows))
	seenIdx := make(map[string]int, len(rows))

	for _, r := range rows {
		key := threadMessageDedupKey(r)
		prevPos, exists := seenIdx[key]
		if !exists {
			seenIdx[key] = len(out)
			out = append(out, r)
			continue
		}
		if shouldPreferThreadRow(out[prevPos], r, currentMsgID) {
			out[prevPos] = r
		}
	}
	return out
}

func shouldPreferThreadRow(existing, candidate rawThreadMsgRow, currentMsgID string) bool {
	existIsCur := existing.id == currentMsgID
	candIsCur := candidate.id == currentMsgID
	if existIsCur != candIsCur {
		return candIsCur
	}

	existRank := folderPriorityRank(existing.folder)
	candRank := folderPriorityRank(candidate.folder)
	if existRank != candRank {
		return candRank > existRank
	}

	existScore := rowCompletenessScore(existing)
	candScore := rowCompletenessScore(candidate)
	if existScore != candScore {
		return candScore > existScore
	}
	return false
}

func folderPriorityRank(folder string) int {
	switch strings.ToLower(strings.TrimSpace(folder)) {
	case "archive":
		return 1
	case "trash", "spam":
		return 0
	default:
		// inbox / sent / drafts / 自定义文件夹优先于 archive
		return 2
	}
}

func rowCompletenessScore(r rawThreadMsgRow) int {
	score := 0
	if strings.TrimSpace(r.bodyHTML) != "" {
		score += 4
	}
	if strings.TrimSpace(r.bodyText) != "" {
		score += 2
	}
	if strings.TrimSpace(r.rawBlobSHA) != "" {
		score += 1
	}
	return score
}
