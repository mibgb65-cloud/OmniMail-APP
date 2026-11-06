package domain

import "testing"

func TestRequirementEvidenceAndCandidateBoundary(t *testing.T) {
	input := RequirementInput{Source: TranslatedText{Body: "Alice needs it Friday."}, Candidates: []RequirementCandidate{{ID: "todo_1", Title: "existing", Evidence: "old"}}}
	valid := Requirement{Title: "synthetic", Evidence: "Alice needs it Friday.", Owner: "Alice", Due: "Friday", Kind: "update", RelatedID: "todo_1"}
	if (RequirementOutput{Items: []Requirement{valid}}).Validate(input) != nil {
		t.Fatal("有效引用不应失败")
	}
	for _, change := range []func(*Requirement){
		func(r *Requirement) { r.Evidence = "not in source" },
		func(r *Requirement) { r.RelatedID = "other_todo" },
		func(r *Requirement) { r.Due = "next Monday" },
		func(r *Requirement) { r.Kind = "execute" },
	} {
		r := valid
		change(&r)
		if (RequirementOutput{Items: []Requirement{r}}).Validate(input) == nil {
			t.Fatal("越界结果未拒绝")
		}
	}
}
