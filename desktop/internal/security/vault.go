package security

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	vaultMagic      = "OMVT"
	vaultVersion    = uint16(1)
	vaultEntropyLen = 16
	vaultHeaderLen  = 4 + 2 + vaultEntropyLen
)

type SecretEnvelope struct {
	Value     string `json:"value"`
	UpdatedAt int64  `json:"updatedAt"`
}

type VaultPayload struct {
	Version int                       `json:"version"`
	Entries map[string]SecretEnvelope `json:"entries"`
}

// Vault 管理单个本地空间的 secrets.vault（DPAPI 加密 + Profile ID 熵绑定 + 原子落盘）。
type Vault struct {
	mu        sync.RWMutex
	profileID string
	filePath  string
	entries   map[string]SecretEnvelope
}

func OpenVault(profileID, profileDir string) (*Vault, error) {
	if err := os.MkdirAll(profileDir, 0o700); err != nil {
		return nil, err
	}
	v := &Vault{
		profileID: profileID,
		filePath:  filepath.Join(profileDir, "secrets.vault"),
		entries:   make(map[string]SecretEnvelope),
	}
	if err := v.loadFromDisk(); err != nil {
		return nil, err
	}
	return v, nil
}

func bindProfileEntropy(rawEntropy []byte, profileID string) []byte {
	h := sha256.New()
	h.Write(rawEntropy)
	h.Write([]byte("|profile:"))
	h.Write([]byte(profileID))
	return h.Sum(nil)
}

func (v *Vault) loadFromDisk() error {
	raw, err := os.ReadFile(v.filePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	if len(raw) < vaultHeaderLen || string(raw[:4]) != vaultMagic {
		return errors.New("凭据盒文件头校验失败")
	}
	ver := binary.BigEndian.Uint16(raw[4:6])
	if ver != vaultVersion {
		return errors.New("不支持的凭据盒版本")
	}
	fileEntropy := raw[6:vaultHeaderLen]
	cipherData := raw[vaultHeaderLen:]
	plain, err := unprotectBytes(cipherData, bindProfileEntropy(fileEntropy, v.profileID))
	if err != nil {
		return errors.New("解密本地凭据盒失败，可能属于其他系统账户或已损坏")
	}
	defer func() {
		for i := range plain {
			plain[i] = 0
		}
	}()
	var payload VaultPayload
	if err := json.Unmarshal(plain, &payload); err != nil {
		return errors.New("凭据盒内容解析失败")
	}
	if payload.Entries != nil {
		v.entries = payload.Entries
	}
	return nil
}

func (v *Vault) flushUnlocked() error {
	payload := VaultPayload{Version: 1, Entries: v.entries}
	plain, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	defer func() {
		for i := range plain {
			plain[i] = 0
		}
	}()
	fileEntropy := make([]byte, vaultEntropyLen)
	if _, err := rand.Read(fileEntropy); err != nil {
		return err
	}
	cipherData, err := protectBytes(plain, bindProfileEntropy(fileEntropy, v.profileID))
	if err != nil {
		return err
	}
	var buf bytes.Buffer
	buf.WriteString(vaultMagic)
	var verBuf [2]byte
	binary.BigEndian.PutUint16(verBuf[:], vaultVersion)
	buf.Write(verBuf[:])
	buf.Write(fileEntropy)
	buf.Write(cipherData)

	tmpPath := v.filePath + ".tmp"
	f, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	if _, err := f.Write(buf.Bytes()); err != nil {
		_ = f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		_ = f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Rename(tmpPath, v.filePath)
}

func (v *Vault) Set(key, value string) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.entries[key] = SecretEnvelope{Value: value, UpdatedAt: time.Now().UnixMilli()}
	return v.flushUnlocked()
}

func (v *Vault) Get(key string) (string, bool) {
	v.mu.RLock()
	defer v.mu.RUnlock()
	env, ok := v.entries[key]
	return env.Value, ok
}

func (v *Vault) Delete(key string) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	if _, exists := v.entries[key]; !exists {
		return nil
	}
	delete(v.entries, key)
	return v.flushUnlocked()
}

func (v *Vault) DeletePrefix(prefix string) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	changed := false
	for k := range v.entries {
		if strings.HasPrefix(k, prefix) {
			delete(v.entries, k)
			changed = true
		}
	}
	if !changed {
		return nil
	}
	return v.flushUnlocked()
}
