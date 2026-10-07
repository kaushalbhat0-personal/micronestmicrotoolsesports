import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
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
