import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const noNativeControlsRule = [
  "error",
  {
    selector: "JSXOpeningElement[name.name='select']",
    message:
      "禁止使用原生 <select>，请统一使用 components/common/CustomSelect。",
  },
  {
    selector: "JSXOpeningElement[name.name='option']",
    message:
      "禁止使用原生 <option>，请统一使用 components/common/CustomSelect。",
  },
  {
    selector:
      "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value='checkbox']",
    message:
      '禁止使用原生 <input type="checkbox">，请统一使用 components/common/Checkbox 或 ToggleSwitch。',
  },
  {
    selector:
      "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value='radio']",
    message:
      '禁止使用原生 <input type="radio">，请统一使用自定义单选分段或 CustomSelect。',
  },
];

export default defineConfig([
  globalIgnores(["bindings/", "dist/"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-syntax": noNativeControlsRule,
    },
  },
  {
    files: [
      "src/components/common/Checkbox.tsx",
      "src/components/common/CustomSelect*.tsx",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
]);
