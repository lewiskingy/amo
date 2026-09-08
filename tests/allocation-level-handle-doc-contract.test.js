const fs=require('fs'),assert=require('assert');
const doc=fs.readFileSync('src/docs/AllocationLevelHandle.md.txt','utf8');
assert.match(doc,/0, 10, 20, 40, 60, 80, 100/);
assert.match(doc,/half a day, one day, then two, three, four and five days per week/);
assert.match(doc,/canonical Work Package resource-planning component/);
console.log('Allocation level handle documentation contract passed');
