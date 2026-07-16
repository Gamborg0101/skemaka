import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ---------------------------------------------------------------------------
// Local rule: dark text tokens must ship a dark: variant on dark-aware surfaces.
//
// A `text-gray-900` (etc.) with no `dark:text-*` sibling renders dark-on-dark and
// becomes invisible in dark mode — exactly the "No employees yet" bug. This reads
// the raw source of each className value, so it also covers cn(...), template
// literals, and ternaries. It is deliberately scoped (below) to the manager UI,
// which is always dark-mode-aware; light-only surfaces (onboarding, marketing,
// legal, public token pages) hardcode a light background and are excluded.
// ---------------------------------------------------------------------------
const DARK_TEXT = /\btext-(?:gray|slate|zinc|neutral|stone)-(?:700|800|900)\b|\btext-black\b/;

const darkModeContrastPlugin = {
  rules: {
    "dark-text-needs-dark-variant": {
      meta: {
        type: "problem",
        docs: { description: "Dark text tokens need a dark: variant on dark-mode-aware surfaces" },
        messages: {
          needsDark:
            "Dark text ({{token}}) has no `dark:text-*` sibling — it will be invisible in dark mode. Add a dark: variant (e.g. `dark:text-gray-50`) or, if this sits on a hardcoded light background, ignore this line.",
        },
        schema: [],
      },
      create(context) {
        const sc = context.sourceCode ?? context.getSourceCode();
        return {
          JSXAttribute(node) {
            if (node.name.name !== "className" || !node.value) return;
            const text = sc.getText(node.value);
            const m = text.match(DARK_TEXT);
            if (m && !/dark:text-/.test(text)) {
              context.report({ node, messageId: "needsDark", data: { token: m[0] } });
            }
          },
        };
      },
    },
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Prisma client.
    "app/generated/**",
  ]),
  {
    // Advisory perf rule (React docs: "not recommended", not incorrect) newly
    // enabled by the eslint-config-next preset. It flags common, safe patterns
    // (seed derived state on open, kick off a fetch on mount) across the repo.
    // Keep it as a warning so it guides without failing CI; fix opportunistically.
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  {
    // A leading underscore marks a deliberately unused binding (e.g. the
    // destructure-to-exclude pattern in app/layout.tsx). Honor that convention
    // instead of warning on it.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Dark-mode-aware surfaces only. Route-group parens are escaped so minimatch
    // treats them literally rather than as an extglob group.
    files: ["app/\\(manager\\)/**/*.tsx", "components/manager/**/*.tsx"],
    plugins: { "dark-mode-contrast": darkModeContrastPlugin },
    rules: { "dark-mode-contrast/dark-text-needs-dark-variant": "error" },
  },
]);

export default eslintConfig;
