package search

import (
	"strings"
	"unicode/utf8"
)

type ParsedKeyword struct {
	FreeTerms     []string
	From          string
	To            string
	HasAttachment *bool
	OnlyUnread    bool
	OnlyStarred   bool
	LabelName     string
	Folder        string
}

func ParseKeywordOperators(raw string) ParsedKeyword {
	var out ParsedKeyword
	fields := strings.Fields(strings.TrimSpace(raw))
	for _, token := range fields {
		lower := strings.ToLower(token)
		switch {
		case strings.HasPrefix(lower, "from:") && len(token) > 5:
			out.From = token[5:]
		case strings.HasPrefix(lower, "to:") && len(token) > 3:
			out.To = token[3:]
		case lower == "has:attachment" || lower == "has:attachments":
			v := true
			out.HasAttachment = &v
		case lower == "is:unread":
			out.OnlyUnread = true
		case lower == "is:starred" || lower == "is:star":
			out.OnlyStarred = true
		case strings.HasPrefix(lower, "label:") && len(token) > 6:
			out.LabelName = token[6:]
		case strings.HasPrefix(lower, "in:") && len(token) > 3:
			out.Folder = strings.ToLower(token[3:])
		default:
			out.FreeTerms = append(out.FreeTerms, token)
		}
	}
	return out
}

// SplitTermsForFTS 将自由关键词按长度分为 FTS5 trigram 词组（>=3 字符）与短词 LIKE 词组（1~2 字符）。
func SplitTermsForFTS(terms []string) (ftsExpr string, shortTerms []string) {
	var ftsQuotes []string
	for _, t := range terms {
		cleaned := strings.TrimSpace(strings.ReplaceAll(t, `"`, ""))
		if cleaned == "" {
			continue
		}
		if utf8.RuneCountInString(cleaned) >= 3 {
			ftsQuotes = append(ftsQuotes, `"`+cleaned+`"`)
		} else {
			shortTerms = append(shortTerms, cleaned)
		}
	}
	return strings.Join(ftsQuotes, " AND "), shortTerms
}
