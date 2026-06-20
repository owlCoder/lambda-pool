import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": "off",
    },
  },
  {
    // The executable shim and CLI legitimately use console / process.
    files: ["src/bin.ts", "src/cli.ts"],
    rules: { "no-console": "off" },
  },
  {
    // Test files may use `any` when poking at loosely-typed driver rows.
    files: ["test/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    // Build scripts run under Node and use Node globals (URL, process, ...).
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { URL: "readonly", process: "readonly" } },
  },
  {
    ignores: ["dist/", "node_modules/", "examples/"],
  },
);
