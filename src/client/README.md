# Target client architecture

This directory is the **strategic/canonical home for new AMO client code**. Code here implements the target architecture from issue #183: a shared application shell, route-owned page slices, reusable presentation components, pure domain/query services and persistence behind explicit repository/gateway boundaries.

## Status vocabulary

Every client library should be treated as one of these states:

- **Canonical** — strategic implementation. Reuse it, improve it at source, and add tests here rather than creating a competing implementation.
- **Transitional adapter** — an intentional anti-corruption boundary between canonical code and the legacy client/runtime. Keep the boundary narrow and remove the adapter when the dependency has migrated.
- **Legacy** — existing `src/app-*.js` global/render-wrapper code outside this directory. It remains supported during the strangler migration but is not a template for new route code and is marked for decommissioning as each route cuts over.

Do not copy a legacy helper into this directory merely to make a route self-contained. Extract stable domain behaviour deliberately, add a contract test, then make the canonical library the source of truth.

## Dependency direction

```text
shell/shared UI
      ↓
route page composition
      ↓
domain/query services
      ↓
workspace gateway/repository contract
      ↓
transitional adapter (only where required)
      ↓
legacy Local/Remote repository implementation
```

Dependencies must not point back from domain services into pages, DOM renderers or legacy global state.

## Current migration map

| Capability | Target owner | State | Legacy implementation |
| --- | --- | --- | --- |
| Shared route shell | `client/shell/` | Canonical | `index.html`, `app-navigation.js`, shell mutation modules |
| Demand filter/query semantics | `client/domain/demand/` | Canonical | `app-commitment-health.js`, `app-2.js` filter composition |
| Work Package selection/presentation semantics used by Demand | `client/domain/work-packages/` | Canonical for `/demand` | `app-work-packages.js` renderer/global state |
| Workspace access for route slices | `client/data/workspace-gateway.js` | Canonical contract | `app-workspace-repository*.js` |
| Legacy repository bridge | `client/legacy/legacy-workspace-adapter.js` | Transitional adapter | Local/Remote repository globals |
| `/demand` page | `client/pages/demand/` | Canonical dark launch | legacy `#demand` in `index.html` plus renderer wrappers |

The legacy implementation is not removed until the replacement route has parity and acceptance coverage. After cutover, remove the superseded path rather than retaining two live implementations.
