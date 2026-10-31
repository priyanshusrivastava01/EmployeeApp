const fs = require('fs');
const code = fs.readFileSync('server/src/index.js', 'utf8');

const routeRegex = /app\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/g;
let match;
const routes = [];

while ((match = routeRegex.exec(code)) !== null) {
  const method = match[1].toUpperCase();
  const path = match[2];
  const startIndex = match.index;
  const nextApp = code.indexOf('\napp.', startIndex + 10);
  const routeCode = nextApp === -1 ? code.slice(startIndex) : code.slice(startIndex, nextApp);
  const usesSupabase = routeCode.includes('supabase');
  const usesMemDb = routeCode.includes('memDb') || routeCode.includes('mem.');
  routes.push({ method, path, usesSupabase, usesMemDb });
}

console.log('Total routes found:', routes.length);

const onlyMemDb = routes.filter(r => !r.usesSupabase && r.usesMemDb);
console.log('\n--- ROUTES USING ONLY MEMDB (NO SUPABASE CODE) ---');
console.log('Count:', onlyMemDb.length);
onlyMemDb.forEach(r => console.log(` - [${r.method}] ${r.path}`));

const both = routes.filter(r => r.usesSupabase && r.usesMemDb);
console.log('\n--- ROUTES SUPPORTING BOTH SUPABASE & MEMDB ---');
console.log('Count:', both.length);

const onlySupabase = routes.filter(r => r.usesSupabase && !r.usesMemDb);
console.log('\n--- ROUTES USING ONLY SUPABASE ---');
console.log('Count:', onlySupabase.length);
onlySupabase.forEach(r => console.log(` - [${r.method}] ${r.path}`));

const neither = routes.filter(r => !r.usesSupabase && !r.usesMemDb);
console.log('\n--- UTILITY / HEALTH / STATIC ROUTES (NO DB) ---');
console.log('Count:', neither.length);
neither.forEach(r => console.log(` - [${r.method}] ${r.path}`));

