import stylistic from "@stylistic/eslint-plugin";
import pluginVitest from "@vitest/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import { configs } from "typescript-eslint";

export default defineConfig(
  {
    name: "app/files-to-lint",
    files: ["**/*.{ts,mts}"],
  },
  globalIgnores(["**/dist/**", "**/coverage/**"]),

  ...configs.recommended,

  {
    ...pluginVitest.configs.recommended,
    files: ["src/**/*.test.ts"],
  },

  // Disable the legacy core rules to avoid conflicts
  stylistic.configs["disable-legacy"],

  // Setup basic stylistic configuration
  stylistic.configs.customize({
    indent: 2,
    quotes: "double",
    semi: true,
    jsx: false,
    commaDangle: "always-multiline",
  }),

  {
    name: "app/stylistic-overrides",
    rules: {
      // Enforce 1tbs brace placement. allowSingleLine is false by default,
      // which means { foo(); bar(); } on one line is an error.
      "@stylistic/brace-style": ["error", "1tbs"],

      // Require a blank line after any multiline block (if, for, while, etc.)
      // Only triggers on multiline blocks, not single-line object literals.
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "multiline-block-like", next: "*" },
      ],

      // Ensure no trailing spaces and file ends with a newline
      "@stylistic/no-trailing-spaces": "error",
      "@stylistic/eol-last": ["error", "always"],
    },
  },

  {
    name: "app/import-sorting",
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },

  {
    name: "app/overrides",
    rules: {
      // TypeScript
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "@typescript-eslint/explicit-function-return-type": ["error", {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],

      // Always require curly braces for if/else/for/while/do - no braceless one-liners.
      "curly": ["error", "all"],

      // Comments must start with an uppercase letter.
      "capitalized-comments": ["error", "always", {
        ignoreInlineComments: true,
        ignoreConsecutiveComments: true,
      }],

      // Prefer undefined over null for absent values.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=null]",
          message: "Use undefined instead of null.",
        },
      ],
    },
  },
);
