# AMO deployed acceptance tests

These tests run against the deployed **Test** application rather than a local build. They use Cucumber/Gherkin for readable scenarios and Playwright/Chromium for browser automation.

## Where they run

On a push to `main`, the normal GitHub Actions workflow deploys the API and frontend to the `test-amo` environment. After both deployments succeed, an `Acceptance · Test` job runs on GitHub-hosted Ubuntu runners in two browser profiles:

- `desktop` — Chromium at 1440×1000
- `mobile` — Chromium at 390×844 with touch/mobile emulation

The durable `test-current` release marker moves only after both acceptance profiles pass. Manual Production promotion therefore continues to promote the last Test release that passed deployed acceptance tests.

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

## Adding scenarios

Add business-readable scenarios under `tests/e2e/features/` and reusable step definitions under `tests/e2e/steps/`. Keep scenarios focused on observable product behaviour. Prefer read-only tests unless a scenario has a deliberately isolated test-data lifecycle.

The initial suite proves deployment identity, client/backend/API version alignment, responsive navigation, single account rendering, and the absence of the retired global command menu. Natural next scenarios are Remote Workspace connection, stage/schema compatibility, Restore, scope changes, and a controlled edit/autosave journey.

Failures generate a Cucumber HTML report and a screenshot under `artifacts/`; GitHub Actions uploads these as workflow artifacts.
