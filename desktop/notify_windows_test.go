//go:build windows

package main

import (
	"encoding/xml"
	"strings"
	"testing"
)

func TestWindowsToastXMLKeepsMailMetadataAsText(t *testing.T) {
	const title = "发件人 & '名字'"
	const subtitle = `账号 · <text>& "主题"</text>`
	payload, err := windowsToastXML(title, subtitle)
	if err != nil {
		t.Fatal(err)
	}
	var doc windowsToastDocument
	if err := xml.Unmarshal(payload, &doc); err != nil {
		t.Fatal(err)
	}
	text := doc.Binding.Text
	if doc.Binding.Template != "ToastGeneric" || len(text) != 2 || text[0] != title || text[1] != subtitle {
		t.Fatalf("通知中的文本未按字面量还原：%+v", doc.Binding)
	}
}

func TestLimitToastTextPreservesUnicode(t *testing.T) {
	if got := limitToastText("  苹果🍏邮箱  ", 3); got != "苹果🍏…" {
		t.Fatalf("Unicode 截断结果不符：%q", got)
	}
	if got := limitToastText("  邮件  ", 2); got != "邮件" {
		t.Fatalf("长度在边界内不应添加省略号：%q", got)
	}
}

func TestWindowsToastExitCodesProvideActionableFeedback(t *testing.T) {
	cases := map[int]string{10: "设置 → 系统 → 通知", 11: "设备管理策略", 1: "未接受", -1: "未接受"}
	for code, want := range cases {
		if got := windowsToastExitError(code); !strings.Contains(got.Error(), want) {
			t.Errorf("退出码 %d 未返回预期提示：%v", code, got)
		}
	}
}
