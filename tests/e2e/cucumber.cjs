const retry=Number.parseInt(process.env.E2E_RETRY||'0',10);

module.exports = {
  default: {
    paths: ['tests/e2e/features/**/*.feature'],
    require: [
      'tests/e2e/support/**/*.cjs',
      'tests/e2e/steps/**/*.cjs'
    ],
    format: [
      'progress',
      'html:artifacts/cucumber-report.html'
    ],
    publishQuiet: true,
    parallel: 1,
    retry: Number.isFinite(retry)&&retry>0?retry:0
  }
};
