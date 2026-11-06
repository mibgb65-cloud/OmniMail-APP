package translationapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"omnimail/desktop/internal/domain"
)

func wrappedResponse(content, finish string) []byte {
	data, _ := json.Marshal(map[string]interface{}{
		"model": domain.TranslationModel,
		"choices": []interface{}{map[string]interface{}{
			"finish_reason": finish, "message": map[string]string{"content": content},
		}},
	})
	return data
}
func TestTranslationAcceptsCompleteSafeWrappers(t *testing.T) {
	inner := `{"subject":"标题","body":"正文"}`
	for _, value := range []string{
		"```json\n" + inner + "\n```",
		" \uFEFF<think>not displayed</think>\n```JSON\n" + inner + "\n``` ",
	} {
		result, err := decodeTranslation(wrappedResponse(value, "stop"), domain.TranslatedText{Subject: "Title", Body: "Body"})
		if err != nil || result.Subject != "标题" || result.Body != "正文" {
			t.Fatalf("完整包装应安全解析: %v", err)
		}
	}
}
func TestTranslationKeepsRealContentAndRejectsTruncation(t *testing.T) {
	inner := `{"subject":"标题","body":"<think>literal source text</think>"}`
	result, err := decodeTranslation(wrappedResponse(inner, "stop"), domain.TranslatedText{Subject: "Title", Body: "Body"})
	if err != nil || result.Body != "<think>literal source text</think>" {
		t.Fatal("不得剥离 JSON 值中的真实内容")
	}
	for _, value := range []string{"<think>unfinished", "```json\n" + inner, "prefix " + inner} {
		if _, err := decodeTranslation(wrappedResponse(value, "stop"), domain.TranslatedText{Subject: "s", Body: "b"}); err == nil {
			t.Fatal("不完整或混杂内容不能直接接受")
		}
	}
	if _, err := decodeTranslation(wrappedResponse(inner, "length"), domain.TranslatedText{Subject: "s", Body: "b"}); err != domain.ErrTranslationTruncated {
		t.Fatal("截断仍必须拒绝")
	}
}
func TestTranslationFallsBackOnlyForCompleteUnstructuredOutput(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		content := "unstructured translation"
		if calls == 2 {
			content = "标题"
		}
		if calls == 3 {
			content = "正文"
		}
		w.Write(wrappedResponse(content, "stop"))
	}))
	defer server.Close()
	result, err := (&Client{http: server.Client(), endpoint: server.URL}).Translate(t.Context(), domain.TranslatedText{Subject: "Title", Body: "Body"}, "zh")
	if err != nil || result.Subject != "标题" || result.Body != "正文" || calls != 3 {
		t.Fatalf("有界降级失败: %+v %v %d", result, err, calls)
	}
}
func TestTranslationDoesNotRetryRateLimitOrTruncatedOutput(t *testing.T) {
	for _, code := range []int{429, 503, 200} {
		calls := 0
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			calls++
			w.WriteHeader(code)
			w.Write(wrappedResponse("partial", "length"))
		}))
		_, err := (&Client{http: server.Client(), endpoint: server.URL}).Translate(t.Context(), domain.TranslatedText{Subject: "s", Body: "b"}, "zh")
		server.Close()
		if err == nil || calls != 1 {
			t.Fatal("错误或截断不得放大请求")
		}
	}
}
