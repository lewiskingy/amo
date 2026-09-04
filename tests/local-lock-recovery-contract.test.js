const fs=require('fs'),assert=require('assert');
const bridge=fs.readFileSync('src/app-workspace-repository-bridge.js','utf8');

assert.match(bridge,/async function readRepositoryLock\(repo\)/);
assert.match(bridge,/repo\.mode==='local'/);
assert.match(bridge,/e instanceof SyntaxError/);
assert.match(bridge,/amo-workspace-lock-invalid/);
assert.match(bridge,/Unreadable local lock/);
assert.match(bridge,/treated as stale and may be replaced explicitly/);
assert.match(bridge,/readWorkspaceLock=async function\(\)\{return readRepositoryLock\(currentRepo\(\)\)\}/);
assert.match(bridge,/const current=await readRepositoryLock\(repo\)/);

console.log('Local workspace lock recovery contract tests passed');
