/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable quotes */

export type Annotation = any;
export type Metadata = unknown;
export type TestStatus = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
export type FullConfig = {
  configFile: string;
  version: string;
  rootDir: string;
  forbidOnly: unknown;
  fullyParallel: unknown;
  globalSetup?: unknown;
  globalTeardown?: unknown;
  globalTimeout?: unknown;
  grep: string | RegExp | (string | RegExp)[];
  grepInvert: string | RegExp | (string | RegExp)[] | null;
  maxFailures?: unknown;
  metadata: Metadata;
  preserveOutput?: unknown;
  projects: FullProject[];
  quiet?: unknown;
  reporter: unknown[];
  reportSlowTests?: unknown;
  shard?: unknown;
  updateSnapshots?: unknown;
  webServer?: unknown;
  workers?: number;
};
export type FullProject = {
  name: string;
  testDir: string;
  metadata: Metadata;
  outputDir: string;
  teardown?: string;
  dependencies: string[];
  testIgnore: string | RegExp | (string | RegExp)[];
  testMatch: string | RegExp | (string | RegExp)[];
  timeout: number;
  grep: string | RegExp | (string | RegExp)[];
  grepInvert: string | RegExp | (string | RegExp)[] | null;
  snapshotDir: string;
  retries: number;
  repeatEach: number;
  use: unknown;
};
export interface ReporterV2 {
  onConfigure(config: FullConfig): void;
  onBegin(suite: Suite): void;
  onTestBegin(test: TestCase, result: TestResult): void;
  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult): void;
  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult): void;
  onTestEnd(test: TestCase, result: TestResult): void;
  onEnd(result: FullResult): Promise<{ status?: FullResult['status'] } | undefined | void> | void;
  onExit(): void | Promise<void>;
  onError(error: TestError): void;
  onStepBegin(test: TestCase, result: TestResult, step: TestStep): void;
  onStepEnd(test: TestCase, result: TestResult, step: TestStep): void;
  printsToStdio(): boolean;
  version(): 'v2';
}

/**
 * `Suite` is a group of tests. All tests in Playwright Test form the following hierarchy:
 * - Root suite has a child suite for each {@link TestProject}.
 *   - Project suite #1. Has a child suite for each test file in the project.
 *     - File suite #1
 *       - {@link TestCase} #1
 *       - {@link TestCase} #2
 *       - Suite corresponding to a
 *         [test.describe([title, details, callback])](https://playwright.dev/docs/api/class-test#test-describe)
 *         group
 *         - {@link TestCase} #1 in a group
 *         - {@link TestCase} #2 in a group
 *       - < more test cases ... >
 *     - File suite #2
 *     - < more file suites ... >
 *   - Project suite #2
 *   - < more project suites ... >
 *
 * Reporter is given a root suite in the
 * [reporter.onBegin(config, suite)](https://playwright.dev/docs/api/class-reporter#reporter-on-begin) method.
 */
export interface Suite {
  /**
   * Configuration of the project this suite belongs to, or [void] for the root suite.
   */
  project(): FullProject | undefined;
  /**
   * Returns the list of all test cases in this suite and its descendants, as opposite to
   * [suite.tests](https://playwright.dev/docs/api/class-suite#suite-tests).
   */
  allTests(): Array<TestCase>;

  /**
   * Returns a list of titles from the root down to this suite.
   */
  titlePath(): Array<string>;

  /**
   * Location in the source where the suite is defined. Missing for root and project suites.
   */
  location?: Location;

  /**
   * Parent suite, missing for the root suite.
   */
  parent?: Suite;

  /**
   * Child suites. See {@link Suite} for the hierarchy of suites.
   */
  suites: Array<Suite>;

  /**
   * Test cases in the suite. Note that only test cases defined directly in this suite are in the list. Any test cases
   * defined in nested
   * [test.describe([title, details, callback])](https://playwright.dev/docs/api/class-test#test-describe) groups are
   * listed in the child [suite.suites](https://playwright.dev/docs/api/class-suite#suite-suites).
   */
  tests: Array<TestCase>;

