const fs=require('fs'),assert=require('assert');
const status=fs.readFileSync('src/app-status-report.js','utf8');
const health=fs.readFileSync('src/app-status-rag-sync.js','utf8');
const collaboration=fs.readFileSync('src/app-status-report-collaboration.js','utf8');

assert.match(status,/<th>Status Update<\/th><th>Achievements<\/th><th>Issues \/ Escalations<\/th>/);
assert.match(health,/cell=tr\.children\?\.\[3\]/);
assert.doesNotMatch(health,/cell=tr\.children\?\.\[4\]/);
assert.match(collaboration,/\[\['health',3\],\['statusUpdate',4\],\['achievements',5\],\['issues',6\]\]/);
assert.match(collaboration,/const cell=tr\.children\?\.\[3\]/);
console.log('Status Report column mapping tests passed');
