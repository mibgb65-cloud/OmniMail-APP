package main

import (
	_ "embed"
	"fmt"
	"os"

	"omnimail/desktop/internal/app"
)

// 与前端共享同一份官方资源，避免原生窗口和应用内标识使用不同版本。
//
//go:embed frontend/public/brand/omnimail-256.png
var appIcon []byte

func main() {
	if err := app.Run(assets, appIcon); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
