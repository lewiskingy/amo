# Target client architecture

This directory is the **strategic/canonical home for new AMO client code**. Code here implements issue #183: shared shell, route-owned pages, reusable presentation, pure domain/query services and persistence behind explicit gateway boundaries.

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
workspace gateway/repository contract
      ↓
transitional adapter (only where required)
      ↓
legacy Local/Remote repository implementation
```

`client/workspace/WorkspaceSession` is the canonical owner of route-level workspace continuity. It restores the same Local/Remote connection preference used by the legacy application, rehydrates the remembered Local `FileSystemDirectoryHandle` from the existing IndexedDB store when permission is available, and exposes an explicit reconnect/change action when a user gesture is required. Future route-owned pages such as `/allocations` and `/settings` must reuse this capability rather than inventing route-specific workspace bootstrap logic.

Domain services must not depend on pages, DOM renderers or legacy global state. `client/testing/` is outside the production dependency chain and is selected only by explicit E2E bootstrap.

## Current migration map

| Capability | Target owner | State | Legacy implementation |
| --- | --- | --- | --- |
| Shared route shell | `client/shell/` | **Canonical** | `index.html`, `app-navigation.js`, shell mutation modules |
| Workspace continuity / Local-Remote selection | `client/workspace/workspace-session.js` + `workspace-state-store.js` | **Canonical** | `app-workspace-memory.js`, `app-remote-workspace.js` |
| Shared workspace selector UI | `client/workspace/workspace-switcher.js` | **Canonical** | mixed Workspace/topbar controls |
| Demand filter/query semantics | `client/domain/demand/demand-query-service.js` | **Canonical** | `app-commitment-health.js`, `app-2.js` filter composition |
| Demand management-control semantics | `client/domain/demand/demand-control-service.js` | **Canonical for `/demand`** | `app-commitment-health.js` |
| Demand organisational scope semantics | `client/domain/demand/demand-scope.js` | **Canonical for `/demand`** | mixed grid/global scope logic |
| Demand create/save record semantics | `client/domain/demand/demand-record.js` | **Canonical** | mixed page/global creation and validation behaviour |
| Azure DevOps Work Item context/link semantics | `client/domain/work-packages/work-item-reference.js` | **Canonical** | equivalent logic in `app-work-packages.js` |
| Work Package renderer/global state | future route/domain extraction | **Legacy until migrated** | `app-work-packages.js` |
| Workspace access for route slices | `client/data/workspace-gateway.js` | **Canonical contract** | `app-workspace-repository*.js` |
| Legacy repository bridge | `client/legacy/legacy-workspace-adapter.js` | **Transitional adapter** | Local/Remote repository globals |
| Deterministic browser workspace | `client/testing/local-test-workspace-gateway.js` | **Test-only support** | none; explicit `?e2e=1` only |
| `/demand` page | `client/pages/demand/` | **Canonical dark launch** | legacy `#demand` plus renderer wrappers |

## Demand proof

The local browser suite starts a fresh static test server and clean Playwright browser context, selects the test-only gateway explicitly, seeds a writable session workspace and verifies real `/demand` behaviour. It covers combined filters, visible parent counts, hierarchy, canonical Azure DevOps Work Item links, Team/Department scope, Actuals completeness controls, edit → save → reload, create → save → reload and a narrow mobile viewport. It runs with zero retries. This does not weaken production authentication or create an anonymous production write path.

The Demand migration gateway exposes the latest available Actuals period as data to the canonical control service. The service derives Actuals completeness from due allocations and observed Actuals facts; page code does not consume `window.ReportingModel` or legacy CommitmentHealth globals.

The `/demand` bootstrap now uses `WorkspaceSession` instead of hard-wiring Remote Workspace. If the main AMO application last used a remembered Local Workspace, `/demand` restores that same handle when browser permission remains granted, asks the user to reconnect it when a gesture is required, and never silently substitutes Remote Workspace for an explicit Local preference. Users can also switch between Local and Remote and change the remembered Local folder from the shared workspace switcher.

The legacy implementation is not removed until replacement parity and acceptance coverage are complete. After cutover, remove the superseded path rather than retaining two live implementations.
