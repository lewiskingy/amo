# Architecture Management Office (AMO)

AMO is a browser-based workspace for Architecture Defined Demand, Work Packages, People/capacity, resource planning, imported Actuals, roadmap planning and Status Reporting.

## Core responsibilities

- **SharePoint Front Door** — Raw Demand / intake source.
- **Azure DevOps / Jira** — detailed delivery backlog, scope, acceptance criteria and work tracking.
- **AMO** — Defined Demand, Work Package portfolio metadata, Budget Forecast, named-person Resource Plan, portfolio/resource reporting and Actuals reconciliation.
- **Architecture repositories** — formal Architecture knowledge and approved artefacts.

## Target architecture

This section is the canonical target architecture for the AMO browser client. Existing client code that uses global state, renderer wrapping, compatibility interception or DOM post-processing is **legacy implementation to be migrated**, not an alternative target. Migration detail belongs in the relevant issue/PR; when a target slice is proven and cut over, obsolete parallel implementations should be removed rather than retained as another architecture.

AMO remains **one product and one deployed client**. The target is a modular, route-based application with a shared shell and bounded route-owned application slices, not a collection of independently designed micro-frontends.

Top-level capabilities are progressively exposed as routes such as:

```text
/demand
/allocations
/people
/reports
```

Additional portfolio, resource and status capabilities should follow the same model as they migrate. Route modules may be loaded independently, but they share the same application shell, authentication/session, workspace connection, organisational scope, navigation and design system.

### Client layers and ownership

```text
Application shell
  Sidebar / navigation
  Page header
  Account / sign-on widget
  Workspace status
  Organisational scope
        ↓
Route-owned page
  e.g. DemandPage
        ↓
Page components
  e.g. DemandFilterBar
       DemandTable
       DemandRow / WorkPackageRows
       Demand editor/details
        ↓
Domain and query services
  Demand query/filter semantics
  Commitment/control semantics
  Work Package semantics
        ↓
Repository contracts
  WorkspaceRepository
  domain repositories/adapters where useful
        ↓
Local or Remote persistence
```

The page owns composition, not business rules or persistence. Domain/query modules own business semantics and expose testable operations. Repository abstractions own persistence capabilities. Presentation code must not depend on where data is stored.

### Shared shell and components

Common application concerns are reusable components with one canonical implementation. Expected shared components include:

- **AppShell** — overall route layout and shared application lifecycle;
- **Sidebar** — primary navigation;
- **PageHeader** — route title, contextual actions and shared header presentation;
- **AccountWidget** — sign-on/account presentation;
- **WorkspaceStatus** — current workspace/connectivity state;
- **ScopeSelector** — organisational Department/Team scope;
- reusable UI primitives such as **FilterBar**, **DataTable**, **Badge**, **SearchBox**, **Button** and **EmptyState**.

Route slices compose these components; they do not copy or locally override them.

### Route-owned slices

Each top-level route owns its page composition and feature-specific presentation. For example, the Demand slice owns `DemandPage`, `DemandFilterBar`, `DemandTable`, Demand rows, nested Work Package presentation and Demand editing. It does not own the global shell, persistence implementation or unrelated application features.

A representative target source structure is:

```text
src/client/
  shell/
    AppShell
    Sidebar
    PageHeader
    AccountWidget
    WorkspaceStatus
    ScopeSelector
  shared/
    components/
    routing/
    formatting/
  domain/
    demand/
    work-packages/
    allocations/
    people/
  pages/
    demand/
      DemandPage
      DemandFilterBar
      DemandTable
      DemandRow
      WorkPackageRows
    reports/
    allocations/
    people/
```

Exact filenames and implementation technology may evolve. The ownership boundaries and dependency direction are the architectural constraint.

### Design principles

