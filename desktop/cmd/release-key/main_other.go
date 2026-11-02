//go:build !windows

package main

import (
	"fmt"
	"os"
)

func main() {
	fmt.Fprintln(os.Stderr, "当前用户 DPAPI 签名材料仅支持 Windows")
	os.Exit(1)
}
