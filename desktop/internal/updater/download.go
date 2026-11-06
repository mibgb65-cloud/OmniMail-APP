package updater

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func validPublicKey() bool {
	key, err := base64.StdEncoding.DecodeString(PublicKey)
	return err == nil && len(key) == ed25519.PublicKeySize
}
func client() *http.Client {
	return &http.Client{Timeout: 15 * time.Minute, CheckRedirect: func(r *http.Request, via []*http.Request) error {
		if len(via) > 4 || r.URL.Scheme != "https" || r.URL.User != nil {
			return ErrUpdate
		}
		switch r.URL.Hostname() {
		case "github.com", "api.github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com", "github-releases.githubusercontent.com":
			return nil
		}
		return ErrUpdate
	}}
}
func readURL(ctx context.Context, address string, limit int64) ([]byte, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return nil, ErrUpdate
	}
	request.Header.Set("User-Agent", "OmniMail-Updater")
	request.Header.Set("Accept", "application/vnd.github+json")
	response, err := client().Do(request)
	if err != nil {
		return nil, ErrUpdate
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return nil, ErrUpdate
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if err != nil || int64(len(data)) > limit {
		return nil, ErrUpdate
	}
	return data, nil
}
func fetchLatest(ctx context.Context, key string) (Manifest, []byte, []byte, error) {
	var empty Manifest
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	data, err := readURL(ctx, "https://api.github.com/repos/"+Repository+"/releases/latest", 64<<10)
	if err != nil {
		return empty, nil, nil, err
	}
	var release struct {
		Tag        string `json:"tag_name"`
		Draft      bool   `json:"draft"`
		Prerelease bool   `json:"prerelease"`
	}
	if json.Unmarshal(data, &release) != nil || release.Draft || release.Prerelease || !strings.HasPrefix(release.Tag, "v") || !ValidVersion(strings.TrimPrefix(release.Tag, "v")) {
		return empty, nil, nil, ErrUpdate
	}
	base := "https://github.com/" + Repository + "/releases/download/" + url.PathEscape(release.Tag) + "/"
	raw, err := readURL(ctx, base+"update-windows-amd64.json", 64<<10)
	if err != nil {
		return empty, nil, nil, err
	}
	sig, err := readURL(ctx, base+"update-windows-amd64.sig", 256)
	if err != nil {
		return empty, nil, nil, err
	}
	value, err := VerifyManifest(raw, sig, key)
	if err != nil || "v"+value.Version != release.Tag {
		return empty, nil, nil, ErrUpdate
	}
	return value, raw, sig, nil
}
func updatesRoot(dir string) (*os.Root, error) {
	root, err := os.OpenRoot(dir)
	if err != nil {
		return nil, ErrUpdate
	}
	if err = root.Mkdir("updates", 0o700); err != nil && !os.IsExist(err) {
		root.Close()
		return nil, ErrUpdate
	}
	info, err := root.Lstat("updates")
	if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		root.Close()
		return nil, ErrUpdate
	}
	child, err := root.OpenRoot("updates")
	root.Close()
	if err != nil {
		return nil, ErrUpdate
	}
	return child, nil
}
func saveManifest(dir string, raw, sig []byte) error {
	root, err := updatesRoot(dir)
	if err != nil {
		return err
	}
	defer root.Close()
	for name, data := range map[string][]byte{"manifest.json": raw, "manifest.sig": sig} {
		file, err := root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
		if err != nil {
			return ErrUpdate
		}
		_, writeErr := file.Write(data)
		closeErr := file.Close()
		if writeErr != nil || closeErr != nil {
			return ErrUpdate
		}
	}
	return nil
}
func download(ctx context.Context, dir string, value Manifest, progress func(int64)) error {
	root, err := updatesRoot(dir)
	if err != nil {
		return err
	}
	defer root.Close()
	name := value.File + ".part"
	file, err := root.OpenFile(name, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if os.IsExist(err) {
		if root.Remove(name) != nil {
			return ErrUpdate
		}
		file, err = root.OpenFile(name, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	}
	if err != nil {
		return ErrUpdate
	}
	defer root.Remove(name)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://github.com/"+Repository+"/releases/download/v"+value.Version+"/"+value.File, nil)
	if err != nil {
		file.Close()
		return ErrUpdate
	}
	response, err := client().Do(request)
	if err != nil {
		file.Close()
		return ErrUpdate
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		file.Close()
		return ErrUpdate
	}
	digest := sha256.New()
	buffer := make([]byte, 64<<10)
	var count int64
	for {
		n, readErr := response.Body.Read(buffer)
		if n > 0 {
			count += int64(n)
			if count > value.Size {
				file.Close()
				return ErrUpdate
			}
			if _, err := file.Write(buffer[:n]); err != nil {
				file.Close()
				return ErrUpdate
			}
			digest.Write(buffer[:n])
			progress(count)
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			file.Close()
			return ErrUpdate
		}
	}
	syncErr, closeErr := file.Sync(), file.Close()
	if syncErr != nil || closeErr != nil || count != value.Size || hex.EncodeToString(digest.Sum(nil)) != strings.ToLower(value.SHA256) {
		return ErrUpdate
	}
	if root.Rename(name, value.File) != nil {
		return ErrUpdate
	}
	return nil
}
func verifyPaths(paths Paths, key, current string) error {
	if !filepath.IsAbs(paths.Root) {
		return ErrUpdate
	}
	root, err := os.OpenRoot(paths.Root)
	if err != nil {
		return ErrUpdate
	}
	defer root.Close()
	read := func(path string, max int64) ([]byte, error) {
		if filepath.Dir(filepath.Clean(path)) != filepath.Clean(paths.Root) {
			return nil, ErrUpdate
		}
		info, err := root.Lstat(filepath.Base(path))
		if err != nil || !info.Mode().IsRegular() || info.Size() > max {
			return nil, ErrUpdate
		}
		file, err := root.Open(filepath.Base(path))
		if err != nil {
			return nil, ErrUpdate
		}
		defer file.Close()
		return io.ReadAll(io.LimitReader(file, max+1))
	}
	raw, err := read(paths.Manifest, 64<<10)
	if err != nil {
		return err
	}
	sig, err := read(paths.Signature, 256)
	if err != nil {
		return err
	}
	value, err := VerifyManifest(raw, sig, key)
	if err != nil || !Newer(value.Version, current) || filepath.Base(paths.Package) != value.File {
		return ErrUpdate
	}
	data, err := read(paths.Package, value.Size)
	if err != nil || int64(len(data)) != value.Size {
		return ErrUpdate
	}
	digest := sha256.Sum256(data)
	if hex.EncodeToString(digest[:]) != strings.ToLower(value.SHA256) {
		return ErrUpdate
	}
	return nil
}
