package musemail

import "sync"

var (
	iconBytesMu sync.RWMutex
	embeddedICO []byte
)

// SetEmbeddedAppIconICO 注入应用内嵌 Windows .ico 原始字节，供无 .syso 开发构建时为独立登录窗生成原生 HICON。
func SetEmbeddedAppIconICO(ico []byte) {
	iconBytesMu.Lock()
	defer iconBytesMu.Unlock()
	if len(ico) == 0 {
		embeddedICO = nil
		return
	}
	embeddedICO = append([]byte(nil), ico...)
}

func getEmbeddedAppIconICO() []byte {
	iconBytesMu.RLock()
	defer iconBytesMu.RUnlock()
	return embeddedICO
}
