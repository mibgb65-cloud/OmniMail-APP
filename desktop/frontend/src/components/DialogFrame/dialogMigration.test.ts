import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('同类模态弹窗必须复用 DialogFrame，不再各自声明原生外框', () => {
  const files = readdirSync('src', { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.tsx') && !path.endsWith('.test.tsx'))
    .map((path) => join('src', path));
  const directDialogs: string[] = [];
  for (const path of files) {
    if (path.replaceAll('\\', '/').endsWith('/DialogFrame/DialogFrame.tsx')) continue;
    const file = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node) => {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        node.tagName.getText(file) === 'dialog'
      ) {
        directDialogs.push(path);
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  expect(directDialogs).toEqual([]);
});
