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
assert.match(ui,/status-commentary-layout/);
assert.match(ui,/status-previous-slot/);
assert.match(ui,/layout\.append\(slot,textarea\)/);
assert.match(ui,/\['statusUpdate','achievements','issues'\]/);

// Previous commentary has a per-cell clipboard copy affordance and does not overwrite the draft field.
assert.match(ui,/function copyPreviousText/);
assert.match(ui,/navigator\.clipboard\?\.writeText/);
assert.match(ui,/status-copy-previous/);
assert.match(ui,/Copy previous text/);
assert.doesNotMatch(ui,/copyPreviousText\([^)]*\).*\.value\s*=/s);

// Draft commentary is bottom-aligned against a row-level previous-content slot.
assert.match(ui,/function alignCommentaryRow/);
assert.match(ui,/maxPrevious/);
assert.match(ui,/status-commentary-layout textarea\{margin-top:auto/);

// Live active Work Packages are shown to the author without becoming separate commentary fields.
assert.match(ui,/function liveActiveWorkPackages/);
assert.match(ui,/!\['Complete','Cancelled'\]\.includes/);
assert.match(ui,/Active Work Packages/);
assert.match(ui,/status-work-package-row/);
assert.doesNotMatch(ui,/data-status-field="workPackage/);

// Per-Demand Actuals commentary is deliberately absent from the Status Report authoring surface.
assert.doesNotMatch(ui,/decorateActualsEffort|status-effort-context|demandEffortMessage/);

console.log('Status Report authoring context tests passed');
