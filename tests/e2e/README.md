# AMO deployed acceptance tests

These tests run against the deployed **Test** application rather than a local build. They use Cucumber/Gherkin for readable scenarios and Playwright/Chromium for browser automation.

## Where they run

On a push to `main`, the normal GitHub Actions workflow deploys the API and frontend to the `test-amo` environment. After both deployments succeed, an `Acceptance · Test` job runs on GitHub-hosted Ubuntu runners in two browser profiles:

- `desktop` — Chromium at 1440×1000
- `mobile` — Chromium at 390×844 with touch/mobile emulation

The durable `test-current` release marker moves only after both acceptance profiles pass. Manual Production promotion therefore continues to promote the last Test release that passed deployed acceptance tests.

## Acceptance tests are part of the change

The acceptance suite is part of AMO's product contract and must be reviewed whenever observable application behaviour changes. Functional, UX, navigation, API, authentication, workspace, deployment and release changes should not be considered complete until their impact on `tests/e2e/` has been assessed.

When a change deliberately alters behaviour already covered by a scenario, update that scenario and its step definitions in the **same pull request**. Add a scenario when new behaviour is important enough to protect against regression. Do not leave the suite describing the old product and wait for the post-deployment run to discover the mismatch.

When a test fails, first determine whether it has exposed a genuine product regression, an intentional change in expected behaviour, or a test reliability problem. Preserve the behavioural intent of the test: do not weaken assertions or increase timeouts merely to obtain a green build.

Because the deployed suite runs desktop and mobile profiles, changes to shared shell, navigation and responsive behaviour must be considered in both contexts.

## Environment supplied by GitHub Actions

The runner uses the existing `test-amo` environment variables:

- `AMO_WEB_ORIGIN` → `E2E_BASE_URL`
- `AMO_API_HOSTNAME` → `E2E_API_BASE_URL`

Expected client and backend versions are derived from the checked-out release source. No test-specific secrets are required by the initial unauthenticated scenarios.

## Run locally

Install dependencies and Chromium once:

```bash
npm install
npx playwright install chromium
```

Then provide the Test endpoints and expected versions:

```bash
E2E_BASE_URL=https://amo-test.example.com \
E2E_API_BASE_URL=https://api.amo-test.example.com \
E2E_EXPECTED_CLIENT_VERSION=1.1.0 \
E2E_EXPECTED_BACKEND_VERSION=0.3.0 \
E2E_EXPECTED_API_VERSION=2 \
E2E_PROFILE=desktop \
npm run test:e2e
```

Set `E2E_PROFILE=mobile` for the mobile shell run.

## Adding and maintaining scenarios

Add business-readable scenarios under `tests/e2e/features/` and reusable step definitions under `tests/e2e/steps/`. Keep scenarios focused on observable product behaviour. Prefer read-only tests unless a scenario has a deliberately isolated test-data lifecycle.

During every relevant product change, review existing scenarios for terminology, selectors, navigation assumptions, API contracts and expected behaviour that the change affects. Update them alongside the implementation rather than as a follow-up after deployment.

The suite currently proves deployment identity, client/backend/API version alignment, responsive navigation, account rendering, Users & Access integration and other release-critical behaviour. Continue extending it around stable, valuable user journeys as AMO evolves.

Failures generate a Cucumber HTML report and a screenshot under `artifacts/`; GitHub Actions uploads these as workflow artifacts.
