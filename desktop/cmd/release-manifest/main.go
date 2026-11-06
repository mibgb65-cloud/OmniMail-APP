package main

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"unicode/utf8"

	"omnimail/desktop/internal/updater"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		// 不回显底层错误，避免签名材料、路径或版本说明进入公共构建日志。
		fmt.Fprintln(os.Stderr, "发布清单生成失败，请检查版本、签名材料和产物")
		os.Exit(1)
	}
}

func run(args []string) error {
	flags := flag.NewFlagSet("release-manifest", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	checkKey := flags.Bool("check-key", false, "")
	version := flags.String("version", "", "")
	file := flags.String("package", "", "")
	notes := flags.String("notes", "", "")
	out := flags.String("out", "", "")
	if flags.Parse(args) != nil || flags.NArg() != 0 {
		return updater.ErrUpdate
	}
	if *checkKey {
		_, err := signingKey()
		return err
	}
	if *out == "" ||
		!updater.ValidVersion(*version) || filepath.Base(*file) != updater.PackageName(*version) {
		return updater.ErrUpdate
	}
	key, err := signingKey()
	if err != nil {
		return err
	}
	size, digest, err := packageDigest(*file)
	if err != nil {
		return err
	}
	text, err := readNotes(*notes)
	if err != nil {
		return err
	}
	value := updater.Manifest{
		Schema: 1, App: "OmniMail", Repository: updater.Repository, Version: *version,
		Platform: "windows", Arch: "amd64", File: filepath.Base(*file),
		Size: size, SHA256: digest, Notes: text,
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	signature := []byte(base64.StdEncoding.EncodeToString(ed25519.Sign(key, append([]byte(updater.SignaturePrefix), raw...))))
	// 先用嵌入应用的同一公钥回验，拒绝公私钥不匹配或损坏的 64 字节私钥。
	if _, err := updater.VerifyManifest(raw, signature, os.Getenv("UPDATE_PUBLIC_KEY")); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(*out, "update-windows-amd64.json"), raw, 0o600); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(*out, "update-windows-amd64.sig"), signature, 0o600)
}

func signingKey() (ed25519.PrivateKey, error) {
	key, err := base64.StdEncoding.DecodeString(os.Getenv("UPDATE_MANIFEST_PRIVATE_KEY"))
	if err != nil {
		return nil, updater.ErrUpdate
	}
	if len(key) == ed25519.SeedSize {
		key = ed25519.NewKeyFromSeed(key)
	}
	if len(key) != ed25519.PrivateKeySize {
		return nil, updater.ErrUpdate
	}
	if !ed25519.PrivateKey(key).Equal(ed25519.NewKeyFromSeed(key[:ed25519.SeedSize])) {
		return nil, updater.ErrUpdate
	}
	expected := os.Getenv("UPDATE_PUBLIC_KEY")
	if expected == "" || base64.StdEncoding.EncodeToString(ed25519.PrivateKey(key).Public().(ed25519.PublicKey)) != expected {
		return nil, updater.ErrUpdate
	}
	return key, nil
}

func packageDigest(path string) (int64, string, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, "", updater.ErrUpdate
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() || info.Size() < 1 || info.Size() > 256<<20 {
		return 0, "", updater.ErrUpdate
	}
	digest := sha256.New()
	size, err := io.Copy(digest, io.LimitReader(file, (256<<20)+1))
	if err != nil || size != info.Size() {
		return 0, "", updater.ErrUpdate
	}
	return size, hex.EncodeToString(digest.Sum(nil)), nil
}

func readNotes(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", updater.ErrUpdate
	}
	defer file.Close()
	text, err := io.ReadAll(io.LimitReader(file, (32<<10)+1))
	if err != nil || len(text) > 32<<10 || !utf8.Valid(text) {
		return "", updater.ErrUpdate
	}
	return string(text), nil
}
