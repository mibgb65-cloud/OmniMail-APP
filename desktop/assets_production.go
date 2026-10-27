//go:build production

package main

import "embed"

// 发布构建必须先构建前端，产物完整嵌入，不依赖本机开发服务器。
//
//go:embed all:frontend/dist
var assets embed.FS
