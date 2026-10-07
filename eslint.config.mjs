import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "url";
import path from "path";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

// NOTE (RCCF-TOOLCHAIN-LINT-01): plugin configs are referenced directly
// ("plugin:@next/next/…", "plugin:react/…") instead of the
// "next/core-web-vitals" / "next/typescript" bundle entries. Those bundles
// resolve through eslint-config-next/index.js, which unconditionally requires
// @rushstack/eslint-patch — a legacy eslintrc-era shim that cannot detect
// ESLint 9 when the flat config is loaded via import() and aborts the entire
// lint run ("the calling module was not recognized"). The patch is inert
// under flat config (module resolution is handled by FlatCompat/ESLint
// itself), so bypassing that entry removes the failure without changing the
// enforced rule sets.

const eslintConfig = [
  ...compat.extends(
    "plugin:@next/next/recommended",
    "plugin:@next/next/core-web-vitals",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@typescript-eslint/recommended"
  ),
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: "module" },
    },
  },
  {
    plugins: {
      import: importPlugin,
      "jsx-a11y": jsxA11yPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Carried over from the eslint-config-next defaults (new JSX transform, no propTypes).
      "react/no-unknown-property": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/jsx-no-target-blank": "off",
      "import/no-anonymous-default-export": "warn",
      "jsx-a11y/alt-text": ["warn", { elements: ["img"], img: ["Image"] }],
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-proptypes": "warn",
      "jsx-a11y/aria-unsupported-elements": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/role-supports-aria-props": "warn",
    },
    settings: {
      react: { version: "detect" },
    },
  },
  {
    // Super Admin: prevent service_role client in future admin client components
    files: ["src/app/(admin)/**/*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              importNames: ["createAdminClient"],
              message: "createAdminClient is server-only and must be used only after requireSuperAdmin(). Do not import in admin client components.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "out/**", "dist/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
