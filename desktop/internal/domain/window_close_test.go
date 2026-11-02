package domain

import "testing"

func TestValidCloseMode(t *testing.T) {
	for _, mode := range []string{"ask", "quit", "background"} {
		if !ValidCloseMode(mode) {
			t.Fatalf("合法模式未接受: %s", mode)
		}
	}
	for _, mode := range []string{"", "exit", "QUIT", "../background", "quit\n"} {
		if ValidCloseMode(mode) {
			t.Fatal("接受非法模式")
		}
	}
}