  /**
   * Suite title.
   * - Empty for root suite.
   * - Project name for project suite.
   * - File path for file suite.
   * - Title passed to
   *   [test.describe([title, details, callback])](https://playwright.dev/docs/api/class-test#test-describe) for a
   *   group suite.
   */
  title: string;
}

/**
 * `TestCase` corresponds to every
 * [test.(call)(title[, details, body])](https://playwright.dev/docs/api/class-test#test-call) call in a test file.
 * When a single [test.(call)(title[, details, body])](https://playwright.dev/docs/api/class-test#test-call) is
 * running in multiple projects or repeated multiple times, it will have multiple `TestCase` objects in corresponding
 * projects' suites.
 */
export interface TestCase {
  /**
   * Expected test status.
   * - Tests marked as
   *   [test.skip([title, details, body, condition, callback, description])](https://playwright.dev/docs/api/class-test#test-skip)
   *   or
   *   [test.fixme([title, details, body, condition, callback, description])](https://playwright.dev/docs/api/class-test#test-fixme)
   *   are expected to be `'skipped'`.
   * - Tests marked as
   *   [test.fail([title, details, body, condition, callback, description])](https://playwright.dev/docs/api/class-test#test-fail)
   *   are expected to be `'failed'`.
   * - Other tests are expected to be `'passed'`.
   *
   * See also [testResult.status](https://playwright.dev/docs/api/class-testresult#test-result-status) for the actual
   * status.
   */
  expectedStatus: TestStatus;
  /**
   * Whether the test is considered running fine. Non-ok tests fail the test run with non-zero exit code.
   */
  ok(): boolean;

  /**
   * Testing outcome for this test. Note that outcome is not the same as
   * [testResult.status](https://playwright.dev/docs/api/class-testresult#test-result-status):
   * - Test that is expected to fail and actually fails is `'expected'`.
   * - Test that passes on a second retry is `'flaky'`.
   */
  outcome(): "skipped"|"expected"|"unexpected"|"flaky";

  /**
   * Returns a list of titles from the root down to this test.
   */
  titlePath(): Array<string>;

  /**
   * The list of annotations applicable to the current test. Includes:
   * - annotations defined on the test or suite via
   *   [test.(call)(title[, details, body])](https://playwright.dev/docs/api/class-test#test-call) and
   *   [test.describe([title, details, callback])](https://playwright.dev/docs/api/class-test#test-describe);
   * - annotations implicitly added by methods
   *   [test.skip([title, details, body, condition, callback, description])](https://playwright.dev/docs/api/class-test#test-skip),
   *   [test.fixme([title, details, body, condition, callback, description])](https://playwright.dev/docs/api/class-test#test-fixme)
   *   and
   *   [test.fail([title, details, body, condition, callback, description])](https://playwright.dev/docs/api/class-test#test-fail);
   * - annotations appended to
   *   [testInfo.annotations](https://playwright.dev/docs/api/class-testinfo#test-info-annotations) during the test
   *   execution.
   *
   * Annotations are available during test execution through
   * [testInfo.annotations](https://playwright.dev/docs/api/class-testinfo#test-info-annotations).
   *
   * Learn more about [test annotations](https://playwright.dev/docs/test-annotations).
   */
  annotations: Array<{
    /**
     * Annotation type, for example `'skip'` or `'fail'`.
     */
    type: string;

    /**
     * Optional description.
     */
    description?: string;
  }>;

  /**
   * Unique test ID that is computed based on the test file name, test title and project name. Test ID can be used as a
   * history ID.
   */
  id: string;

  /**
   * Location in the source where the test is defined.
   */
  location: Location;

  /**
   * Suite this test case belongs to.
   */
  parent: Suite;

  /**
   * Contains the repeat index when running in "repeat each" mode. This mode is enabled by passing `--repeat-each` to
   * the [command line](https://playwright.dev/docs/test-cli).
   */
  repeatEachIndex: number;

