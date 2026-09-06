# Architecture Management Office (AMO)

Architecture Management Office is a browser-based workspace for managing Architecture Defined Demand, Work Packages, People, capacity, allocations, imported Actuals, roadmap planning, status reporting and improvement ideas. Active data is stored as folder-backed JSON and can be used through Local or Remote workspaces.

This is the general user guide. More detailed guidance is maintained in:

- `DemandWorkManagement.md.txt` — Raw Demand → Triage → Defined Demand → Work Packages → Allocations/Actuals;
- `ActualsReporting.md.txt` — Oracle Actuals, FTE/cost and reporting semantics;
- `StatusReporting.md.txt` — Draft/Published/Final reporting lifecycle;
- `ReportingRefinementPlan.md.txt` — implemented reporting semantics;
- `ArchitectureProcess.html` — wider Architecture operating process.

## What AMO manages

AMO deliberately avoids duplicating the source systems around it.

- **SharePoint Front Door** owns the originating Raw Demand/intake record.
- **Azure DevOps** owns triage/backlog execution, detailed Work Package scope, acceptance criteria and delivery work tracking.
- **AMO** owns Defined Demand, Work Package portfolio metadata, People/capacity, Allocations, portfolio/resource reporting and Actuals reconciliation.
- **Architecture repositories** own formal Architecture knowledge and approved artefacts.

The central AMO concepts are:

- **Department / Teams** — the organisation hierarchy used for portfolio scope.
- **People** — Architecture team members with Home Team, Role, Staff Number, FTE and active state.
- **Defined Demand** — a recognised body of Architecture work managed as the portfolio boundary. The persisted entity remains `Demand`.
- **Work Package** — a delivery tranche beneath Defined Demand containing the AMO metadata needed for delivery visibility.
- **Allocation** — planned Person capacity against Defined Demand by month.
- **Actuals** — observed Oracle effort/cost reconciled to Defined Demand through Project Number and to People through Staff Number.
- **Status Reports** — one collaborative working cycle plus immutable Published/Final snapshots.
- **Ideas** — an improvement backlog for AMO itself.

A Person has a **Home Team** while Defined Demand has an **Owning Team**. A Person can therefore contribute to Demand owned by another Team without moving either record organisationally.

## Defined Demand

A new Defined Demand is intentionally lightweight. Only **Title** and **Business Area** are user-mandatory at creation; Demand State defaults to the configured initial state, normally Assessing.

As understanding matures, Demand can also carry:

- Initiative;
- Owning Team;
- Priority;
- Initial Size and snapshotted Initial ROM days;
- Architecture Owner;
- optional Oracle Project Number;
- Health;
- Summary / Context;
- Front Door source/reference.

Defined Demand does **not** own current Architecture Service, detailed delivery scope, delivery dates, refined delivery estimate or Azure DevOps work-item relationship. Those delivery concerns belong to child Work Packages.

Project Number is optional. It is the Oracle accounting/reconciliation reference where work is charged through a Project. Legacy Cost Centre / Project Code is retired and is not used for Actuals reconciliation.

## Work Packages

Work Packages are managed as nested child rows beneath Defined Demand in the Demand Register.

AMO stores:

- Title;
- Architecture Service;
- Work Package Status;
- Estimated Effort (days);
- Target Start / Target End;
- Azure DevOps Work Item Reference.

Detailed Work Package description/scope and acceptance criteria remain in Azure DevOps or the authoritative delivery backlog and are not duplicated in AMO.

A single Defined Demand can contain Work Packages for different Architecture Services, so AMO does not manufacture a single Demand-level Service.

## Initial ROM, estimate, forecast and Actuals

Reporting deliberately preserves different stages of knowledge:

```text
Initial Demand ROM
        ↓
Work Package Estimate
        ↓
Allocation Forecast
        ↓
Actual Effort / Cost
```

They are not interchangeable.

- **Initial ROM** preserves the early assessment expectation. T-shirt-size defaults are snapshotted onto the Demand so later Config changes do not silently rewrite existing ROMs.
- **Work Package Estimate** is the sum of populated child package estimates. Reporting also shows estimate coverage so partial decomposition is visible.
- **Allocation Forecast** is the named resource plan and can be created before every Work Package has been decomposed.
- **Actuals** are observed Oracle facts.

Across a reporting horizon:

```text
Actual to date + remaining Allocation Forecast = Projected effort / cost
```

Projected resource effort is not the same as Work Package Estimate.

## Allocation FTE semantics

Allocation values are percentages/fractions of the Person's available FTE rather than absolute FTE values.

```text
Forecast FTE = allocation fraction × Person FTE
```

For example, a 100% allocation for a 0.8 FTE Person contributes 0.8 FTE.

Forecast effort/cost is then:

```text
Forecast days = Forecast FTE × working days in month
Forecast cost = Forecast days × Person Role day rate
```

If the Person's Role has no usable day rate, reporting falls back to the configured Default / blended day rate.

## Actuals and financial semantics

Import Oracle Actuals through **Admin → Actuals**. Oracle `People #` / `Person #` matches AMO `staffNumber`; Project Number maps Actuals to Defined Demand.

Only aggregated Actuals facts are stored. Imported `actualHours` and `actualCostGbp` are authoritative observations.

- Actual days = Actual hours ÷ configured Standard working hours per day.
- Actual FTE = Actual hours ÷ full-time working hours for the month.
- Actual cost/recovery = imported Oracle Cost in GBP.

AMO does **not** recalculate Actual cost using Role rates.

