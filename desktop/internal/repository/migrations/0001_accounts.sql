-- +up
CREATE TABLE account (
    id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 64),
    provider_code TEXT NOT NULL CHECK(length(provider_code) BETWEEN 1 AND 64),
    email TEXT NOT NULL CHECK(length(email) BETWEEN 3 AND 254),
    display_name TEXT NOT NULL DEFAULT '' CHECK(length(display_name) <= 256),
    color_index INTEGER NOT NULL DEFAULT 0 CHECK(color_index BETWEEN 0 AND 5),
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN 0 AND 1000000),
    status TEXT NOT NULL CHECK(status IN ('configured', 'reauth_required', 'disconnected')),
    sync_enabled INTEGER NOT NULL CHECK(sync_enabled IN (0, 1)),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    updated_at INTEGER NOT NULL CHECK(updated_at >= created_at),
    CHECK(status != 'disconnected' OR sync_enabled = 0)
) STRICT;
CREATE INDEX idx_account_order ON account(sort_order, created_at, id);

CREATE TABLE account_endpoint (
    id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 64),
    account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    protocol TEXT NOT NULL CHECK(protocol IN ('imap', 'smtp')),
    host TEXT NOT NULL CHECK(length(host) BETWEEN 1 AND 253),
    port INTEGER NOT NULL CHECK(port BETWEEN 1 AND 65535),
    tls_mode TEXT NOT NULL CHECK(tls_mode IN ('implicit_tls', 'starttls')),
    username TEXT NOT NULL CHECK(length(username) BETWEEN 1 AND 320),
    auth_kind TEXT NOT NULL CHECK(auth_kind IN ('password', 'oauth2')),
    credential_ref TEXT CHECK(credential_ref IS NULL OR length(credential_ref) BETWEEN 1 AND 256),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    updated_at INTEGER NOT NULL CHECK(updated_at >= created_at),
    UNIQUE(account_id, protocol)
) STRICT;
CREATE INDEX idx_endpoint_credential ON account_endpoint(credential_ref)
    WHERE credential_ref IS NOT NULL;

-- +down
-- 不自动降级；这里只记录开发环境回退所需的逆向结构操作。
DROP TABLE account_endpoint;
DROP TABLE account;
