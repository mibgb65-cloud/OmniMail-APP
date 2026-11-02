//go:build windows

package updater

import (
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"golang.org/x/sys/windows"
	"omnimail/desktop/internal/platform"
)

// RunInstaller 只执行受签名清单绑定的安装包；不接受前端提供的命令或任意 exe。
func RunInstaller(root, current string, parent int) error {
	if ReleaseMode != "release" || !ValidVersion(current) || parent < 1 || parent == os.Getpid() {
		return ErrUpdate
	}
	layout, err := platform.InstalledLayout()
	if err != nil || !strings.EqualFold(filepath.Clean(root), filepath.Join(layout.DataDir, "updates")) {
		return ErrUpdate
	}
	raw, err := os.ReadFile(filepath.Join(root, "manifest.json"))
	if err != nil || len(raw) > 64<<10 {
		return ErrUpdate
	}
	sig, err := os.ReadFile(filepath.Join(root, "manifest.sig"))
	if err != nil || len(sig) > 256 {
		return ErrUpdate
	}
	value, err := VerifyManifest(raw, sig, PublicKey)
	if err != nil || !Newer(value.Version, current) {
		return ErrUpdate
	}
	paths := Paths{root, filepath.Join(root, value.File), filepath.Join(root, "manifest.json"), filepath.Join(root, "manifest.sig")}
	pathPtr, err := windows.UTF16PtrFromString(paths.Package)
	if err != nil {
		return ErrUpdate
	}
	// 禁止写入/删除共享，覆盖安装包在校验与启动之间被替换的窗口。
	handle, err := windows.CreateFile(pathPtr, windows.GENERIC_READ, windows.FILE_SHARE_READ, nil, windows.OPEN_EXISTING, windows.FILE_ATTRIBUTE_NORMAL, 0)
	if err != nil {
		return ErrUpdate
	}
	defer windows.CloseHandle(handle)
	if verifyPaths(paths, PublicKey, current) != nil {
		return ErrUpdate
	}
	process, err := windows.OpenProcess(windows.SYNCHRONIZE|windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(parent))
	if err != nil {
		return ErrUpdate
	}
	defer windows.CloseHandle(process)
	var buffer [4096]uint16
	length := uint32(len(buffer))
	if windows.QueryFullProcessImageName(process, 0, &buffer[0], &length) != nil ||
		!strings.EqualFold(windows.UTF16ToString(buffer[:length]), filepath.Join(layout.InstallDir, "OmniMail.exe")) {
		return ErrUpdate
	}
	if status, err := windows.WaitForSingleObject(process, 60000); err != nil || status != windows.WAIT_OBJECT_0 {
		return ErrUpdate
	}
	temp := filepath.Join(root, "install-temp")
	if os.MkdirAll(temp, 0o700) != nil {
		return ErrUpdate
	}
	command := exec.Command(paths.Package, "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/SP-")
	command.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	command.Env = append(os.Environ(), "TEMP="+temp, "TMP="+temp)
	err = command.Run()
	code := "success"
	if err != nil {
		code = "UPDATE_INSTALL_FAILED"
	}
	if writeErr := os.WriteFile(filepath.Join(root, "last-result.txt"), []byte(code), 0o600); writeErr != nil {
		return ErrUpdate
	}
	restart := exec.Command(filepath.Join(layout.InstallDir, "OmniMail.exe"))
	restart.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if restart.Start() != nil {
		return ErrUpdate
	}
	if releaseErr := restart.Process.Release(); releaseErr != nil {
		return ErrUpdate
	}
	if err != nil {
		return ErrUpdate
	}
	return nil
}
func StartHelper(source string, paths Paths, current string) error {
	if !ValidVersion(current) || ReleaseMode != "release" {
		return ErrUpdate
	}
	info, err := os.Stat(source)
	if err != nil || !info.Mode().IsRegular() || info.Size() > 32<<20 {
		return ErrUpdate
	}
	data, err := os.ReadFile(source)
	if err != nil {
		return ErrUpdate
	}
	name := "runner-" + strconv.FormatInt(time.Now().UnixNano(), 10) + ".exe"
	root, err := os.OpenRoot(paths.Root)
	if err != nil {
		return ErrUpdate
	}
	defer root.Close()
	file, err := root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return ErrUpdate
	}
	_, writeErr := file.Write(data)
	syncErr, closeErr := file.Sync(), file.Close()
	if writeErr != nil || syncErr != nil || closeErr != nil {
		return ErrUpdate
	}
	command := exec.Command(filepath.Join(paths.Root, name), "--root", paths.Root, "--current", current, "--parent", strconv.Itoa(os.Getpid()))
	command.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if command.Start() != nil {
		return ErrUpdate
	}
	return command.Process.Release()
}