  /**
   * Results for each run of this test.
   */
  results: Array<TestResult>;

  /**
   * The maximum number of retries given to this test in the configuration.
   *
   * Learn more about [test retries](https://playwright.dev/docs/test-retries#retries).
   */
  retries: number;

  /**
   * The list of tags defined on the test or suite via
   * [test.(call)(title[, details, body])](https://playwright.dev/docs/api/class-test#test-call) or
   * [test.describe([title, details, callback])](https://playwright.dev/docs/api/class-test#test-describe), as well as
   * `@`-tokens extracted from test and suite titles.
   *
   * Learn more about [test tags](https://playwright.dev/docs/test-annotations#tag-tests).
   */
  tags: Array<string>;

  /**
   * The timeout given to the test. Affected by
   * [testConfig.timeout](https://playwright.dev/docs/api/class-testconfig#test-config-timeout),
   * [testProject.timeout](https://playwright.dev/docs/api/class-testproject#test-project-timeout),
   * [test.setTimeout(timeout)](https://playwright.dev/docs/api/class-test#test-set-timeout),
   * [test.slow([condition, callback, description])](https://playwright.dev/docs/api/class-test#test-slow) and
   * [testInfo.setTimeout(timeout)](https://playwright.dev/docs/api/class-testinfo#test-info-set-timeout).
   */
  timeout: number;

  /**
   * Test title as passed to the
   * [test.(call)(title[, details, body])](https://playwright.dev/docs/api/class-test#test-call) call.
   */
  title: string;
}

/**
 * A result of a single {@link TestCase} run.
 */
export interface TestResult {
  /**
   * The status of this test result. See also
   * [testCase.expectedStatus](https://playwright.dev/docs/api/class-testcase#test-case-expected-status).
   */
  status: TestStatus;
  /**
   * The list of files or buffers attached during the test execution through
   * [testInfo.attachments](https://playwright.dev/docs/api/class-testinfo#test-info-attachments).
   */
  attachments: Array<{
    /**
     * Attachment name.
     */
    name: string;

    /**
     * Content type of this attachment to properly present in the report, for example `'application/json'` or
     * `'image/png'`.
     */
    contentType: string;

    /**
     * Optional path on the filesystem to the attached file.
     */
    path?: string;

    /**
     * Optional attachment body used instead of a file.
     */
    body?: Buffer;
  }>;

  /**
   * Running time in milliseconds.
   */
  duration: number;

  /**
   * First error thrown during test execution, if any. This is equal to the first element in
   * [testResult.errors](https://playwright.dev/docs/api/class-testresult#test-result-errors).
   */
  error?: TestError;

  /**
   * Errors thrown during the test execution.
   */
  errors: Array<TestError>;

  /**
   * The index of the worker between `0` and `workers - 1`. It is guaranteed that workers running at the same time have
   * a different `parallelIndex`.
   */
  parallelIndex: number;

  /**
   * When test is retries multiple times, each retry attempt is given a sequential number.
   *
   * Learn more about [test retries](https://playwright.dev/docs/test-retries#retries).
   */
  retry: number;

  /**
   * Start time of this particular test run.
   */
  startTime: Date;

  /**
   * Anything written to the standard error during the test run.
   */
  stderr: Array<string|Buffer>;

  /**
   * Anything written to the standard output during the test run.
   */
  stdout: Array<string|Buffer>;

  /**
   * List of steps inside this test run.
   */
  steps: Array<TestStep>;

  /**
   * Index of the worker where the test was run. If the test was not run a single time, for example when the user
   * interrupted testing, the only result will have a `workerIndex` equal to `-1`.
   *
   * Learn more about [parallelism and sharding](https://playwright.dev/docs/test-parallel) with Playwright Test.
   */
  workerIndex: number;
}

/**
 * Result of the full test run.
 */
export interface FullResult {
  /**
   * Status:
   *   - 'passed' - everything went as expected.
   *   - 'failed' - any test has failed.
   *   - 'timedout' - the global time has been reached.
   *   - 'interrupted' - interrupted by the user.
   */
  status: 'passed' | 'failed' | 'timedout' | 'interrupted';

