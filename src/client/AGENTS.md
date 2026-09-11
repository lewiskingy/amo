# Target-client contributor guidance

This file applies to `src/client/**` and complements the repository-level `AGENTS.md`.

`src/client/` is the strategic client architecture introduced by issue #183. Treat modules here as **canonical unless they are explicitly located under `src/client/legacy/` or documented as transitional**.

## Canonical code

Canonical modules are intended to survive the strangler migration. Contributors should:

- reuse and improve the owning canonical module rather than copy its behaviour into a page or another helper;
- keep domain/query modules independent of DOM rendering and storage implementation;
- keep page modules responsible for page composition rather than business rules;
- keep shared shell/components free of route-specific business behaviour;
- depend on `WorkspaceGateway` or a more specific canonical contract rather than browser/storage globals;
- add or strengthen tests when extending canonical behaviour.

If a canonical abstraction proves wrong, refactor it at source. Do not route around it with a second implementation.

## Transitional adapters

Only `src/client/legacy/` may intentionally depend on the mixed-purpose/global legacy runtime. These modules are anti-corruption adapters, not strategic libraries.

- Keep adapters narrow: translate contracts; do not accumulate business rules or presentation logic.
- Mark the legacy dependency and removal condition in the source.
- Do not make canonical domain/page modules import legacy modules directly.
- When the underlying capability is extracted into a canonical implementation, remove the adapter path rather than retaining both.

## Legacy code during strangler migration

Existing `src/app-*.js` modules remain supported until their owning route is cut over. They are **not** a source pattern for new target-client code. Avoid adding new cross-cutting wrappers, renderer interception or global mutations to support the new route.

Where stable business semantics currently exist only in legacy code, extract them deliberately into a canonical domain/service module and protect the new owner with tests. During parity work, the legacy page may continue consuming its old implementation; after route cutover, reconcile/remove the superseded implementation so the rule has one owner.

## Route completion

A route is not fully migrated merely because a new page exists. Before primary navigation cuts over:

1. intended behaviour is reproduced over the same workspace data;
2. canonical domain/query behaviour has focused tests;
3. deterministic local browser E2E covers core behaviour and persistence;
4. deployed acceptance covers release/integration smoke journeys;
5. repository documentation and the migration map identify the canonical owner;
6. once cut over, obsolete legacy renderers/wrappers for that route are removed.

Dark-launch coexistence is therefore temporary by design, not permission to maintain two permanent implementations.
