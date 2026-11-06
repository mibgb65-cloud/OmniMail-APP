package updater

import (
	"bytes"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"regexp"
	"strconv"
	"strings"
)

const Repository = "mibgb65-cloud/OmniMail-APP"
const SignaturePrefix = "omnimail-update-manifest-v1\n"

var ReleaseMode = "development"
var PublicKey = ""
var versionPattern = regexp.MustCompile(`^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$`)
var ErrUpdate = errors.New("UPDATE_FAILED")

type Manifest struct {
	Schema     int    `json:"schema"`
	App        string `json:"app"`
	Repository string `json:"repository"`
	Version    string `json:"version"`
	Platform   string `json:"platform"`
	Arch       string `json:"arch"`
	File       string `json:"file"`
	Size       int64  `json:"size"`
	SHA256     string `json:"sha256"`
	Notes      string `json:"notes"`
}

func ValidVersion(value string) bool { return versionPattern.MatchString(value) }
func Newer(next, current string) bool {
	if !ValidVersion(next) || !ValidVersion(current) {
		return false
	}
	a, b := strings.Split(next, "."), strings.Split(current, ".")
	for i := range a {
		x, _ := strconv.Atoi(a[i])
		y, _ := strconv.Atoi(b[i])
		if x != y {
			return x > y
		}
	}
	return false
}
func PackageName(version string) string { return "OmniMail-" + version + "-windows-amd64-setup.exe" }
func VerifyManifest(raw, signature []byte, keyText string) (Manifest, error) {
	var value Manifest
	key, err := base64.StdEncoding.DecodeString(keyText)
	if err != nil || len(key) != ed25519.PublicKeySize || len(raw) > 64<<10 {
		return value, ErrUpdate
	}
	sig, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(signature)))
	if err != nil || !ed25519.Verify(key, append([]byte(SignaturePrefix), raw...), sig) {
		return value, ErrUpdate
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&value) != nil || decoder.Decode(new(json.RawMessage)) != io.EOF {
		return Manifest{}, ErrUpdate
	}
	digest, err := hex.DecodeString(value.SHA256)
	if err != nil || len(digest) != 32 || value.Schema != 1 || value.App != "OmniMail" || value.Repository != Repository ||
		!ValidVersion(value.Version) || value.Platform != "windows" || value.Arch != "amd64" || value.File != PackageName(value.Version) ||
		value.Size < 1 || value.Size > 256<<20 || len(value.Notes) > 32<<10 {
		return Manifest{}, ErrUpdate
	}
	return value, nil
}
