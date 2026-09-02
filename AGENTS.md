# AMO contributor and agent guidance

This repository is maintained by people and coding agents. Treat the deployed acceptance suite as part of the product contract, not as a separate testing afterthought.

## Definition of done

For every functional, UX, navigation, API, authentication, workspace, deployment or release change:

1. Review the relevant Gherkin scenarios under `tests/e2e/features/` before completing the change.
2. Decide whether the change alters behaviour already covered by acceptance tests or introduces behaviour important enough to protect with a new scenario.
3. Update the feature scenarios and reusable step definitions in the **same pull request** when expected behaviour changes. Do not knowingly merge a product change that leaves acceptance tests describing the old UI or contract.
4. Preserve the intent of existing tests. Fix the product when a test exposes a genuine regression; change a test only when the intended product behaviour has deliberately changed or the test itself is unreliable.
5. Keep scenarios business-readable and focused on observable behaviour. Avoid coupling tests to incidental implementation details where a stable user-facing assertion is available.
6. Consider both desktop and mobile behaviour. The deployed acceptance workflow runs both profiles and changes to shared navigation/shell behaviour must work in both.
7. Treat acceptance failures as release failures until understood. Do not simply increase timeouts or weaken assertions without identifying why the test failed.

## Acceptance suite

The deployed acceptance suite lives under `tests/e2e/` and uses Cucumber/Gherkin with Playwright. See `tests/e2e/README.md` for execution details and conventions.

Changes to acceptance tests are themselves product-maintenance changes: keep scenarios aligned with current terminology, navigation, contracts and supported workflows as the application evolves.

## Pull-request review check

Before considering a PR complete, explicitly ask:

> Have I reviewed the deployed acceptance scenarios affected by this change, and have I updated or added them where the intended observable behaviour changed?

If the answer is no, the change is not complete.
