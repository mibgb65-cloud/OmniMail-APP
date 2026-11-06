package translationapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"unicode/utf8"

	"omnimail/desktop/internal/domain"
)

var errStructuredFormat = errors.New("translation structured format mismatch")

func decodeEnvelope(body []byte) (string, error) {
	var result struct {
		Model   string `json:"model"`
		Choices []struct {
			Finish  string `json:"finish_reason"`
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(body, &result) != nil || len(result.Choices) != 1 || result.Model != domain.TranslationModel {
		return "", domain.ErrTranslationResponse
	}
	if result.Choices[0].Finish == "length" {
		return "", domain.ErrTranslationTruncated
	}
	if result.Choices[0].Finish != "stop" {
		return "", domain.ErrTranslationResponse
	}
	content := result.Choices[0].Message.Content
	if !utf8.ValidString(content) || strings.TrimSpace(content) == "" {
		return "", domain.ErrTranslationResponse
	}
	return content, nil
}
func stripLeadingThought(text string) (string, error) {
	text = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(text), "\uFEFF"))
	if strings.HasPrefix(text, "<think>") {
		end := strings.Index(text, "</think>")
		if end < 0 {
			return "", domain.ErrTranslationResponse
		}
		text = strings.TrimSpace(text[end+len("</think>"):])
	}
	if text == "" {
		return "", domain.ErrTranslationResponse
	}
	return text, nil
}
func normalizeStructured(text string) (string, error) {
	value, err := stripLeadingThought(text)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(value, "```") {
		first := strings.IndexByte(value, '\n')
		last := strings.LastIndexByte(value, '\n')
		if first < 0 || last <= first || strings.TrimSpace(value[last+1:]) != "```" {
			return "", domain.ErrTranslationResponse
		}
		language := strings.ToLower(strings.TrimSpace(value[3:first]))
		if language != "" && language != "json" {
			return "", domain.ErrTranslationResponse
		}
		value = strings.TrimSpace(value[first+1 : last])
	}
	return value, nil
}
func decodeStructured(content string, source domain.TranslatedText) (domain.TranslatedText, error) {
	var output domain.TranslatedText
	decoder := json.NewDecoder(strings.NewReader(content))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&output) != nil || decoder.Decode(new(json.RawMessage)) != io.EOF {
		return output, errStructuredFormat
	}
	if !utf8.ValidString(output.Subject) || !utf8.ValidString(output.Body) || len(output.Subject) > 16<<10 || len(output.Body) > 128<<10 ||
		(strings.TrimSpace(source.Subject) != "" && strings.TrimSpace(output.Subject) == "") ||
		(strings.TrimSpace(source.Body) != "" && strings.TrimSpace(output.Body) == "") ||
		(source.Subject == "" && output.Subject != "") || (source.Body == "" && output.Body != "") {
		return domain.TranslatedText{}, domain.ErrTranslationResponse
	}
	return output, nil
}
func decodeTranslation(body []byte, source domain.TranslatedText) (domain.TranslatedText, error) {
	content, err := decodeEnvelope(body)
	if err != nil {
		return domain.TranslatedText{}, err
	}
	content, err = normalizeStructured(content)
	if err != nil {
		return domain.TranslatedText{}, err
	}
	value, err := decodeStructured(content, source)
	if err != nil {
		return domain.TranslatedText{}, domain.ErrTranslationResponse
	}
	return value, nil
}
func (c *Client) translatePlainFields(ctx context.Context, source domain.TranslatedText, target string) (domain.TranslatedText, error) {
	result := domain.TranslatedText{}
	for index, text := range []string{source.Subject, source.Body} {
		if strings.TrimSpace(text) == "" {
			continue
		}
		prompt := "请将以下文本翻译为" + domain.TranslationLanguage(target) + "，直接输出翻译结果，不要进行任何解释。\n\n" + text
		data, err := json.Marshal(map[string]interface{}{
			"model": domain.TranslationModel, "messages": []map[string]string{{"role": "user", "content": prompt}},
			"temperature": 0, "max_tokens": 4096, "stream": false, "chat_template_kwargs": map[string]bool{"enable_thinking": false},
		})
		if err != nil {
			return domain.TranslatedText{}, domain.ErrTranslationInput
		}
		content, err := c.complete(ctx, data)
		if err != nil {
			return domain.TranslatedText{}, err
		}
		content, err = stripLeadingThought(content)
		if err != nil {
			return domain.TranslatedText{}, err
		}
		maximum := 128 << 10
		if index == 0 {
			maximum = 16 << 10
		}
		if len(content) > maximum {
			return domain.TranslatedText{}, domain.ErrTranslationResponse
		}
		if index == 0 {
			result.Subject = content
		} else {
			result.Body = content
		}
	}
	return result, nil
}
