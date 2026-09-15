# Target client architecture

This directory is the **strategic/canonical home for new AMO client code**. Issue #183 proved the shared shell and route-owned Demand architecture; #206 continues that migration across AMO. New routes use reusable presentation, pure domain/query services and Local/Remote-neutral client capability APIs.

## Status vocabulary

- **Canonical** — strategic implementation. Reuse and improve it at source; do not create a competing implementation.
- **Transitional adapter** — intentional anti-corruption boundary to the legacy runtime. Translate contracts only and remove it when the dependency migrates.
- **Test-only support** — code used solely to prove canonical behaviour deterministically. It must be reachable only through an explicit test bootstrap and must never become a production persistence fallback.
- **Legacy** — existing `src/app-*.js` global/render-wrapper code. Supported during strangler migration, not a template for new route code, and removed as each route cuts over.

Do not copy a legacy helper here merely to make a route self-contained. Extract stable behaviour deliberately, test it, and make the canonical library the source of truth.

## Dependency direction

```text
shell/shared UI
      ↓
workspace session / route page composition
      ↓
domain/query services
      ↓
canonical client capability APIs
      ↓
workspace-selected implementation
      ├── Local Workspace → client-side/local repository implementation
      └── Remote Workspace → backend HTTP API implementation
```

From the perspective of a route or domain service, workspace mode is an implementation detail. Consumers compose reusable capabilities such as Demand, Work Packages, People, Allocations, Actuals and Settings; they do not call Local filesystem APIs, Remote HTTP endpoints, MongoDB or legacy repository globals. Data access and business/query semantics remain separate concerns.

`client/data/capability-api.js` establishes this canonical contract. During the strangler migration it can adapt the existing Local and Remote `WorkspaceRepository` implementations; those implementations remain transitional infrastructure and are tracked for retirement by #215. Do not turn the earlier Demand-specific `loadDemandSlice()` gateway into a family of page-specific slice loaders. #208 migrates Demand itself onto the capability APIs after #207 proves the contracts independently.

`client/workspace/WorkspaceSession` is the canonical owner of route-level workspace continuity. It restores the same Local/Remote connection preference used by the application, rehydrates the remembered Local `FileSystemDirectoryHandle` from the existing IndexedDB store when permission is available, and exposes an explicit reconnect/change action when a user gesture is required. Future route-owned pages must reuse this capability rather than inventing route-specific workspace bootstrap logic.

Domain services must not depend on pages, DOM renderers or legacy global state. `client/testing/` is outside the production dependency chain and is selected only by explicit E2E bootstrap.

## Current migration map

| Capability | Target owner | State | Transitional / legacy implementation |
| --- | --- | --- | --- |
| Shared route shell | `client/shell/` | **Canonical** | `index.html`, `app-navigation.js`, shell mutation modules |
| Workspace continuity / Local-Remote selection | `client/workspace/workspace-session.js` + `workspace-state-store.js` | **Canonical** | `app-workspace-memory.js`, `app-remote-workspace.js` |
| Shared workspace selector UI | `client/workspace/workspace-switcher.js` | **Canonical** | mixed Workspace/topbar controls |
| Client capability data contracts | `client/data/capability-api.js` | **Canonical; introduced by #207** | existing Local/Remote `WorkspaceRepository` implementations currently provide the persistence seam |
| Demand migration gateway | `client/data/workspace-gateway.js` | **Transitional for Demand until #208** | Demand-specific `loadDemandSlice()` contract |
| Demand filter/query semantics | `client/domain/demand/demand-query-service.js` | **Canonical** | `app-commitment-health.js`, `app-2.js` filter composition |
| Demand management-control semantics | `client/domain/demand/demand-control-service.js` | **Canonical for `/demand`** | `app-commitment-health.js` |
| Demand organisational scope semantics | `client/domain/demand/demand-scope.js` | **Canonical for `/demand`** | mixed grid/global scope logic |
| Demand create/save record semantics | `client/domain/demand/demand-record.js` | **Canonical** | mixed page/global creation and validation behaviour |
| Azure DevOps Work Item context/link semantics | `client/domain/work-packages/work-item-reference.js` | **Canonical** | equivalent logic in `app-work-packages.js` |
| Work Package renderer/global state | future route/domain extraction | **Legacy until migrated** | `app-work-packages.js` |
| Legacy Demand repository bridge | `client/legacy/legacy-workspace-adapter.js` | **Transitional adapter until #208/#215** | Local/Remote repository globals |
| Deterministic browser workspace | `client/testing/local-test-workspace-gateway.js` | **Test-only support** | none; explicit `?e2e=1` only |
| `/demand` page | `client/pages/demand/` | **Canonical / primary Demand route** | superseded legacy Demand composition is removed progressively under #194 |

## Capability API proof

#207 is intentionally non-breaking: it introduces and certifies the capability APIs without moving `/demand` or another production route onto them. Focused contract tests run the same Demand, Work Package, People, Allocation, Actuals and Settings operations for Local and Remote modes. Path tests additionally execute those APIs through the real Local `WorkspaceRepository` against File System Access-shaped in-memory handles and through the real Remote `WorkspaceRepository` against an HTTP API test double. This proves both persistence paths without adding a test-only production fallback or requiring a deployed user journey for code that is not yet integrated into one.

#208 is the controlled Demand cutover. Once Demand consumes these APIs and parity is proven, its superseded `loadDemandSlice()` path can be removed.

## Demand proof

The local browser suite starts a fresh static test server and clean Playwright browser context, selects the test-only gateway explicitly, seeds a writable session workspace and verifies real `/demand` behaviour. It covers combined filters, visible parent counts, hierarchy, canonical Azure DevOps Work Item links, Team/Department scope, Actuals completeness controls, edit → save → reload, create → save → reload and a narrow mobile viewport. It runs with zero retries. This does not weaken production authentication or create an anonymous production write path.

The `/demand` bootstrap uses `WorkspaceSession` instead of hard-wiring Remote Workspace. If the main AMO application last used a remembered Local Workspace, `/demand` restores that same handle when browser permission remains granted, asks the user to reconnect it when a gesture is required, and never silently substitutes Remote Workspace for an explicit Local preference. Users can also switch between Local and Remote and change the remembered Local folder from the shared workspace switcher.

After a route cuts over, remove the superseded path rather than retaining two live implementations. #194 is the standing rule for that cleanup and #215 tracks the final transitional workspace/legacy-client retirement.
