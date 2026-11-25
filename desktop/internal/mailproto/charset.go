package mailproto

import (
	"io"
	"mime"
	"strings"
	"unicode/utf8"

	"github.com/emersion/go-message"
	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/htmlindex"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/encoding/korean"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"
	"golang.org/x/text/transform"
)

func init() {
	message.CharsetReader = DecodeCharsetReader
}

// DecodeCharsetReader 统一解码 GBK/GB18030、Big5、日文、韩文(EUC-KR)、俄文(KOI8-R/1251)与西欧编码。
func DecodeCharsetReader(charsetLabel string, input io.Reader) (io.Reader, error) {
	norm := strings.ToLower(strings.TrimSpace(charsetLabel))
	switch norm {
	case "", "utf-8", "utf8", "us-ascii", "ascii":
		return input, nil
	}
	enc := lookupEncoding(norm)
	if enc == nil {
		// 未知非标声明不中断整封邮件解析，降级原样流式读取
		return input, nil
	}
	return transform.NewReader(input, enc.NewDecoder()), nil
}

func lookupEncoding(norm string) encoding.Encoding {
	switch norm {
	case "gb18030", "gbk", "gb2312", "x-gbk", "chinese", "csgb2312", "cn-gb", "ms936", "cp936":
		return simplifiedchinese.GB18030
	case "hz-gb-2312":
		return simplifiedchinese.HZGB2312
	case "big5", "big5-hkscs", "x-x-big5", "cp950":
		return traditionalchinese.Big5
	case "iso-2022-jp", "csiso2022jp":
		return japanese.ISO2022JP
	case "shift_jis", "shift-jis", "sjis", "ms_kanji", "windows-31j", "cp932":
		return japanese.ShiftJIS
	case "euc-jp":
		return japanese.EUCJP
	case "euc-kr", "ks_c_5601-1987", "ks_c_5601", "cp949", "uhc", "korean":
		return korean.EUCKR
	}
	if enc, err := htmlindex.Get(norm); err == nil {
		return enc
	}
	return nil
}

func NewMIMEWordDecoder() *mime.WordDecoder {
	return &mime.WordDecoder{CharsetReader: DecodeCharsetReader}
}

// EnsureUTF8HeaderBytes 确保邮件头字符串为合法 UTF-8；对裸非 UTF-8 字节优先按 hintCharset 解码，无提示回退 GB18030。
func EnsureUTF8HeaderBytes(raw string, hintCharset string) string {
	if raw == "" || utf8.ValidString(raw) {
		return raw
	}
	if dec, ok := tryDecodeHeaderBytes(raw, hintCharset, true); ok {
		return dec
	}
	if dec, ok := tryDecodeHeaderBytes(raw, "gb18030", true); ok {
		return dec
	}
	if dec, ok := tryDecodeHeaderBytes(raw, hintCharset, false); ok {
		return dec
	}
	if dec, ok := tryDecodeHeaderBytes(raw, "gb18030", false); ok {
		return dec
	}
	return strings.ToValidUTF8(raw, "\uFFFD")
}

func tryDecodeHeaderBytes(raw, label string, rejectReplacement bool) (string, bool) {
	norm := strings.ToLower(strings.TrimSpace(label))
	switch norm {
	case "", "utf-8", "utf8", "us-ascii", "ascii":
		return "", false
	}
	enc := lookupEncoding(norm)
	if enc == nil {
		return "", false
	}
	dec, err := enc.NewDecoder().String(raw)
	if err != nil || !utf8.ValidString(dec) {
		return "", false
	}
	if rejectReplacement && strings.ContainsRune(dec, '\uFFFD') {
		return "", false
	}
	return dec, true
}

func DecodeHeaderTextWithHint(raw string, hintCharset string) string {
	if raw == "" {
		return ""
	}
	s := raw
	if !utf8.ValidString(s) {
		s = EnsureUTF8HeaderBytes(s, hintCharset)
	}
	if strings.Contains(s, "=?") {
		if dec, err := NewMIMEWordDecoder().DecodeHeader(s); err == nil {
			s = dec
		}
	}
	return EnsureUTF8HeaderBytes(s, hintCharset)
}

func DecodeHeaderText(raw string) string {
	return DecodeHeaderTextWithHint(raw, "")
}
