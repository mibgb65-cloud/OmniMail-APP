package mailproto

import (
	"errors"
	"fmt"

	"github.com/emersion/go-sasl"
)

type xoauth2Client struct {
	user  string
	token string
	done  bool
}

// NewXOAuth2Client 构造 Gmail 与 Outlook Office365 IMAP/SMTP 通用的 XOAUTH2 认证器。
func NewXOAuth2Client(username, accessToken string) sasl.Client {
	return &xoauth2Client{user: username, token: accessToken}
}

func (c *xoauth2Client) Start() (string, []byte, error) {
	ir := fmt.Sprintf("user=%s\x01auth=Bearer %s\x01\x01", c.user, c.token)
	return "XOAUTH2", []byte(ir), nil
}

func (c *xoauth2Client) Next(_ []byte) ([]byte, error) {
	if !c.done {
		c.done = true
		// 收到服务端 JSON 错误挑战时回复空响应以获取标准 NO/535 错误文本
		return []byte{}, nil
	}
	return nil, errors.New("sasl: unexpected server challenge")
}
