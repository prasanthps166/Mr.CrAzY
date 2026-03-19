import { readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const BUILD_MANIFEST_PATH = path.join(process.cwd(), ".next", "app-build-manifest.json");
const KILOBYTE = 1024;

const BUDGETS = [
  { label: "shared app shell", path: "/layout", route: "/layout", maxGzipKb: 180 },
  { label: "home page", path: "/", route: "/page", maxGzipKb: 175 },
  { label: "gallery page", path: "/gallery", route: "/gallery/page", maxGzipKb: 175 },
  { label: "community page", path: "/community", route: "/community/page", maxGzipKb: 200 },
  { label: "gallery detail page", path: "/gallery/[id]", route: "/gallery/[id]/page", maxGzipKb: 225 },
  { label: "generate page", path: "/generate", route: "/generate/page", maxGzipKb: 220 },
  { label: "admin page", path: "/admin", route: "/admin/page", maxGzipKb: 290 },
];

function formatKilobytes(bytes) {
  return `${(bytes / KILOBYTE).toFixed(1)} kB`;
}

async function getManifest() {
  try {
    const manifestSource = await readFile(BUILD_MANIFEST_PATH, "utf8");
    return JSON.parse(manifestSource);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read ${path.relative(process.cwd(), BUILD_MANIFEST_PATH)}. Run "npm run build" first. ${reason}`);
  }
}

async function getGzipSize(filePath) {
  const source = await readFile(path.join(process.cwd(), ".next", filePath));
  return gzipSync(source).length;
}

async function getRouteSize(routeFiles) {
  const jsFiles = [...new Set(routeFiles.filter((filePath) => filePath.endsWith(".js")))];
  const sizes = await Promise.all(jsFiles.map(async (filePath) => ({ filePath, bytes: await getGzipSize(filePath) })));
  return {
    totalBytes: sizes.reduce((sum, file) => sum + file.bytes, 0),
    files: sizes,
  };
}

async function main() {
  const manifest = await getManifest();
  let failures = 0;

  for (const budget of BUDGETS) {
    const routeFiles = manifest.pages?.[budget.route];
    if (!routeFiles) {
      failures += 1;
      console.error(`FAIL: ${budget.label} (${budget.path}) route is missing from app-build-manifest.`);
      continue;
    }

    const { totalBytes, files } = await getRouteSize(routeFiles);
    const budgetBytes = budget.maxGzipKb * KILOBYTE;

    if (totalBytes > budgetBytes) {
      failures += 1;
      console.error(
        `FAIL: ${budget.label} (${budget.path}) is ${formatKilobytes(totalBytes)} gzip, budget is ${budget.maxGzipKb} kB.`,
      );
      console.error(`  Files checked: ${files.map((file) => file.filePath).join(", ")}`);
      continue;
    }

    console.log(
      `PASS: ${budget.label} (${budget.path}) is ${formatKilobytes(totalBytes)} gzip, budget is ${budget.maxGzipKb} kB.`,
    );
  }

  if (failures > 0) {
    process.exitCode = 1;
    return;
  }

  console.log("All build bundle budgets passed.");
}

main().catch((error) => {
  console.error("Build budget check failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
