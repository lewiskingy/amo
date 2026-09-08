const fs=require('fs'),assert=require('assert');
const ui=fs.readFileSync('src/app-work-package-resource-planning.js','utf8');
const styles=fs.readFileSync('src/app-work-package-resource-planning.css','utf8');

assert.match(ui,/const SNAP_VALUES=\[0,10,20,40,60,80,100\]/,'Allocation level drag must retain the agreed working-week increments');
assert.match(ui,/pct=snapPercent\(raw\)/,'Vertical pointer movement must snap through the allocation increments');
assert.match(styles,/bottom:clamp\(6px,var\(--alloc-pct,0%\),calc\(100% - 6px\)\)/,'Drag circle must track the top edge of the allocation fill');
assert.match(styles,/border-radius:50%/,'Allocation level handle must be circular');
assert.match(styles,/cursor:ns-resize/,'Allocation level handle must advertise vertical dragging');

console.log('Work Package allocation level handle tests passed');
