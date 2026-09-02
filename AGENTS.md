# AMO contributor and agent guidance

This repository is maintained by people and coding agents. A change is not complete merely because the new behaviour works. It must leave the canonical code, tests and documentation describing that behaviour consistently, without introducing unnecessary duplicate implementations, rules or documentation.

The aim is to evolve AMO coherently: prefer extending or improving the existing design over layering new behaviour beside or on top of it.

## Core contribution principles

### Understand before changing

Before implementing a change:

1. Identify the existing code that owns the behaviour.
2. Search for related helpers, rules, constants, UI patterns, tests and documentation before creating new ones.
3. Understand whether apparently separate implementations are intentional or are historical duplication/patching.
4. Prefer the existing project terminology and concepts unless the change deliberately changes them.

Do not assume that the easiest place to add code is the correct place to own the behaviour.

### Prefer one canonical implementation

Prefer changing or extending the existing owning implementation over creating a parallel implementation, wrapper, override, compatibility layer or second source of truth.

Reuse existing helpers and rules where they express the same concept. If two pieces of code perform substantially the same responsibility, first consider whether the behaviour should be shared or consolidated rather than copied.

Do not introduce duplicate constants, business rules, transformation logic, UI behaviour or documentation simply to keep a change locally isolated.

### Refactor related duplication when you encounter it

AMO has evolved incrementally and some areas contain patch, fix, polish or override layers. These can be useful tactically, but they should not become the default way the application evolves.

When making a change in an area that already contains parallel, duplicated, patched or overriding implementations:

- prefer folding the affected behaviour back into the canonical owning module when the relationship is understood, the refactor is directly related to the change, and existing or added tests can demonstrate that behaviour is preserved;
- remove the superseded implementation when it is no longer needed rather than leaving both paths in place;
- avoid adding another patch or override layer merely because changing the underlying implementation is less convenient;
- consider whether a touched `fix`, `patch`, `polish`, compatibility or mutation layer can now be simplified or absorbed into the main implementation;
- keep the refactor proportionate. Do not turn a focused product change into an unrelated rewrite or restructure code whose behaviour is not sufficiently understood.

The practical rule is: **when existing technical debt is directly in the path of the change, prefer resolving the relevant debt rather than adding another layer to it, provided this can be done safely and verified within the same change.**

If consolidation would materially increase risk or scope, leave the existing structure intact, do not make it worse, and make the remaining debt explicit in the pull-request description or follow-up work.

### Keep concerns with their owner

New behaviour should live with the module or component responsible for that capability. Avoid introducing cross-cutting mutations from unrelated files when the owning implementation can reasonably be changed.

A narrowly scoped new module is appropriate when it represents a genuine new responsibility or clearly separates an existing responsibility. A new file should not exist solely to override behaviour that could safely be maintained at its source.

## Tests are part of the product contract

Treat tests as part of the change, not as testing work performed afterwards.

For every functional, UX, navigation, API, authentication, workspace, deployment or release change:

1. Review the relevant existing tests before completing the change.
2. Decide whether the change alters behaviour already covered by tests or introduces behaviour important enough to protect with a new test.
3. Update tests in the **same pull request** when intended behaviour changes. Do not knowingly merge code while leaving tests describing the old behaviour or contract.
4. Preserve the intent of existing tests. Fix the product when a test exposes a genuine regression; change a test only when intended product behaviour has deliberately changed or the test itself is unreliable.
5. Prefer the lowest appropriate test for the behaviour. Use deployed acceptance tests for stable observable journeys and release contracts; use more focused tests where logic can be protected below the browser journey as the test suite evolves.
6. Treat unexplained failures as failures of the change. Do not simply increase timeouts, weaken assertions or remove coverage to obtain a green build.

### Deployed acceptance suite

The deployed acceptance suite lives under `tests/e2e/` and uses Cucumber/Gherkin with Playwright. See `tests/e2e/README.md` for execution details and conventions.

For changes affecting observable application behaviour:

