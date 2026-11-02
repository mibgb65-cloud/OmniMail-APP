package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestAICacheClearOnlyRemovesDerivedResults(t *testing.T) {
	dir := t.TempDir()
	s := NewAIStore(dir)
	r := domain.AIResult{MailID: "mail_test", AccountID: "account_test", SourceHash: strings.Repeat("a", 64), Revision: "revision_1"}
	key := strings.Repeat("b", 64)
	if err := s.WriteAICache(t.Context(), key, r); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "ai-results", "keep.txt"), []byte("not a result"), 0o600); err != nil {
		t.Fatal(err)
	}
	temp := filepath.Join(dir, "ai-results", ".translation-"+strings.Repeat("A", 26)+".tmp")
	if err := os.WriteFile(temp, []byte("synthetic private partial result"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "omnimail.db"), []byte("synthetic"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := s.ClearAICache(t.Context()); err != nil {
		t.Fatal(err)
	}
	if _, found, err := s.ReadAICache(t.Context(), key); err != nil || found {
		t.Fatal("清理未生效")
	}
	if _, err := os.Stat(temp); !os.IsNotExist(err) {
		t.Fatal("清理后不应保留中断写入的缓存临时文件")
	}
	for _, name := range []string{"omnimail.db", "ai-results/keep.txt"} {
		if _, err := os.Stat(filepath.Join(dir, name)); err != nil {
			t.Fatal("误删非缓存", err)
		}
	}
}
