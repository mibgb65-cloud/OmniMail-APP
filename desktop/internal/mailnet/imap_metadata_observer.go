package mailnet

import (
	"bytes"
	"net"
	"regexp"
	"strconv"
	"strings"
	"sync"
)

var validityResponse = regexp.MustCompile(`(?i)^\* OK \[UIDVALIDITY ([0-9]+)\](?: |$)`)
var literalSuffix = regexp.MustCompile(`\{([0-9]+)\+?\}$`)

type validityObservation struct {
	present, invalid bool
	value            uint32
}

// 上游把“未返回”和“明确返回 0”都解码为零。只在选择命令期间观察有界响应行，
// 不输出原文；跳过 literal，避免邮件正文或带换行的文件夹名称伪造身份响应。
type metadataObserver struct {
	net.Conn
	mu        sync.Mutex
	active    bool
	line      []byte
	remaining uint64
	result    validityObservation
}

func (c *metadataObserver) begin() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.active, c.line, c.remaining, c.result = true, nil, 0, validityObservation{}
}

func (c *metadataObserver) end() validityObservation {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.active, c.line = false, nil
	return c.result
}

func (c *metadataObserver) Read(buffer []byte) (int, error) {
	n, err := c.Conn.Read(buffer)
	c.observe(buffer[:n])
	return n, err
}

func (c *metadataObserver) observe(data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for c.active && !c.result.invalid && len(data) > 0 {
		if c.remaining > 0 {
			n := min(uint64(len(data)), c.remaining)
			c.remaining -= n
			data = data[n:]
			continue
		}
		end := bytes.IndexByte(data, '\n')
		size := len(data)
		if end >= 0 {
			size = end + 1
		}
		if len(c.line)+size > 4096 {
			// 无法可靠确定帧边界时拒绝零值兼容，而不是在截断内容中寻找字符串。
			c.result.invalid = true
			return
		}
		c.line = append(c.line, data[:size]...)
		data = data[size:]
		if end < 0 {
			continue
		}
		if !bytes.HasSuffix(c.line, []byte("\r\n")) {
			c.result.invalid = true
			return
		}
		line := string(c.line[:len(c.line)-2])
		c.line = nil
		if match := validityResponse.FindStringSubmatch(line); match != nil {
			value, err := strconv.ParseUint(match[1], 10, 32)
			if err != nil || (c.result.present && c.result.value != uint32(value)) {
				c.result.invalid = true
				return
			}
			c.result.present, c.result.value = true, uint32(value)
		}
		fields := strings.Fields(line)
		if len(fields) > 1 {
			switch strings.ToUpper(fields[1]) {
			case "OK", "NO", "BAD", "BYE", "PREAUTH":
				continue // 状态文本中的 {数字} 不是 literal。
			}
		}
		if match := literalSuffix.FindStringSubmatchIndex(line); match != nil && !insideQuoted(line[:match[0]]) {
			size, err := strconv.ParseUint(line[match[2]:match[3]], 10, 64)
			if err != nil {
				c.result.invalid = true
				return
			}
			c.remaining = size
		}
	}
}

func insideQuoted(text string) bool {
	quoted, escaped := false, false
	for _, char := range text {
		if escaped {
			escaped = false
		} else if quoted && char == '\\' {
			escaped = true
		} else if char == '"' {
			quoted = !quoted
		}
	}
	return quoted
}