  /**
   * Test start wall time.
   */
  startTime: Date;

  /**
   * Test duration in milliseconds.
   */
  duration: number;
}

/**
 * Test runner notifies the reporter about various events during test execution. All methods of the reporter are
 * optional.
 *
 * You can create a custom reporter by implementing a class with some of the reporter methods. Make sure to export
 * this class as default.
 *
 * ```js
 * // my-awesome-reporter.ts
 * import type {
 *   Reporter, FullConfig, Suite, TestCase, TestResult, FullResult
 * } from '@playwright/test/reporter';
 *
 * class MyReporter implements Reporter {
 *   constructor(options: { customOption?: string } = {}) {
 *     console.log(`my-awesome-reporter setup with customOption set to ${options.customOption}`);
 *   }
 *
 *   onBegin(config: FullConfig, suite: Suite) {
 *     console.log(`Starting the run with ${suite.allTests().length} tests`);
 *   }
 *
 *   onTestBegin(test: TestCase) {
 *     console.log(`Starting test ${test.title}`);
 *   }
 *
 *   onTestEnd(test: TestCase, result: TestResult) {
 *     console.log(`Finished test ${test.title}: ${result.status}`);
 *   }
 *
 *   onEnd(result: FullResult) {
 *     console.log(`Finished the run: ${result.status}`);
 *   }
 * }
 * export default MyReporter;
 * ```
 *
 * Now use this reporter with
 * [testConfig.reporter](https://playwright.dev/docs/api/class-testconfig#test-config-reporter). Learn more about
 * [using reporters](https://playwright.dev/docs/test-reporters).
 *
 * ```js
 * // playwright.config.ts
 * import { defineConfig } from '@playwright/test';
 *
 * export default defineConfig({
 *   reporter: ['./my-awesome-reporter.ts', { customOption: 'some value' }],
 * });
 * ```
 *
 * Here is a typical order of reporter calls:
 * - [reporter.onBegin(config, suite)](https://playwright.dev/docs/api/class-reporter#reporter-on-begin) is called
 *   once with a root suite that contains all other suites and tests. Learn more about [suites hierarchy]{@link
 *   Suite}.
 * - [reporter.onTestBegin(test, result)](https://playwright.dev/docs/api/class-reporter#reporter-on-test-begin) is
 *   called for each test run. It is given a {@link TestCase} that is executed, and a {@link TestResult} that is
 *   almost empty. Test result will be populated while the test runs (for example, with steps and stdio) and will
 *   get final `status` once the test finishes.
 * - [reporter.onStepBegin(test, result, step)](https://playwright.dev/docs/api/class-reporter#reporter-on-step-begin)
 *   and
 *   [reporter.onStepEnd(test, result, step)](https://playwright.dev/docs/api/class-reporter#reporter-on-step-end)
 *   are called for each executed step inside the test. When steps are executed, test run has not finished yet.
 * - [reporter.onTestEnd(test, result)](https://playwright.dev/docs/api/class-reporter#reporter-on-test-end) is
 *   called when test run has finished. By this time, {@link TestResult} is complete and you can use
 *   [testResult.status](https://playwright.dev/docs/api/class-testresult#test-result-status),
 *   [testResult.error](https://playwright.dev/docs/api/class-testresult#test-result-error) and more.
 * - [reporter.onEnd(result)](https://playwright.dev/docs/api/class-reporter#reporter-on-end) is called once after
 *   all tests that should run had finished.
 * - [reporter.onExit()](https://playwright.dev/docs/api/class-reporter#reporter-on-exit) is called immediately
 *   before the test runner exits.
 *
 * Additionally,
 * [reporter.onStdOut(chunk, test, result)](https://playwright.dev/docs/api/class-reporter#reporter-on-std-out) and
 * [reporter.onStdErr(chunk, test, result)](https://playwright.dev/docs/api/class-reporter#reporter-on-std-err) are
 * called when standard output is produced in the worker process, possibly during a test execution, and
 * [reporter.onError(error)](https://playwright.dev/docs/api/class-reporter#reporter-on-error) is called when
 * something went wrong outside of the test execution.
 *
 * If your custom reporter does not print anything to the terminal, implement
 * [reporter.printsToStdio()](https://playwright.dev/docs/api/class-reporter#reporter-prints-to-stdio) and return
 * `false`. This way, Playwright will use one of the standard terminal reporters in addition to your custom reporter
 * to enhance user experience.
 */
