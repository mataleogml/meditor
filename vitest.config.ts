import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Vitest has no Next.js build step to apply the `"react-server"`
      // export-condition aliasing that `next build`/`next dev` use to resolve
      // this bare specifier — point straight at the package's own no-op branch
      // so any test transitively importing a `"server-only"`-guarded module
      // doesn't hit its throwing default export.
      "server-only": resolve(root, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "jsdom",
    css: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
