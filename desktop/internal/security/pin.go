package security

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/argon2"

	"omnimail/internal/apperr"
)

const (
	pinSaltBytes    = 16
	pinKeyBytes     = 32
	argonIterations = 3
	argonMemoryKB   = 64 * 1024
	argonThreads    = 2

	maxFailedPinAttempts = 5
	pinCooldownDuration  = 30 * time.Second
)

// HashPIN 使用 Argon2id 计算本地空间 PIN 摘要，仅保存随机盐与哈希。
func HashPIN(pin string) (saltB64 string, hashB64 string, err error) {
	cleaned := strings.TrimSpace(pin)
	if len(cleaned) < 4 || len(cleaned) > 32 {
		return "", "", apperr.New(apperr.CodeInvalidInput, "PIN 码长度须为 4~32 位字符")
	}
	salt := make([]byte, pinSaltBytes)
	if _, err := rand.Read(salt); err != nil {
		return "", "", err
	}
	key := argon2.IDKey([]byte(cleaned), salt, argonIterations, argonMemoryKB, argonThreads, pinKeyBytes)
	return base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(key), nil
}

// VerifyPIN 常量时间校验 PIN 是否与存储的 Argon2id 摘要一致。
func VerifyPIN(pin, saltB64, hashB64 string) bool {
	cleaned := strings.TrimSpace(pin)
	if cleaned == "" || saltB64 == "" || hashB64 == "" {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(saltB64)
	if err != nil || len(salt) == 0 {
		return false
	}
	expected, err := base64.RawStdEncoding.DecodeString(hashB64)
	if err != nil || len(expected) == 0 {
		return false
	}
	computed := argon2.IDKey([]byte(cleaned), salt, argonIterations, argonMemoryKB, argonThreads, uint32(len(expected)))
	return subtle.ConstantTimeCompare(computed, expected) == 1
}

type pinAttemptRecord struct {
	failures      int
	lockedUntilAt time.Time
}

// PINGuard 追踪每个本地空间的连续 PIN 校验失败次数，连续失败 5 次自动冷却 30 秒。
type PINGuard struct {
	mu      sync.Mutex
	records map[string]pinAttemptRecord
	nowFn   func() time.Time
}

func NewPINGuard() *PINGuard {
	return &PINGuard{
		records: make(map[string]pinAttemptRecord),
		nowFn:   time.Now,
	}
}

func (g *PINGuard) CheckAndVerify(profileID, pin, saltB64, hashB64 string) error {
	now := g.nowFn()
	g.mu.Lock()
	rec := g.records[profileID]
	if !rec.lockedUntilAt.IsZero() && now.Before(rec.lockedUntilAt) {
		sec := int(rec.lockedUntilAt.Sub(now).Seconds()) + 1
		g.mu.Unlock()
		return apperr.New(apperr.CodePinInvalid, fmt.Sprintf("PIN 连续输错次数过多，请等待 %d 秒后再试", sec))
	}
	g.mu.Unlock()

	if VerifyPIN(pin, saltB64, hashB64) {
		g.mu.Lock()
		delete(g.records, profileID)
		g.mu.Unlock()
		return nil
	}

	g.mu.Lock()
	rec = g.records[profileID]
	rec.failures++
	if rec.failures >= maxFailedPinAttempts {
		rec.lockedUntilAt = now.Add(pinCooldownDuration)
		rec.failures = 0
		g.records[profileID] = rec
		g.mu.Unlock()
		return apperr.New(apperr.CodePinInvalid, "PIN 校验失败已达 5 次，已触发 30 秒安全冷却")
	}
	remain := maxFailedPinAttempts - rec.failures
	g.records[profileID] = rec
	g.mu.Unlock()
	return apperr.New(apperr.CodePinInvalid, fmt.Sprintf("PIN 码不正确（还可尝试 %d 次）", remain))
}
