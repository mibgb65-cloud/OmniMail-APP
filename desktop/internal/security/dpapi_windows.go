//go:build windows

package security

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

func toDataBlob(b []byte) *windows.DataBlob {
	if len(b) == 0 {
		return &windows.DataBlob{}
	}
	return &windows.DataBlob{
		Size: uint32(len(b)),
		Data: &b[0],
	}
}

func cloneAndFreeBlob(blob *windows.DataBlob, wipe bool) []byte {
	if blob == nil || blob.Data == nil || blob.Size == 0 {
		if blob != nil && blob.Data != nil {
			_, _ = windows.LocalFree(windows.Handle(unsafe.Pointer(blob.Data)))
		}
		return nil
	}
	src := unsafe.Slice(blob.Data, blob.Size)
	out := make([]byte, len(src))
	copy(out, src)
	if wipe {
		for i := range src {
			src[i] = 0
		}
	}
	_, _ = windows.LocalFree(windows.Handle(unsafe.Pointer(blob.Data)))
	return out
}

// protectBytes 使用当前 Windows 登录用户作用域 DPAPI 加密数据，并绑定 Profile 专属熵。
func protectBytes(plain []byte, entropy []byte) ([]byte, error) {
	var out windows.DataBlob
	namePtr, _ := windows.UTF16PtrFromString("OmniMail-Secrets-Vault")
	err := windows.CryptProtectData(
		toDataBlob(plain),
		namePtr,
		toDataBlob(entropy),
		0,
		nil,
		windows.CRYPTPROTECT_UI_FORBIDDEN,
		&out,
	)
	if err != nil {
		return nil, err
	}
	return cloneAndFreeBlob(&out, false), nil
}

// unprotectBytes 使用当前 Windows 登录用户作用域 DPAPI 解密数据。
func unprotectBytes(cipher []byte, entropy []byte) ([]byte, error) {
	var out windows.DataBlob
	err := windows.CryptUnprotectData(
		toDataBlob(cipher),
		nil,
		toDataBlob(entropy),
		0,
		nil,
		windows.CRYPTPROTECT_UI_FORBIDDEN,
		&out,
	)
	if err != nil {
		return nil, err
	}
	return cloneAndFreeBlob(&out, true), nil
}