For a reporting month, imported Actuals win when that Actuals period exists. Allocation remains the planning baseline for variance comparison and remains the reported source for non-imported/future months.

AMO does not infer Work-Package-level Actuals where Oracle only provides Project/Demand-level facts.

## Reporting assumptions

The Reporting assumptions in Config contain:

- **Standard working hours per day** — used to convert Actual hours into effort days/FTE;
- **Default / blended day rate (£)** — used for Initial ROM and Work Package estimate valuation and as the fallback where a named Person's Role has no rate.

Initial ROM/WP £ values are indicative because no named resource mix is known. Named Allocation Forecast uses actual configured Role mix. Oracle Actual £ remains authoritative.

## Resource Plan

Resource Plan is the primary capacity/resource-owner view. It is read-only management reporting over People, Allocation Forecast and Actuals.

It shows:

- available capacity in FTE with days/£ context;
- Actual or Forecast reported effort by month;
- remaining/over capacity and utilisation;
- Person-level utilisation and Actual-versus-plan signals;
- allocation detail showing both allocation percentage and FTE-scaled equivalent;
- capacity value, forecast recovery and Actual recovery context;
- unmet Demand and reconciliation/management signals.

Management signals distinguish No Actuals against plan, Low overall effort, Effort redirected, Unplanned Demand effort, Over capacity and Unmapped project facts. AMO reports observable patterns; Status commentary is where the business reason is recorded.

## Dashboard

Dashboard remains a concise portfolio answer surface rather than a duplicate Resource Plan. It shows active/unallocated Demand, capacity position and attention signals with Department/Team scoping.

Capacity calculations use the same canonical Reporting Model as Resource Plan, including Person-FTE scaling for allocations.

## Roadmap

Roadmap is deliberately temporal.

- the delivery window is derived from the earliest Work Package Target Start and latest Work Package Target End;
- the resource window is derived from Allocations against the parent Defined Demand.

Legacy authored Demand delivery dates are not operationalised and Roadmap does not become a finance table.

## Status Reporting

The live Status Report page is a narrative/Health authoring surface, not another Dashboard. It helps contributors identify Demand needing meaningful updates and capture Status Update, Achievements, Issues/Escalations and Health.

New report snapshots derive Architecture Service context from child Work Packages and persist it as `services[]`. There is no current Demand Service column/filter. The report renderer continues to understand older immutable snapshots that contain a legacy singular `service` value.

Preview/Published reports carry concise immutable portfolio/capacity context plus Demand-level effort signals and narrative. They do not recreate detailed Resource Plan financial tables.

The lifecycle is **Draft → Published → Final**. Published/Final reports are immutable evidence snapshots. See `StatusReporting.md.txt` for collaboration, scope, preview and lifecycle details.

## Team / organisation scope

The organisation hierarchy controls reporting scope:

- Demand follows its Owning Team;
- People follow Home Team;
- Allocation/delivery reporting follows the related Demand portfolio;
- Dashboard, Roadmap and Status Reporting use the same organisational hierarchy.

This makes cross-team contribution visible without moving workforce or Demand ownership incorrectly.

## Workspace and persistence

A typical workspace contains:

```text
workspace-root/
  workspace.json
  config/
    settings.json
  demand/
    DEM-....json
  work-packages/
    WP-....json
  team/
    USR-....json
  allocations/
    ALLOC-....json
  actuals/
    manifest.json
    YYYY-MM.json
  ideas/
    IDEA-....json
  status-reports/
    draft.json
    SR-....json
  backups/
  archive/
```

Committed changes are dirty-tracked and autosaved. The Workspace page exposes storage/backup state.

## Backups and archive

Opening a workspace creates a timestamped safety snapshot. Retention keeps every backup taken today, one per recent day within the configured recent window and representative older monthly backups.

Terminal Demand can be moved from the active dataset into archive once it has been terminal for the configured/archive threshold. Related active Allocations are archived with it so orphaned active allocation records are not left behind.

Published Status Reports are already immutable historical records and are not unnecessarily duplicated into every safety snapshot.

## Multi-user editing

Multiple users may open/read a workspace. AMO uses cooperative locking and newer resource-specific commit/conflict checks for shared edits. Simply opening the workspace does not take the long-lived edit lock.

This is appropriate for the tactical folder datastore but is not equivalent to a transactional database. Remote workspaces preserve the same application-level concurrency semantics through server endpoints.

## External links and AMO Assistant

Demand Source links back to the Front Door item. Azure DevOps linkage belongs on Work Packages rather than Demand.

AMO Assistant is optional and appears only where configured. It is a supporting interaction layer, not a system of record; AMO, SharePoint, Azure DevOps and Architecture repositories remain authoritative for their respective data.

## Day-to-day operating sequence

A typical working sequence is:

1. Receive Raw Demand through the Front Door.
2. Triage fit, priority, approximate size and whether the request belongs to existing Defined Demand.
3. Create/amend Defined Demand as the managed portfolio boundary.
4. Create Work Packages as delivery tranches and link them to Azure DevOps work items.
5. Adjust Demand-level Allocations to represent the resource plan.
6. Use Dashboard/Resource Plan/Roadmap to manage portfolio, capacity and schedule.
7. Import Oracle Actuals and reconcile through Staff Number + Project Number.
8. Review Initial ROM, WP Estimate, Forecast and Actual/Projected position without conflating them.
9. Maintain and publish Status Reporting narrative/Health.
10. Allow completed/terminal work to leave the active set through archive rather than cluttering operational views indefinitely.

This keeps AMO focused on Architecture portfolio/resource management while the surrounding source systems retain the process and delivery information they own.
