package ai

import (
	"regexp"
	"strings"
	"unicode/utf8"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
	"omnimail/internal/apperr"
	"omnimail/internal/config"
)

var hiddenMailText = regexp.MustCompile(`(?i)(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b`)

func mailTranslationSegments(markup, text string) ([]string, error) {
	if len(markup) > 2*1024*1024 || len(text) > 2*1024*1024 {
		return nil, translationSizeError()
	}
	seen := make(map[string]bool)
	var segments []string
	add := func(raw string) {
		value := strings.TrimSpace(raw)
		if !seen[value] && canTranslateText(value) {
			seen[value] = true
			segments = append(segments, value)
		}
	}
	if markup == "" {
		for _, para := range strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n") {
			add(para)
		}
		return segments, nil
	}
	nodes, err := html.ParseFragment(strings.NewReader(markup), &html.Node{Type: html.ElementNode, Data: "div", DataAtom: atom.Div})
	if err != nil {
		return nil, apperr.New(apperr.CodeInvalidInput, "无法读取邮件正文排版")
	}
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node.Type == html.TextNode {
			add(node.Data)
			return
		}
		switch node.Data {
		case "script", "style", "pre", "code", "textarea", "template", "svg", "math", "title", "noscript":
			return
		}
		for _, attr := range node.Attr {
			if attr.Key == "hidden" || (attr.Key == "style" && hiddenMailText.MatchString(attr.Val)) {
				return
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	for _, node := range nodes {
		walk(node)
	}
	return segments, nil
}

func translationSizeError() error {
	return apperr.New(apperr.CodeInvalidInput, "邮件正文超过单次翻译上限，原文保留不变")
}

func batchTranslationSegments(segments []string) ([][]string, error) {
	return batchTranslationSegmentsForProvider(segments, config.TranslationProviderAI)
}

func batchTranslationSegmentsForProvider(segments []string, provider string) ([][]string, error) {
	if len(segments) > 400 {
		return nil, translationSizeError()
	}
	const batchLimit = 4800
	maxSegments, preferredSize := 45, batchLimit
	if provider == config.TranslationProviderFree {
		maxSegments, preferredSize = 12, 1600
	}
	var batches [][]string
	var batch []string
	total, size := 0, 0
	for _, segment := range segments {
		length := utf8.RuneCountInString(segment)
		total += length
		if total > 40000 || length > batchLimit {
			return nil, translationSizeError()
		}
		if len(batch) > 0 && (len(batch) >= maxSegments || size+length > preferredSize) {
			batches = append(batches, batch)
			batch, size = nil, 0
		}
		batch, size = append(batch, segment), size+length
	}
	if len(batch) > 0 {
		batches = append(batches, batch)
	}
	return batches, nil
}
