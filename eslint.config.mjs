import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// Pengganti eslint-config-next: plugin Next.js menarik paket `braces` yang punya kerentanan tanpa versi perbaikan.
const eslintConfig = tseslint.config(
  { ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "scripts/data/.cache/**"] },
  ...tseslint.configs.recommended,
  // sama seperti next/typescript sebelumnya: variabel tak terpakai dan `any` cukup diberi peringatan
  { rules: { "@typescript-eslint/no-unused-vars": "warn", "@typescript-eslint/no-explicit-any": "warn" } },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);

export default eslintConfig;
