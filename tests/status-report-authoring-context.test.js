const fs=require('fs'),assert=require('assert');
const ui=fs.readFileSync('src/app-status-report-ui.js','utf8');
const lifecycle=fs.readFileSync('src/app-status-report-collaboration.js','utf8');

// New Draft freezes the previous report entries into the draft comparison baseline.
assert.match(lifecycle,/previousReportId:final\.id/);
assert.match(lifecycle,/previousEntries:clone\(final\.entries\|\|\[\]\)/);

// Authoring shows that immutable baseline above the new editable narrative fields.
assert.match(ui,/function previousEntryFor/);
assert.match(ui,/statusReportDraft\?\.previousEntries/);
assert.match(ui,/status-previous-context/);
assert.match(ui,/cell\.insertBefore\(box,textarea\)/);
assert.match(ui,/\['statusUpdate','achievements','issues'\]/);

// Live active Work Packages are shown to the author without becoming separate commentary fields.
assert.match(ui,/function liveActiveWorkPackages/);
assert.match(ui,/!\['Complete','Cancelled'\]\.includes/);
assert.match(ui,/Active Work Packages/);
assert.match(ui,/status-work-package-row/);
assert.doesNotMatch(ui,/data-status-field="workPackage/);

console.log('Status Report authoring context tests passed');
