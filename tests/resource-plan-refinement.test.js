const fs=require('fs'),assert=require('assert');
const index=fs.readFileSync('src/index.html','utf8');
const resource=fs.readFileSync('src/app-resource-plan.js','utf8');
const planningUi=fs.readFileSync('src/app-planning-reporting-ui.js','utf8');
const planning=fs.readFileSync('src/app-planning-reporting.js','utf8');
const periods=fs.readFileSync('src/app-reporting-period-presentation.js','utf8');

// Resource Plan follows the management narrative: horizon -> insight -> people -> final WP detail.
const summary=index.indexOf('id="resourceSummaryTable"');
const insight=index.indexOf('class="card resource-management-panel"');
const utilisation=index.indexOf('id="resourceUtilTable"');
const detailHeading=index.indexOf('id="resourceAllocationDetailHeading"');
const detail=index.indexOf('id="resourceAllocationDetail"');
assert(summary>0&&summary<insight,'Monthly Capacity Position must be the first primary reporting block');
assert(insight<utilisation,'Consolidated management insight must precede Individual Utilisation');
assert(utilisation<detailHeading&&detailHeading<detail,'Work Package Resource Detail must remain the final drill-down');
assert.match(index,/Capacity &amp; management insight/);
assert.match(index,/Capacity &amp; recovery/);
assert.match(index,/id="resourceRecoveryWindowSummary"/,'Planning-window capacity/recovery totals belong inside the consolidated insight card');
assert.match(index,/id="resourceDemandSummary"/);
assert.match(index,/id="resourceSignals"/);
assert.match(index,/app-reporting-period-presentation\.js/,'Shared period presentation must load before Resource Plan rendering');

// The summary panel is semantic rather than duplicated top/bottom cards.
assert.match(resource,/Current utilisation/);
assert.match(resource,/Current reported value/);
assert.match(resource,/resourceDemandSummary/);
assert.match(resource,/mini-stat\$\{v\?' has-exception':' is-quiet'\}/,'Zero signals should be visually quiet and exceptions prominent');
assert.match(resource,/resource-management-flow/);
assert.match(resource,/@media\(max-width:760px\)/,'Management insight must stack responsively on mobile');
assert.match(planningUi,/function foldRecoverySummary\(\)/,'Legacy reporting-model recovery summary must be folded into the management insight rather than left as a separate card');
assert.match(planningUi,/source\.remove\(\)/);

// Demand planning rows privilege the human-readable title and never call an informational/warning row "within tolerance".
assert.match(planningUi,/<strong>\$\{esc\(c\.demand\.title\|\|'Untitled Demand'\)\}<\/strong><br><span class="muted">\$\{esc\(c\.demandId\)\}<\/span>/);
assert.match(planningUi,/signals\.find\(s=>s\.severity==='warning'\)\|\|signals\[0\]/);
assert.match(planning,/resource-vs-wp/);
assert.match(planning,/projected-vs-wp/);

// Individual utilisation is a row-grouped matrix: Person identity, then repeating measures across months.
assert.match(resource,/<th>Team member<\/th><th>Measure<\/th>/);
assert.match(resource,/rowspan="4"/,'Person identity should span the four utilisation measures');
for(const measure of ['Utilisation','FTE','Days','Signal'])assert.match(resource,new RegExp(`util-measure\\">${measure}<`));
assert.doesNotMatch(resource,/personForecast=/,'Routine Actual-vs-plan detail should not clutter every utilisation cell');
assert.match(resource,/utilisationSignal/,'Exception information remains available in a dedicated Signal row');

// Actual/Forecast banding and grouped span headers are shared reporting presentation conventions driven by ReportingModel.
assert.match(periods,/ReportingModel\?\.periodBasis/);
assert.match(periods,/function groups\(periods=\[\]\)/);
assert.match(periods,/function addGroupedHeader\(table,periods,fixedColumns\)/);
assert.match(periods,/ACTUALS/);
assert.match(periods,/FORECAST/);
assert.match(periods,/period-group-row/);
assert.match(periods,/period-actual/);
assert.match(periods,/period-forecast/);
assert.match(periods,/period-basis-boundary/);
assert.match(periods,/html\[data-theme="dark"\]/);
assert.match(resource,/const monthHead=m=>monthLabel\(m\)/,'Month headers should not repeat Actual/Forecast wording');
assert.match(resource,/decorateTable\?\.\(\$\('resourceSummaryTable'\),months,1\)/);
assert.match(resource,/decorateTable\?\.\(\$\('resourceUtilTable'\),months,2\)/);
assert.match(resource,/decorateTable\?\.\(\$\('resourceAllocationDetail'\),months,2\)/);

// Planning enhancement must preserve one explicit WP detail heading and use the shared period convention.
assert.match(planningUi,/resourceAllocationDetailHeading/);
assert.match(planningUi,/\(detailHeading\|\|detail\.closest\('\.table-wrap'\)\)\?\.before\(section\)/);
assert.doesNotMatch(planningUi,/previousElementSibling/,'Heading ownership must not depend on whichever section happens to precede the detail table');
assert.match(planningUi,/decorateTable\?\.\(detail,periods\(\),3\)/);
assert.doesNotMatch(planningUi,/ACTUAL AT DEMAND/,'Actual/Forecast wording should live in the shared spanning header, not repeat under every month');

// Actual periods may present observed Demand Actuals, but never invent Work Package Actual attribution.
assert.match(resource,/Actual at Demand/);
assert.match(planningUi,/Actual held at Demand/);
assert.doesNotMatch(resource,/Work Package Actual/i);
assert.doesNotMatch(planningUi,/Work Package Actual/i);

console.log('Resource Plan refinement tests passed');
