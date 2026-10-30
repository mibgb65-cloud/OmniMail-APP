package mailnet

import (
	"context"
	"crypto/tls"
	"errors"
	"io"
	"net"

	"omnimail/desktop/internal/domain"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"
)

type protocolFailure struct {
	reason string
}

func (e *protocolFailure) Error() string          { return domain.ErrProtocol.Error() }
func (e *protocolFailure) Unwrap() error          { return domain.ErrProtocol }
func (e *protocolFailure) DiagnosticCode() string { return e.reason }

// IMAP 解码器会在部分路径用文本包装 I/O 错误，不能靠匹配服务器/错误原文判断网络故障。
func (s *session) commandError(err error) error {
	if err == nil {
		return nil
	}
	if s.ctx != nil && s.ctx.Err() != nil {
		return s.ctx.Err()
	}
	if errors.Is(err, domain.ErrTooLarge) {
		return domain.ErrTooLarge
	}
	var response *imap.Error
	if errors.As(err, &response) {
		if response.Code == imap.ResponseCodeAuthenticationFailed {
			return domain.ErrAuthentication
		}
		if response.Type == imap.StatusResponseTypeBye || response.Code == imap.ResponseCodeUnavailable {
			return domain.ErrNetwork
		}
		// 服务器明确拒绝命令时，即使随后断线也不能覆盖这个真实响应。
		if response.Type == imap.StatusResponseTypeNo {
			return &protocolFailure{reason: "command_no"}
		}
		return &protocolFailure{reason: "command_bad"}
	}
	cause := err
	if failure := connectionReadError(s.conn); failure != nil {
		cause = failure
	}
	classified := classifyIMAPFailure(cause)
	if errors.Is(classified, domain.ErrProtocol) {
		return &protocolFailure{reason: "response_parse"}
	}
	return classified
}

func connectionReadError(conn net.Conn) error {
	conn = wireConnection(conn)
	if limited, ok := conn.(*limitedConn); ok {
		return limited.failure()
	}
	return nil
}

func wireConnection(conn net.Conn) net.Conn {
	if secure, ok := conn.(*tls.Conn); ok {
		return secure.NetConn()
	}
	return conn
}

func classifyIMAPFailure(err error) error {
	if err == nil {
		return nil
	}
	switch {
	case errors.Is(err, context.Canceled):
		return context.Canceled
	case errors.Is(err, context.DeadlineExceeded):
		return context.DeadlineExceeded
	case errors.Is(err, domain.ErrTooLarge):
		return domain.ErrTooLarge
	case errors.Is(err, io.EOF), errors.Is(err, io.ErrUnexpectedEOF),
		errors.Is(err, io.ErrClosedPipe), errors.Is(err, net.ErrClosed):
		return domain.ErrNetwork
	}
	var network net.Error
	if errors.As(err, &network) {
		if network.Timeout() {
			return context.DeadlineExceeded
		}
		return domain.ErrNetwork
	}
	return domain.ErrProtocol
}

// TLS close_notify 可能不表现为底层 TCP Read 错误；只把未满声明长度的正文 EOF 当作传输截断。
type literalFailureReader struct {
	source    io.Reader
	remaining int64
	failure   error
}

func (r *literalFailureReader) Read(buffer []byte) (int, error) {
	n, err := r.source.Read(buffer)
	r.remaining -= int64(n)
	if r.failure == nil && err != nil && (!errors.Is(err, io.EOF) || r.remaining > 0) {
		r.failure = err
	}
	return n, err
}

func (s *session) decodeLiteral(literal imap.LiteralReader, sink domain.AttachmentSink) (domain.DecodedMail, error) {
	if literal.Size() < 0 {
		return domain.DecodedMail{}, domain.ErrProtocol
	}
	if literal.Size() > maxRawBytes {
		return domain.DecodedMail{}, domain.ErrTooLarge
	}
	reader := &literalFailureReader{source: literal, remaining: literal.Size()}
	result, err := decodeReader(reader, literal.Size(), sink)
	if err == nil {
		// MIME 可在 epilogue 前结束，也可能把短流 EOF 当作正常结束；整段 literal 长度仍须校验。
		_, err = io.Copy(io.Discard, reader)
		if reader.remaining != 0 {
			err = io.ErrUnexpectedEOF
		}
	}
	readError := reader.failure
	if readError != nil && reader.remaining > 0 {
		readError = io.ErrUnexpectedEOF
	}
	return result, s.bodyError(err, readError)
}

func (s *session) bodyError(err, readError error) error {
	if s.ctx != nil && s.ctx.Err() != nil {
		return s.ctx.Err()
	}
	if errors.Is(err, domain.ErrTooLarge) {
		return domain.ErrTooLarge
	}
	if readError != nil {
		return s.commandError(readError)
	}
	if errors.Is(err, domain.ErrProtocol) {
		return s.commandError(err)
	}
	// 附件缓存 sink 的存储等错误不能被重新归为 MIME 格式错误。
	return err
}

func (s *session) abortFetch(command *imapclient.FetchCommand) {
	if s.conn != nil {
		releaseConnection(wireConnection(s.conn))
	}
	// 解码器会等 literal 被消费才退出。先断开网络，再用 Next 丢弃当前及后续缓冲响应，
	// 释放所有 literal/属性通道；直接 Close 等解码器会与未消费的 literal 相互等待。
	for command.Next() != nil {
	}
	closeIMAP(s.client)
}
