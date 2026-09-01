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
    retry: 0
  }
};
