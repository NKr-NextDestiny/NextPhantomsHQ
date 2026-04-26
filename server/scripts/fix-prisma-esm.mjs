import fs from "node:fs";
import path from "node:path";

const targetDir = process.argv[2];

if (!targetDir) {
  console.error("Usage: node scripts/fix-prisma-esm.mjs <directory>");
  process.exit(1);
}

const resolvedTargetDir = path.resolve(process.cwd(), targetDir);

const relativeSpecifierPattern =
  /((?:import|export)\s+(?:[^'"]*?\s+from\s+)?|import\s*\(\s*)['"](\.[^'"]+)['"](\s*\)?)/g;

function resolvePatchedSpecifier(filePath, specifier) {
  if (!specifier.startsWith(".")) {
    return specifier;
  }

  if (specifier.endsWith(".js") || specifier.endsWith(".json") || specifier.endsWith(".node")) {
    return specifier;
  }

  const absoluteBase = path.resolve(path.dirname(filePath), specifier);

  if (fs.existsSync(`${absoluteBase}.js`)) {
    return `${specifier}.js`;
  }

  if (fs.existsSync(path.join(absoluteBase, "index.js"))) {
    return `${specifier}/index.js`;
  }

  return specifier;
}

function patchFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const patched = source.replace(relativeSpecifierPattern, (full, prefix, specifier, suffix) => {
    const nextSpecifier = resolvePatchedSpecifier(filePath, specifier);
    return `${prefix}"${nextSpecifier}"${suffix}`;
  });

  if (patched !== source) {
    fs.writeFileSync(filePath, patched, "utf8");
  }
}

function walk(dirPath) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(".js")) {
      patchFile(fullPath);
    }
  }
}

if (!fs.existsSync(resolvedTargetDir)) {
  console.error(`Directory does not exist: ${resolvedTargetDir}`);
  process.exit(1);
}

walk(resolvedTargetDir);
