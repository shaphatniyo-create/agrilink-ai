// Verifies every relative TS import in backend/src resolves to a real file.
// Run with: node scripts/check_imports.js
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const IMPORT_RE = /(?:import|export)\s+(?:[^'"]*?from\s+)?['"](\.[^'"]+)['"]/g;

let files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.ts')) files.push(full);
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
    const candidates = [base + '.ts', base + '.tsx', path.join(base, 'index.ts')];
    if (!candidates.some((c) => fs.existsSync(c))) {
      console.error(`UNRESOLVED IMPORT: ${path.relative(SRC, file)} -> '${spec}'`);
      errors++;
    }
  }
}
console.log(`Checked ${files.length} files, ${errors} unresolved import(s).`);
process.exit(errors ? 1 : 0);