- **Single responsibility** — shell, page composition, presentation, domain/query logic and persistence have distinct owners.
- **Dependency inversion** — page code consumes stable domain/repository interfaces rather than global `db`, storage details or renderer globals.
- **Explicit composition** — extend behaviour through component/service interfaces; do not patch, wrap or mutate unrelated renderers to alter a page.
- **One source of truth** — page state such as Demand filters has one owner and is passed explicitly to query and presentation layers.
- **Domain logic is reusable** — filtering, control-position and planning semantics are testable independently of DOM rendering.
- **Storage agnostic** — Local and Remote workspaces use the same client/domain behaviour through `WorkspaceRepository` capabilities.
- **Behaviour before redesign** — migration first reproduces the intended existing capability; UX changes can follow once parity is proven.
- **Remove superseded paths** — dark launch is temporary. After cutover, retire the replaced renderer, wrapper and compatibility code rather than maintaining parallel implementations.

### Migration and dark launch

The client is migrated using a strangler approach. **Demand (`/demand`) is the first proving slice.** It is built over the same workspace data and repository contracts, dark-launched alongside the legacy Demand view, and tested before primary navigation is switched to it.

A slice progresses through:

```text
route and components built
        ↓
behavioural parity over the same data
        ↓
local deterministic browser E2E
        ↓
deployed Test acceptance
        ↓
primary navigation cutover
        ↓
legacy implementation removed
```

Subsequent slices such as Allocations and People follow the same pattern. This is a migration sequence toward the architecture above, not a second target architecture.

### Test architecture

The target client architecture is supported by two complementary browser-test layers.

**Local E2E in CI** runs before deployment against a fresh application process and a transient seeded writable workspace. It must not require Azure, Mongo or an external identity provider. A test-only repository/bootstrap mechanism implements the same repository contract and is available only in explicit E2E mode. Tests exercise the real browser UI, including updates, save/reload persistence, filters, hierarchy and navigation.

```text
fresh test process
  → transient seeded workspace
  → local AMO client/server
  → clean Playwright browser context
  → exercise observable behaviour
  → reload to verify persistence where relevant
  → destroy workspace
```

**Deployed acceptance** remains the second layer for deployment identity, authentication, Remote Workspace/API integration and selected critical journeys against the deployed Test environment.

Tests should assert observable product behaviour rather than renderer implementation details. New route slices are not cut over until their important behaviour is protected by deterministic local E2E and appropriate deployed acceptance coverage.

The implementation and migration work for this target is tracked in GitHub issue **#183 — Target client architecture: modular route-owned application slices**.

## Planning model

AMO deliberately preserves each stage of planning knowledge:

```text
Initial Demand ROM
        ↓
Demand Budget Forecast
        ↓ compare
Work Package Estimate
        ↓ compare
Work Package Resource Plan
        ↓
Actual to date + remaining plan
        = Projected effort
```

These are different measures and do not overwrite one another.

### Initial ROM

The assessment-time baseline held on Demand.

### Budget Forecast

The current effort forecast for budgetary and portfolio-planning purposes. It is **not** an approved financial budget or authorisation to spend.

### Work Package Estimate

The delivery estimate for a Work Package. Demand WP Estimate is the sum of populated child estimates, with estimate coverage retained.

### Resource Plan

New named-person allocations are:

```text
Person × Work Package × Month
```

Each allocation retains its parent `demandId`. Demand Resource Plan totals are derived by rolling up child Work Package allocations.

Existing records without Work Package identity are explicit **legacy / undecomposed allocations**. They remain reportable during migration and must be assigned explicitly; AMO never guesses the Work Package.

Allocation percentages are fractions of Person available FTE:

```text
Forecast FTE = allocation fraction × Person FTE
Forecast days = Forecast FTE × working days
Forecast cost = Forecast days × Person Role day rate
```

## Actuals

Oracle Actuals remain observed facts at Demand/Project level:

```text
fact.projectNumber -> Demand.projectNumber
fact.staffNumber   -> Person.staffNumber
```

Imported `actualHours` and `actualCostGbp` are authoritative. AMO does not infer Work-Package-level Actuals.

For an imported period, Actuals are the reported value; otherwise Allocation Forecast is used. Allocation Forecast remains visible as the planning baseline.

Across the reporting horizon:

