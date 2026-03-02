import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

async function checkGuard({ baseDir, filePattern, guardPattern, label }) {
  const absoluteDir = path.join(process.cwd(), baseDir);
  const files = (await walk(absoluteDir)).filter((filePath) => filePath.endsWith(filePattern));
  const missing = [];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");
    if (!guardPattern.test(source)) {
      missing.push(path.relative(process.cwd(), filePath));
    }
  }

  return { label, total: files.length, missing };
}

async function checkMiddleware() {
  const middlewarePath = path.join(process.cwd(), "middleware.ts");
  const source = await readFile(middlewarePath, "utf8");

  const hasApiKeyHeaderCheck = source.includes("x-api-key");
  const hasV1Matcher = /matcher:\s*\[\s*["']\/api\/v1\/:path\*["']\s*\]/m.test(source);

  return {
    label: "middleware /api/v1 key enforcement",
    total: 1,
    missing: hasApiKeyHeaderCheck && hasV1Matcher ? [] : [path.relative(process.cwd(), middlewarePath)],
  };
}

async function main() {
  const checks = await Promise.all([
    checkGuard({
      baseDir: "app/api/admin",
      filePattern: "route.ts",
      guardPattern: /\bisAdminRequest\s*\(/,
      label: "admin routes require isAdminRequest",
    }),
    checkGuard({
      baseDir: "app/api/v1",
      filePattern: "route.ts",
      guardPattern: /\bvalidateAndTrackApiKey\s*\(/,
      label: "v1 routes require validateAndTrackApiKey",
    }),
    checkMiddleware(),
  ]);

  let failures = 0;
  for (const check of checks) {
    if (check.missing.length) {
      failures += check.missing.length;
      console.error(`FAIL: ${check.label}`);
      for (const file of check.missing) {
        console.error(`  - ${file}`);
      }
      continue;
    }
    console.log(`PASS: ${check.label} (${check.total} files)`);
  }

  if (failures > 0) {
    process.exitCode = 1;
    return;
  }

  console.log("All route guard checks passed.");
}

main().catch((error) => {
  console.error("Route guard check failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
