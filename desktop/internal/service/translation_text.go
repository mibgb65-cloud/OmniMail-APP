package service

import (
	"io"
	"strings"
	"unicode/utf8"

	"golang.org/x/net/html"
	"omnimail/desktop/internal/domain"
)

func translationText(detail domain.MailDetail) (domain.TranslatedText, error) {
	if !detail.Cached || detail.BodyVersion < 1 || detail.BodyErrorCode != "" {
		return domain.TranslatedText{}, domain.ErrTranslationNotReady
	}
	body := detail.Body
	if strings.TrimSpace(body) == "" && detail.RawHTML != "" {
		if len(detail.RawHTML) > 2<<20 {
			return domain.TranslatedText{}, domain.ErrTranslationTooLarge
		}
		tokenizer := html.NewTokenizer(strings.NewReader(detail.RawHTML))
		var output strings.Builder
		skip := 0
		for count := 0; ; count++ {
			if count > 20000 || output.Len() > 32<<10 {
				return domain.TranslatedText{}, domain.ErrTranslationTooLarge
			}
			kind := tokenizer.Next()
			if kind == html.ErrorToken {
				if tokenizer.Err() != io.EOF {
					return domain.TranslatedText{}, domain.ErrTranslationInput
				}
				break
			}
			token := tokenizer.Token()
			switch kind {
			case html.StartTagToken, html.SelfClosingTagToken:
				if token.Data == "script" || token.Data == "style" || token.Data == "head" {
					skip++
				}
				if skip == 0 && (token.Data == "br" || token.Data == "p" || token.Data == "div" || token.Data == "li" || token.Data == "tr") {
					output.WriteByte('\n')
				}
			case html.EndTagToken:
				if (token.Data == "script" || token.Data == "style" || token.Data == "head") && skip > 0 {
					skip--
				}
				if skip == 0 && (token.Data == "p" || token.Data == "div" || token.Data == "li" || token.Data == "tr") {
					output.WriteByte('\n')
				}
			case html.TextToken:
				if skip == 0 {
					output.WriteString(token.Data)
				}
			}
		}
		body = output.String()
	}
	if !utf8.ValidString(body) || !utf8.ValidString(detail.Subject) {
		return domain.TranslatedText{}, domain.ErrTranslationInput
	}
	if len(body) > 32<<10 || len(detail.Subject) > 4096 {
		return domain.TranslatedText{}, domain.ErrTranslationTooLarge
	}
	if strings.TrimSpace(body) == "" && strings.TrimSpace(detail.Subject) == "" {
		return domain.TranslatedText{}, domain.ErrTranslationNotReady
	}
	return domain.TranslatedText{Subject: detail.Subject, Body: strings.TrimSpace(body)}, nil
}

func splitTranslationText(text string) []string {
	remaining := []rune(text)
	result := []string{}
	for len(remaining) > 0 {
		size := min(2000, len(remaining))
		// 优先在段落/句子边界拆分，不把多字节字符切坏，也不静默丢弃内容。
		if size < len(remaining) {
			for i := size - 1; i > size/2; i-- {
				if remaining[i] == '\n' || remaining[i] == '。' || remaining[i] == '.' {
					size = i + 1
					break
				}
			}
		}
		result = append(result, string(remaining[:size]))
		remaining = remaining[size:]
	}
	if len(result) == 0 {
		return []string{""}
	}
	return result
}
