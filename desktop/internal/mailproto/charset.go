package mailproto

import (
	"io"
	"mime"
	"strings"

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

func DecodeHeaderText(raw string) string {
	if !strings.Contains(raw, "=?") {
		return raw
	}
	dec, err := NewMIMEWordDecoder().DecodeHeader(raw)
	if err != nil {
		return raw
	}
	return dec
}