export interface Reporter {
  /**
   * Called once before running tests. All tests have been already discovered and put into a hierarchy of {@link
   * Suite}s.
   * @param config Resolved configuration.
   * @param suite The root suite that contains all projects, files and test cases.
   */
  onBegin?(config: FullConfig, suite: Suite): void;
  /**
   * Called after all tests have been run, or testing has been interrupted. Note that this method may return a [Promise]
   * and Playwright Test will await it. Reporter is allowed to override the status and hence affect the exit code of the
   * test runner.
   * @param result Result of the full test run, `status` can be one of:
   * - `'passed'` - Everything went as expected.
   * - `'failed'` - Any test has failed.
   * - `'timedout'` - The
   * [testConfig.globalTimeout](https://playwright.dev/docs/api/class-testconfig#test-config-global-timeout) has
   * been reached.
   * - `'interrupted'` - Interrupted by the user.
   */
  onEnd?(result: FullResult): Promise<{ status?: FullResult['status'] } | undefined | void> | void;
  /**
   * Called on some global error, for example unhandled exception in the worker process.
   * @param error The error.
   */
  onError?(error: TestError): void;

  /**
   * Called immediately before test runner exists. At this point all the reporters have received the
   * [reporter.onEnd(result)](https://playwright.dev/docs/api/class-reporter#reporter-on-end) signal, so all the reports
   * should be build. You can run the code that uploads the reports in this hook.
   */
  onExit?(): Promise<void>;

  /**
   * Called when something has been written to the standard error in the worker process.
   * @param chunk Output chunk.
   * @param test Test that was running. Note that output may happen when no test is running, in which case this will be [void].
   * @param result Result of the test run, this object gets populated while the test runs.
   */
  onStdErr?(chunk: string|Buffer, test: void|TestCase, result: void|TestResult): void;

  /**
   * Called when something has been written to the standard output in the worker process.
   * @param chunk Output chunk.
   * @param test Test that was running. Note that output may happen when no test is running, in which case this will be [void].
   * @param result Result of the test run, this object gets populated while the test runs.
   */
  onStdOut?(chunk: string|Buffer, test: void|TestCase, result: void|TestResult): void;

  /**
   * Called when a test step started in the worker process.
   * @param test Test that the step belongs to.
   * @param result Result of the test run, this object gets populated while the test runs.
   * @param step Test step instance that has started.
   */
  onStepBegin?(test: TestCase, result: TestResult, step: TestStep): void;

  /**
   * Called when a test step finished in the worker process.
   * @param test Test that the step belongs to.
   * @param result Result of the test run.
   * @param step Test step instance that has finished.
   */
  onStepEnd?(test: TestCase, result: TestResult, step: TestStep): void;

  /**
   * Called after a test has been started in the worker process.
   * @param test Test that has been started.
   * @param result Result of the test run, this object gets populated while the test runs.
   */
  onTestBegin?(test: TestCase, result: TestResult): void;

  /**
   * Called after a test has been finished in the worker process.
   * @param test Test that has been finished.
   * @param result Result of the test run.
   */
  onTestEnd?(test: TestCase, result: TestResult): void;

  /**
   * Whether this reporter uses stdio for reporting. When it does not, Playwright Test could add some output to enhance
   * user experience. If your reporter does not print to the terminal, it is strongly recommended to return `false`.
   */
  printsToStdio?(): boolean;
}