```text
Actual to date + remaining Allocation Forecast = Projected effort / cost
```

Projected effort is compared with Budget Forecast using language such as **above Budget Forecast**, not “over budget”.

## Defined Demand

Defined Demand is the parent portfolio boundary. A new record requires only Title and Business Area; lifecycle state is defaulted.

Demand may hold Initiative, Owning Team, Priority, Initial ROM, Budget Forecast, Architecture Owner, Project Number, Health, Summary / Context and Front Door source/reference.

Demand does not own current Architecture Service, delivery dates, detailed delivery scope or Work Package delivery status.

## Work Packages

Work Packages are nested beneath Defined Demand and hold:

- title;
- Architecture Service;
- delivery Status;
- Estimated Effort;
- Target Start / End;
- delivery-backlog work-item reference.

Detailed scope and acceptance criteria remain in the delivery backlog.

## Allocations

The canonical resource-planning path is:

```text
Demand
  ↓
Work Package
  ↓
Person
  ↓
Monthly allocation
```

New allocations can only be created from a Work Package. The Allocations view shows Demand planning context, child Work Package Estimate/Resource Plan totals and transitional undecomposed allocation records.

## Resource Plan

Resource Plan remains the capacity/resource-owner reporting surface. It shows:

- available capacity;
- Actual/Forecast basis by month;
- Person utilisation;
- capacity/recovery context;
- Demand planning position: ROM → Budget Forecast → WP Estimate → Resource Plan → Actual/Projected;
- Work-Package-aware resource detail.

For Actual periods, Work Package rows retain the plan but explicitly state that Actuals are held at the parent Demand.

## Management signals

AMO surfaces observable planning conditions including:

- missing Budget Forecast;
- incomplete WP estimate coverage;
- material WP Estimate variance against Budget Forecast;
- material Resource Plan variance against Budget Forecast;
- material Projected variance against Budget Forecast;
- legacy undecomposed allocation.

These are management prompts, not accounting assertions.

Dashboard reuses the same planning signals in its Attention Required surface.

## Roadmap

Roadmap is temporal. Delivery windows are derived from Work Package dates. The resource line is the roll-up of Work Package Resource Plan allocations to parent Demand; legacy undecomposed allocation contributes only during transition.

## Status Reporting

Status Reporting remains narrative/Health focused. The live table shows concise planning position alongside narrative fields.

Preview/Published snapshots persist report-time planning context as well as Work Package-derived service context, so historical reports remain immutable evidence and do not read current live planning values later.

Older snapshots without the newer planning context remain readable.

## Financial semantics

- Initial ROM, Budget Forecast and Work Package Estimate may use the configured blended/default day rate for indicative valuation.
- Named Resource Plan Forecast uses Person Role day rates, with blended/default fallback.
- Imported Oracle Actual cost remains authoritative.

Indicative Budget Forecast value must never be presented as an approved accounting budget.

## Organisation scope

People follow Home Team. Demand follows Owning Team. Resource/delivery reporting follows Demand scope while still showing borrowed contributors correctly.

## Workspace data

Typical workspace entities include:

```text
config/
demand/
work-packages/
team/
allocations/
actuals/
ideas/
status-reports/
backups/
archive/
```

## Day-to-day sequence

1. Receive Raw Demand through Front Door.
2. Decide whether it belongs to existing Defined Demand.
3. Create/amend Defined Demand and establish ROM/Budget Forecast as understanding matures.
4. Decompose delivery into Work Packages.
5. Estimate Work Packages.
6. Allocate named People to Work Packages by month.
7. Review Budget Forecast → WP Estimate → Resource Plan comparisons.
8. Import Oracle Actuals and review Actual + remaining plan = Projected position.
9. Maintain narrative/Health Status Reporting and publish immutable snapshots.
10. Archive terminal work when appropriate.

Detailed guidance is in `DemandWorkManagement.md.txt`, `ActualsReporting.md.txt`, `WorkPackages.md.txt`, `ReportingRefinementPlan.md.txt` and `StatusReporting.md.txt`.
