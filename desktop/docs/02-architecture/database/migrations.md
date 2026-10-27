# 数据库迁移与备份

> 状态：当前迁移已实现，自动维护与恢复流程待实施 | 最后更新：2026-10-27
> 相关：[数据库设计](README.md) · [Schema](schema.md) · [发布检查单](../../06-release/release-checklist.md)

---

## 0. 当前运行实现（TASK-0030）

- 代码为 `internal/repository/migrations.go`，实际 SQL 位于 `internal/repository/migrations/`；
  当前只有 `0001_accounts.sql`。SQL 文件嵌入程序，不依赖运行目录。
- 每个文件包含 `-- +up` / `-- +down`，只执行 up。文件完整内容归一化 CRLF 为 LF 后计算
  SHA-256；首次初始化和版本登记同事务，已应用文件不可改写。
- 启动先检查数据库身份；未知非空文件、丢失迁移历史、未知更高版本或校验不符均拒绝继续。
- 非空已知库有待升级版本时，通过参数化 `VACUUM INTO` 创建
  `backups/pre-migration-vNNNN-<随机标识>.db`。备份失败则不执行升级。
- 升级前备份包含已提交 WAL 数据；普通启动不创建备份。自动每日备份、备份轮换、
  导出与恢复 UI 均未实现，不能把下文目标当作已落地能力。
- 真实 SQLite 测试覆盖初次初始化、重开、历史异常、升级、备份可读性、
  SQL 失败完整回滚和跨平台换行校验；不依赖真实用户数据库。
- 当前没有生产数据恢复演练，恢复必须先退出应用、保存现状并确认目标备份与 schema 版本，
  不能用旧示例命令直接覆盖用户数据。

下文保留较早规划；冲突时以当前代码、测试及 [当前 Schema](schema-current.md) 为准。

## 1. 迁移机制

- 迁移文件：`internal/repository/migrations/NNNN_description.sql`，`NNNN` 四位递增。
- 每个文件包含 `-- +up` 与 `-- +down` 两段；启动时按序执行未应用的 `up`。
- 执行记录写入 `schema_migration(version, applied_at, checksum)`。
- 校验和用于检测"已应用文件被改动"——发现不一致即拒绝启动并提示恢复备份。

```go
func Migrate(ctx context.Context, db *sql.DB) error {
    applied, err := loadApplied(ctx, db)
    if err != nil { return err }
    for _, m := range embeddedMigrations {
        if applied[m.Version] {
            if appliedChecksum != m.Checksum { return ErrMigrationTampered }
            continue
        }
        if err := backupBefore(db, m.Version); err != nil { return err }
        if err := runInTx(ctx, db, m.Up); err != nil { return err }
        if err := record(ctx, db, m); err != nil { return err }
    }
    return nil
}
```

## 2. 编写规则

| 规则 | 原因 |
| --- | --- |
| 一次迁移只做一类变更（加表 / 加列 / 建索引） | 失败时定位明确 |
| 已发布的迁移**永不修改**，只能追加新文件 | 已装用户数据一致性 |
| 新增列必须有默认值或允许 NULL | 避免全表阻塞 |
| 大表加索引用 `CREATE INDEX`（SQLite 不支持并发建索引，需在启动余量内执行） | 需评估耗时并给出进度 |
| 删列/改名：先新增并双写，后续版本再删旧列 | 允许回滚 |
| 迁移不得依赖应用代码中的常量（写死在 SQL 里） | 避免代码演进破坏历史迁移 |
| 每个迁移必须能在空库与"上一版本库样本"上各跑一次测试 | 覆盖率要求 |

## 3. 破坏性变更清单（需在 PR 中显式声明）

- 删除/重命名列或表
- 修改列类型或约束
- 修改主键或唯一约束
- 重命名 FTS 表或改变分词器（需重建索引）
- 改变时间单位（ms ↔ s）

## 4. 恢复流程

旧版本的混合 shell 覆盖示例已撤下：真实数据目录可能被配置覆盖，活动 WAL 不能任意删除。
正式恢复工具尚未实现，不提供可直接执行的破坏性操作。人工恢复至少需要：

1. 确认应用完全退出、没有进程使用数据库。
2. 解析实际 `DataDir`，界定当前主库、WAL、SHM 与目标备份的绝对路径及权限。
3. 保留当前主库及伴随文件的完整副本，再检查目标备份的身份、版本和完整性。
4. 取得明确恢复授权后，在同一文件操作环境内执行替换，不混用 PowerShell 和 cmd。
5. 确认不会回放旧库的 WAL；失败时保留现场，不自动继续清理或降级。
6. 重开后验证账号配置；邮件恢复验收要等后续邮件存储实现。

恢复后必须让用户知悉：备份之后的本地状态变更（已读标记、草稿）会丢失，服务器数据不受影响，
下次同步会重新对齐。

## 5. 备份策略

| 时机 | 方式 | 保留 |
| --- | --- | --- |
| 每日首次启动后空闲 60s | `VACUUM INTO backups/omnimail-YYYYMMDD.db` | 7 份 |
| 每次迁移前 | `VACUUM INTO backups/pre-migration-vNNNN.db` | 3 份 |
| 用户手动"导出备份" | 复制 db + attachments 清单 JSON | 用户决定 |

备份文件不得与主库同目录层级混放（放 `backups/` 子目录），并在 `settings` 记录最近备份时间。

## 6. 迁移测试（CI 必跑）

```go
func TestMigrations(t *testing.T) {
    // 空库
    db := openTemp(t)
    require.NoError(t, Migrate(ctx, db))
    verifySchemaVersion(t, db, latest)

    // 逐级升级
    for v := 1; v <= latest; v++ {
        db := openAtVersion(t, v)          // 用 testdata/schema_vN.db 样本
        require.NoError(t, Migrate(ctx, db))
        verifySchemaVersion(t, db, latest)
    }

    // 幂等
    require.NoError(t, Migrate(ctx, db))
}
```

`testdata/` 中的样本库随版本增加，每个 ≥ 1MB 的真实结构样本（脱敏数据）。

## 7. 故障处置

| 现象 | 判定 | 处理 |
| --- | --- | --- |
| `database is locked` | 其他实例占用 | 单实例锁应阻止；若出现，记录并提示重启 |
| `SQLITE_CORRUPT` | 文件损坏 | 走恢复流程，收集 `quick_check` 输出用于分析 |
| 迁移中途崩溃 | 事务已回滚 | 重启重试；连续 2 次失败则提示恢复备份 |
| 校验和不匹配 | 迁移文件被改 | 拒绝启动，提示这是开发者错误，附文件版本号 |
| 磁盘满 | 写入失败 | 明确提示"磁盘空间不足"，禁止自动清理用户数据 |
