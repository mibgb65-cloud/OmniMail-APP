# 版本发布说明

正式 tag `vX.Y.Z` 必须在同一提交包含本目录的 `vX.Y.Z.md`。
使用 UTF-8 无 BOM，最多 32 KiB，只写本次实际交付的变化、兼容性和已知问题；
没有实际发布授权时不创建虚构的版本公告。

该文件同时进入安装目录、签名更新清单和 GitHub Release。
缺少文件时 workflow 明确失败，不自动用完整 changelog 或生成的占位说明替代。

实际流程见 [Windows 安装发布](../windows-installer.md)。
