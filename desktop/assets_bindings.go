//go:build bindings

package main

import "embed"

// 绑定生成先于前端构建，不读取 dist；普通构建仍强制嵌入真实的前端产物。
var assets embed.FS
