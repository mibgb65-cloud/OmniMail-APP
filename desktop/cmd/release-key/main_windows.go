//go:build windows

package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"unsafe"

	"golang.org/x/sys/windows"
)

func main() {
	out := flag.String("out", "", "当前用户受限目录中的 DPAPI 文件")
	flag.Parse()
	public, err := generate(*out)
	if err != nil {
		fmt.Fprintln(os.Stderr, "更新密钥生成失败；不会覆盖已有材料")
		os.Exit(1)
	}
	// 标准输出只含公钥，私钥从不离开加密写盘流程。
	fmt.Println(public)
}

func generate(out string) (string, error) {
	if !filepath.IsAbs(out) || filepath.Base(out) != "manifest-private.dpapi" {
		return "", errors.New("invalid destination")
	}
	public, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", err
	}
	defer clear(private)
	seed := private.Seed()
	defer clear(seed)
	entropy := []byte("OmniMail.ReleaseSigning.v1")
	input := windows.DataBlob{Size: uint32(len(seed)), Data: &seed[0]}
	extra := windows.DataBlob{Size: uint32(len(entropy)), Data: &entropy[0]}
	var output windows.DataBlob
	if err := windows.CryptProtectData(&input, nil, &extra, 0, nil, windows.CRYPTPROTECT_UI_FORBIDDEN, &output); err != nil {
		return "", err
	}
	runtime.KeepAlive(seed)
	runtime.KeepAlive(entropy)
	defer windows.LocalFree(windows.Handle(unsafe.Pointer(output.Data)))
	root, err := os.OpenRoot(filepath.Dir(out))
	if err != nil {
		return "", err
	}
	defer root.Close()
	file, err := root.OpenFile(filepath.Base(out), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return "", err
	}
	_, writeErr := file.Write(unsafe.Slice(output.Data, output.Size))
	syncErr, closeErr := file.Sync(), file.Close()
	if err := errors.Join(writeErr, syncErr, closeErr); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(public), nil
}
