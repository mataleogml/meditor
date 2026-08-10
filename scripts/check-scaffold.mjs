#!/usr/bin/env node
/**
 * Typecheck what `meditor init` actually emits.
 *
 * The scaffold templates are STRINGS — `tsc` never sees them, and the unit tests
 * can only assert on substrings. So a template can ship a type error, a wrong
 * import path or a stale API for a whole release and every check stays green.
 * This scaffolds into a throwaway dir inside the repo (so Node resolution finds
 * next/react/@types from our own node_modules) and compiles the result against
 * the local source via path aliases.
 *
 * Run standalone or as part of `npm run verify`.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sandbox = path.join(repo, ".tmp-scaffold-check");

const TSCONFIG = {
  compilerOptions: {
    target: "ES2020",
    lib: ["dom", "dom.iterable", "esnext"],
    module: "esnext",
    moduleResolution: "bundler",
    jsx: "react-jsx",
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    noEmit: true,
    baseUrl: ".",
    // The published package resolves these through its own exports map; here
    // they point at source so a template is checked against the CURRENT API.
    paths: {
      "@/*": ["./src/*"],
      meditor: ["../src/index.ts"],
      "meditor/element": ["../src/element.ts"],
      "meditor/auth/local": ["../src/auth/local.ts"],
    },
  },
  include: ["src/**/*.ts", "src/**/*.tsx"],
};

rmSync(sandbox, { recursive: true, force: true });
mkdirSync(path.join(sandbox, "src", "app"), { recursive: true });
try {
  // `init` picks src/ vs root by which app dir exists; src/ is the common layout.
  execFileSync(process.execPath, [path.join(repo, "dist", "cli.js"), "init"], { cwd: sandbox, stdio: "ignore" });
  writeFileSync(path.join(sandbox, "tsconfig.json"), JSON.stringify(TSCONFIG, null, 2));
  execFileSync(path.join(repo, "node_modules", ".bin", "tsc"), ["--noEmit", "-p", "tsconfig.json"], {
    cwd: sandbox,
    stdio: "inherit",
  });
  console.log("check-scaffold: `meditor init` output typechecks");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
