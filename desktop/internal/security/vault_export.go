package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"strings"

	"golang.org/x/crypto/argon2"

	"omnimail/internal/apperr"
)

const exportVaultHeader = "OMVX"

// ExportEncrypted 使用一次性导出密码（Argon2id + AES-256-GCM）重加密凭据盒，绝不输出明文。
func (v *Vault) ExportEncrypted(passphrase string) ([]byte, error) {
	pw := strings.TrimSpace(passphrase)
	if len(pw) < 6 {
		return nil, apperr.New(apperr.CodeInvalidInput, "含凭据导出必须设置至少 6 位导出密码")
	}
	v.mu.RLock()
	plain, err := json.Marshal(VaultPayload{Version: 1, Entries: v.entries})
	v.mu.RUnlock()
	if err != nil {
		return nil, err
	}
	defer func() {
		for i := range plain {
			plain[i] = 0
		}
	}()

	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	key := argon2.IDKey([]byte(pw), salt, argonIterations, argonMemoryKB, argonThreads, 32)
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	sealed := gcm.Seal(nil, nonce, plain, []byte(exportVaultHeader))
	out := make([]byte, 0, 4+len(salt)+len(nonce)+len(sealed))
	out = append(out, []byte(exportVaultHeader)...)
	out = append(out, salt...)
	out = append(out, nonce...)
	out = append(out, sealed...)
	return out, nil
}
