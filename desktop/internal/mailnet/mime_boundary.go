package mailnet

import (
	"io"
	"mime/multipart"
)

type mimeBoundaryReader struct {
	source   io.Reader
	suffix   []byte
	ended    bool
	appended bool
}

func (r *mimeBoundaryReader) Read(p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	if !r.ended {
		n, err := r.source.Read(p)
		if err != io.EOF {
			return n, err
		}
		r.ended = true
		// 延后 EOF，允许顶层头解析结束后才设置已验证的 MIME 边界。
		if n > 0 {
			return n, nil
		}
	}
	if len(r.suffix) > 0 {
		n := copy(p, r.suffix)
		r.suffix = r.suffix[n:]
		r.appended = true
		return n, nil
	}
	return 0, io.EOF
}

func (r *mimeBoundaryReader) setBoundary(boundary string) error {
	// 只借标准库验证长度/字符，不写附件或正文文件，不允许边界注入新的头字段。
	validator := multipart.NewWriter(io.Discard)
	if err := validator.SetBoundary(boundary); err != nil {
		return mimeDecodeFailure("mime_part_invalid", err)
	}
	r.suffix = []byte("\r\n--" + boundary + "--\r\n")
	return nil
}