export interface JSONReport {
  config: Omit<FullConfig, 'projects'> & {
    projects: {
      outputDir: string,
      repeatEach: number,
      retries: number,
      metadata: Metadata,
      id: string,
      name: string,
      testDir: string,
      testIgnore: string[],
      testMatch: string[],
      timeout: number,
    }[],
  };
  suites: JSONReportSuite[];
  errors: TestError[];
  stats: {
    startTime: string; // Date in ISO 8601 format.
    duration: number; // In milliseconds;
    expected: number;
    unexpected: number;
    flaky: number;
    skipped: number;
  }
}

export interface JSONReportSuite {
  title: string;
  file: string;
  column: number;
  line: number;
  specs: JSONReportSpec[];
  suites?: JSONReportSuite[];
}

export interface JSONReportSpec {
  tags: string[],
  title: string;
  ok: boolean;
  tests: JSONReportTest[];
  id: string;
  file: string;
  line: number;
  column: number;
}

export interface JSONReportTest {
  timeout: number;
  annotations: { type: string, description?: string }[],
  expectedStatus: TestStatus;
  projectName: string;
  projectId: string;
  results: JSONReportTestResult[];
  status: 'skipped' | 'expected' | 'unexpected' | 'flaky';
}

export interface JSONReportError {
  message: string;
  location?: Location;
}

export interface JSONReportTestResult {
  workerIndex: number;
  status: TestStatus | undefined;
  duration: number;
  error: TestError | undefined;
  errors: JSONReportError[];
  stdout: JSONReportSTDIOEntry[];
  stderr: JSONReportSTDIOEntry[];
  retry: number;
  steps?: JSONReportTestStep[];
  startTime: string; // Date in ISO 8601 format.
  attachments: {
    name: string;
    path?: string;
    body?: string;
    contentType: string;
  }[];
  errorLocation?: Location;
}

export interface JSONReportTestStep {
  title: string;
  duration: number;
  error: TestError | undefined;
  steps?: JSONReportTestStep[];
}

export type JSONReportSTDIOEntry = { text: string } | { buffer: string };

// This is required to not export everything by default. See https://github.com/Microsoft/TypeScript/issues/19545#issuecomment-340490459
export {};


/**
 * Represents a location in the source code where {@link TestCase} or {@link Suite} is defined.
 */
export interface Location {
  /**
   * Column number in the source file.
   */
  column: number;

  /**
   * Path to the source file.
   */
  file: string;

  /**
   * Line number in the source file.
   */
  line: number;
}

/**
 * Information about an error thrown during test execution.
 */
export interface TestError {
  /**
   * Error location in the source code.
   */
  location?: Location;

  /**
   * Error message. Set when [Error] (or its subclass) has been thrown.
   */
  message?: string;

  /**
   * Source code snippet with highlighted error.
   */
  snippet?: string;

  /**
   * Error stack. Set when [Error] (or its subclass) has been thrown.
   */
  stack?: string;

  /**
   * The value that was thrown. Set when anything except the [Error] (or its subclass) has been thrown.
   */
  value?: string;
}

/**
 * Represents a step in the [TestRun].
 */
export interface TestStep {
  /**
   * Returns a list of step titles from the root step down to this step.
   */
  titlePath(): Array<string>;

  /**
   * Step category to differentiate steps with different origin and verbosity. Built-in categories are:
   * - `hook` for fixtures and hooks initialization and teardown
   * - `expect` for expect calls
   * - `pw:api` for Playwright API calls.
   * - `test.step` for test.step API calls.
   */
  category: string;

  /**
   * Running time in milliseconds.
   */
  duration: number;

  /**
   * Error thrown during the step execution, if any.
   */
  error?: TestError;

  /**
   * Optional location in the source where the step is defined.
   */
  location?: Location;

  /**
   * Parent step, if any.
   */
  parent?: TestStep;

  /**
   * Start time of this particular test step.
   */
  startTime: Date;

  /**
   * List of steps inside this step.
   */
  steps: Array<TestStep>;

  /**
   * User-friendly test step title.
   */
  title: string;
}
