//go:build !windows

package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"os"
)

func deriveFallbackKey(entropy []byte) []byte {
	host, _ := os.Hostname()
	user := os.Getenv("USER")
	h := sha256.New()
	h.Write([]byte("omnimail-local-vault:"))
	h.Write([]byte(host))
	h.Write([]byte(":"))
	h.Write([]byte(user))
	h.Write(entropy)
	return h.Sum(nil)
}

func protectBytes(plain []byte, entropy []byte) ([]byte, error) {
	block, err := aes.NewCipher(deriveFallbackKey(entropy))
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
	return gcm.Seal(nonce, nonce, plain, entropy), nil
}

func unprotectBytes(cipherData []byte, entropy []byte) ([]byte, error) {
	block, err := aes.NewCipher(deriveFallbackKey(entropy))
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	ns := gcm.NonceSize()
	if len(cipherData) < ns {
		return nil, errors.New("凭据密文格式损坏")
	}
	return gcm.Open(nil, cipherData[:ns], cipherData[ns:], entropy)
}
