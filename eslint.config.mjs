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
    files: ["src/presentation/**/*.ts"],
    rules: { "no-console": "off" },
  },

  // ---- Clean-architecture boundary enforcement ----
  // Dependencies may only point inward: presentation → adapters → application →
  // core. A layer must never import from a layer further out than itself.
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/application/*", "**/adapters/*", "**/presentation/*"],
              message:
                "core is the innermost layer and must not import from application, adapters, or presentation.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/adapters/*", "**/presentation/*"],
              message:
                "application may depend on core only, not on adapters or presentation.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/adapters/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/presentation/*"],
              message: "adapters must not import from presentation.",
            },
          ],
        },
      ],
    },
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