1. Review the relevant Gherkin scenarios under `tests/e2e/features/`.
2. Update feature scenarios and reusable step definitions in the **same pull request** when expected observable behaviour changes.
3. Keep scenarios business-readable and focused on observable behaviour. Avoid coupling tests to incidental implementation details where a stable user-facing assertion is available.
4. Consider both desktop and mobile behaviour. The deployed acceptance workflow runs both profiles and changes to shared navigation or shell behaviour must work in both.
5. Treat acceptance failures as release failures until understood.

Changes to acceptance tests are themselves product-maintenance changes: keep scenarios aligned with current terminology, navigation, contracts and supported workflows as the application evolves.

## Documentation is part of the change

When behaviour, terminology, workflow, data shape, configuration, deployment or operation changes, assess the affected documentation in the same pull request.

The canonical application/user and technical guide is `src/docs/AMO-README.md.txt`. Release and environment behaviour is documented under `.github/`, including `.github/RELEASES.md`. Test-specific execution guidance belongs with the relevant test suite, such as `tests/e2e/README.md`.

Keep documentation aligned with the implemented product. Do not leave instructions describing UI, workflows, fields, contracts, deployment behaviour or terminology that the change has made obsolete.

### Avoid documentation duplication

Prefer one canonical source for substantive documentation content. Where the same content must appear in more than one surface, prefer rendering, generating, embedding or otherwise deriving it from the canonical source rather than maintaining independent copies by hand.

Do not introduce a second copy of documentation with a comment telling future contributors to keep the copies aligned unless there is a genuine technical constraint and the duplication is unavoidable. Where existing duplicated documentation is touched, consider whether the duplication can be removed as part of the change.

## Keep terminology and contracts aligned

AMO domain terms, UI labels, data contracts, tests and documentation should describe the same concepts consistently.

When changing a term or contract, search across the repository for its other representations. Update affected code, test scenarios, fixtures, API behaviour and documentation together where appropriate.

Do not casually rename stable identifiers or persisted data fields merely to align display wording. Distinguish deliberate user-facing terminology changes from storage/API compatibility requirements.

## Scope and proportionality

Consistency does not require unnecessary rewrites.

Refactor when it reduces duplication or removes a patch directly related to the work being changed and the result can be verified safely. Avoid opportunistic restructuring of unrelated areas, broad stylistic churn, or speculative abstraction without a concrete reuse or maintenance benefit.

A good change should leave the touched area simpler, clearer or at least no more complex than necessary.

## Definition of done

Before considering a change complete, explicitly check:

- **Canonical implementation:** Have I changed the existing owner of this behaviour rather than creating an unnecessary parallel, override or patch implementation?
- **Refactoring:** If I encountered related duplication or patch layering, could it safely be consolidated as part of this change? If so, have I done that and removed superseded code?
- **Reuse:** Have I searched for and reused existing helpers, rules, constants and patterns rather than duplicating them?
- **Tests:** Have I reviewed the tests affected by this change and updated or added the appropriate coverage where intended behaviour changed?
- **Acceptance:** Have I reviewed the deployed acceptance scenarios affected by observable product changes and updated or added them where appropriate?
- **Documentation:** Have I reviewed and updated the canonical user, technical, test and release documentation affected by the change?
- **Consistency:** Do code, tests, UI terminology, persisted/API contracts and documentation describe the same intended behaviour?
- **Cleanup:** Have I removed code, tests or documentation made obsolete by the change rather than leaving competing paths behind?
- **Proportionality:** Have I improved the touched area without expanding the change into unrelated refactoring?

If a relevant answer is no, the change is not complete unless there is a clear reason documented in the pull request.

## Pull-request review

Reviewers should assess maintainability and coherence as well as functional correctness.

In particular, look for:

- new files that override or patch behaviour owned elsewhere;
- duplicated helpers, business rules, constants, UI patterns or documentation;
- old paths left active after replacement behaviour has been introduced;
- tests changed to accommodate regressions rather than intentional product changes;
- behaviour changed without corresponding test or documentation assessment;
- terminology or contracts that have drifted between code, tests and documentation;
- refactoring that has grown substantially beyond the area required for the product change.

Passing tests are necessary, but are not by themselves evidence that the change is coherent or maintainable.
