import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('应用 DOM 不再使用原生 title，保留自定义组件的同名业务属性', () => {
  const paths = readdirSync('src', { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.tsx') && !path.endsWith('.test.tsx'))
    .map((path) => join('src', path));
  const nativeTitles: string[] = [];
  for (const path of paths) {
    const file = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(file);
        // iframe 的 title 是文档级无障碍名称，不是替代统一 Tooltip 的控件悬浮提示。
        if (/^[a-z]/.test(tag) && tag !== 'iframe') {
          for (const attribute of node.attributes.properties) {
            if (ts.isJsxAttribute(attribute) && attribute.name.getText(file) === 'title') {
              nativeTitles.push(`${path}: ${tag}`);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  expect(nativeTitles).toEqual([]);
});
