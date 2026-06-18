import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import i18next from "eslint-plugin-i18next";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Exclude translation domain files themselves — they define the raw strings.
    "lib/i18n/**",
    ".agents/**",
  ]),
  {
    plugins: { i18next },
    rules: {
      // warn = audit mode. Flip to 'error' once all callsites use t().
      "i18next/no-literal-string": [
        "warn",
        {
          // Recognise our t() and translate() wrappers
          markupOnly: false,
          functionNames: ["t", "translate"],
          // Ignore attributes that are non-visible or structural
          ignoreAttribute: [
            "className",
            "style",
            "href",
            "src",
            "data-testid",
            "data-theme",
            "type",
            "name",
            "id",
            "key",
            "ref",
            "role",
            "tabIndex",
            "target",
            "rel",
          ],
        },
      ],
    },
  },
  // API route handlers are server-only. Literal strings here are error messages
  // and log output — never rendered as UI copy. Translation is not appropriate.
  // .tsx is intentionally excluded: OG image handlers and similar UI-generating
  // routes under app/api/ should remain covered by i18n checks.
  // reason: server-only
  {
    files: ["app/api/**/*.ts"],
    rules: {
      "i18next/no-literal-string": "off",
    },
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_|^err?$|^e$" }],
    },
  },
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
]);

export default eslintConfig;
