const fs=require('fs'),assert=require('assert');
const ui=fs.readFileSync('src/app-status-report-ui.js','utf8');
const lifecycle=fs.readFileSync('src/app-status-report-collaboration.js','utf8');
const health=fs.readFileSync('src/app-status-rag-sync.js','utf8');

// New Draft freezes the previous report entries into the draft comparison baseline.
assert.match(lifecycle,/previousReportId:final\.id/);
assert.match(lifecycle,/previousEntries:clone\(final\.entries\|\|\[\]\)/);

// Collaboration owns the full reporting lifecycle, including reversible Published state.
assert.match(lifecycle,/async function unpublishStatusReport/);
assert.match(lifecycle,/status==='Published'/);
assert.match(lifecycle,/id="unpublishStatusReport"/);
assert.match(lifecycle,/id="newStatusDraft"/);
assert.match(lifecycle,/prepareLocalTarget\(\)/);
assert.doesNotMatch(health,/publishStatusReport\s*=\s*function/,'Health sync must not maintain a competing Publish lifecycle');

// Authoring shows the immutable previous baseline above the new editable narrative fields.
assert.match(ui,/function previousEntryFor/);
assert.match(ui,/statusReportDraft\?\.previousEntries/);
assert.match(ui,/status-previous-context/);
assert.match(ui,/cell\.insertBefore\(box,textarea\)/);
assert.match(ui,/\['statusUpdate','achievements','issues'\]/);
assert.match(ui,/status-commentary-cell/);
assert.match(ui,/margin-top:auto/,'Current draft inputs should align at the bottom of commentary cells');

// Previous commentary can be copied as text without modifying the draft field.
assert.match(ui,/function copyPreviousText/);
assert.match(ui,/navigator\.clipboard\?\.writeText/);
assert.match(ui,/status-copy-previous/);
assert.match(ui,/Copy previous text/);
assert.doesNotMatch(ui,/e\[field\]=previous/,'Clipboard copy must not write previous commentary into draft JSON');

// Live active Work Packages are shown to the author without becoming separate commentary fields.
assert.match(ui,/function liveActiveWorkPackages/);
assert.match(ui,/!\['Complete','Cancelled'\]\.includes/);
assert.match(ui,/Active Work Packages/);
assert.match(ui,/status-work-package-row/);
assert.doesNotMatch(ui,/data-status-field="workPackage/);

// Actual-vs-plan narrative remains in Resource Plan rather than cluttering Status Report authoring.
assert.doesNotMatch(ui,/decorateActualsEffort/);
assert.doesNotMatch(ui,/status-effort-context/);

console.log('Status Report authoring context tests passed');
