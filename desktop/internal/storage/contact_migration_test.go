package storage

import "testing"

func TestContactAliasMigrationPreservesLegacyNotesAndOwnership(t *testing.T) {
	dir := t.TempDir()
	db, err := OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, stmt := range []string{
		`DROP TABLE contact_aliases`,
		`DROP TABLE contact_duplicate_ignores`,
		`DELETE FROM schema_migrations WHERE version=2`,
		`INSERT INTO contacts(id,name,email,note,updated_at) VALUES
		 ('legacy','历史联系人','main@example.org','现有备注 | 备用邮箱: old@example.org, existing@example.org',1),
		 ('other','另一联系人','existing@example.org','',1),
		 ('bad','普通备注','bad@example.org','备用邮箱: not an email',1),
		 ('amb-a','重复标注一','a@example.org','备用邮箱: ambiguous@example.org',1),
		 ('amb-b','重复标注二','b@example.org','备用邮箱: ambiguous@example.org',1)`,
	} {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatal(err)
		}
	}
	_ = CheckpointAndClose(db)
	db, err = OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer CheckpointAndClose(db)
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM contact_aliases`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("历史迁移只应生成一个未被占用的有效别名：%v, %d", err, count)
	}
	var owner, note string
	if err := db.QueryRow(`SELECT contact_id FROM contact_aliases WHERE email='old@example.org'`).Scan(&owner); err != nil || owner != "legacy" {
		t.Fatalf("历史别名应归属原联系人：%v", err)
	}
	if err := db.QueryRow(`SELECT note FROM contacts WHERE id='legacy'`).Scan(&note); err != nil ||
		note != "现有备注 | 备用邮箱: old@example.org, existing@example.org" {
		t.Fatalf("历史备注不得被修改：%v", err)
	}
}
