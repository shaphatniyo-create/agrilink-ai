// Verifies every relative import in frontend/src resolves to a real file.
// CommonJS (.cjs) because the frontend package.json has "type": "module".
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const IMPORT_RE = /(?:import|export)\s+(?:[^'"]*?from\s+)?['"](\.[^'"]+)['"]/g;

let files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
}
walk(SRC);

let errors = 0;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = IMPORT_RE.exec(content))) {
    const spec = m[1];
    const base = path.resolve(path.dirname(file), spec);
    const candidates = [
      base + '.ts',
      base + '.tsx',
      base,
      path.join(base, 'index.ts'),
      path.join(base, 'index.tsx'),
    ];
    if (!candidates.some((c) => fs.existsSync(c) && fs.statSync(c).isFile())) {
      console.error(`UNRESOLVED IMPORT: ${path.relative(SRC, file)} -> '${spec}'`);
      errors++;
    }
  }
}
console.log(`Checked ${files.length} files, ${errors} unresolved import(s).`);
process.exit(errors ? 1 : 0);
