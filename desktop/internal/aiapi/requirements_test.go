package aiapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestRequirementHTTPContractAndNoInventedLink(t *testing.T) {
	for _, related := range []string{"todo_1", "invented"} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var body struct {
				Messages []map[string]string `json:"messages"`
			}
			if json.NewDecoder(r.Body).Decode(&body) != nil || len(body.Messages) != 2 || !strings.Contains(body.Messages[1]["content"], "candidates") {
				t.Error("需求与候选契约缺失")
			}
			output := domain.RequirementOutput{Items: []domain.Requirement{{Title: "need", Evidence: "Alice Friday", Owner: "Alice", Due: "Friday", RelatedID: related, Kind: "update"}}}
			content, err := json.Marshal(output)
			if err != nil {
				t.Error(err)
				return
			}
			json.NewEncoder(w).Encode(map[string]interface{}{"choices": []interface{}{map[string]interface{}{"finish_reason": "stop", "message": map[string]string{"content": string(content)}}}})
		}))
		client := &Client{http: server.Client()}
		_, err := client.Extract(t.Context(), domain.AIConfig{Endpoint: server.URL, Model: "test", Language: "zh"}, nil,
			domain.RequirementInput{Source: domain.TranslatedText{Body: "Alice Friday"}, Candidates: []domain.RequirementCandidate{{ID: "todo_1", Title: "old", Evidence: "original"}}})
		server.Close()
		if (err == nil) != (related == "todo_1") {
			t.Fatal("非法关联未拒绝", err)
		}
	}
}
