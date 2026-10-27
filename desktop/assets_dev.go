//go:build !production

package main

import "embed"

// 开发时由 Wails 代理 Vite；只嵌入入口，保证全新检出即可测试和生成绑定。
//
//go:embed frontend/index.html
var assets embed.FS
