import { createElement } from "react";
import type { Options } from "react-markdown";

export const aiMarkdownOptions = {
  skipHtml: true,
  components: {
    // AI 输出不执行 HTML、不加载远程图片，也不直接打开模型生成的链接。
    a: ({ children }) => createElement("span", null, children),
    img: ({ alt }) => (alt ? createElement("span", null, alt) : null),
  },
} satisfies Options;
