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

import { PlaywrightTest, TestConfig } from './playwrightTest';
import { WorkspaceChange } from './workspaceObserver';
import * as vscodeTypes from './vscodeTypes';
import { resolveSourceMap } from './utils';
import { ProjectConfigWithFiles } from './listTests';
import * as reporterTypes from './reporter';

export type TestEntry = reporterTypes.TestCase | reporterTypes.Suite;

/**
 * This class builds the Playwright Test model in Playwright terms.
 * - TestModel maps to the Playwright config
 * - TestProject maps to the Playwright project
 * - TestFiles belong to projects and contain test entries.
 *
 * A single test in the source code, and a single test in VS Code UI can correspond to multiple entries
 * in different configs / projects. TestTree will perform model -> UI mapping and will represent
 * them as a single entity.
 */
export class TestFile {
  readonly project: TestProject;
  readonly file: string;
  private _entries: TestEntry[] | undefined;
  private _revision = 0;

  constructor(project: TestProject, file: string) {
    this.project = project;
    this.file = file;
  }

  entries(): TestEntry[] | undefined {
    return this._entries;
  }

  setEntries(entries: TestEntry[]) {
    ++this._revision;
    this._entries = entries;
  }

  revision(): number {
    return this._revision;
  }
}

export type TestProject = {
  name: string;
  testDir: string;
  model: TestModel;
  files: Map<string, TestFile>;
  isEnabled: boolean;
};

export class TestModel {
  private _vscode: vscodeTypes.VSCode;
  readonly config: TestConfig;
  private _projects = new Map<string, TestProject>();
  private _didUpdate: vscodeTypes.EventEmitter<void>;
  readonly onUpdated: vscodeTypes.Event<void>;
  private _playwrightTest: PlaywrightTest;
  private _fileToSources: Map<string, string[]> = new Map();
  private _sourceToFile: Map<string, string> = new Map();
  private _envProvider: () => NodeJS.ProcessEnv;

  constructor(vscode: vscodeTypes.VSCode, playwrightTest: PlaywrightTest, workspaceFolder: string, configFile: string, playwrightInfo: { cli: string, version: number }, envProvider: () => NodeJS.ProcessEnv) {
    this._vscode = vscode;
    this._playwrightTest = playwrightTest;
    this.config = { ...playwrightInfo, workspaceFolder, configFile };
    this._didUpdate = new vscode.EventEmitter();
    this._envProvider = envProvider;
    this.onUpdated = this._didUpdate.event;
  }

  setProjectEnabled(project: TestProject, enabled: boolean) {
    project.isEnabled = enabled;
    this._didUpdate.fire();
  }

  allProjects(): Map<string, TestProject> {
    return this._projects;
  }

  enabledProjects(): TestProject[] {
    return [...this._projects.values()].filter(p => p.isEnabled);
  }

  enabledFiles(): string[] {
    const result: string[] = [];
    for (const project of this.enabledProjects()) {
      for (const file of project.files.keys())
        result.push(file);
    }
    return result;
  }

  async listFiles(): Promise<reporterTypes.TestError | undefined> {
    const report = await this._playwrightTest.listFiles(this.config);
    if (report.error)
      return report.error;

    // Resolve files to sources when using source maps.
    for (const project of report.projects) {
      const files: string[] = [];
      for (const file of project.files)
        files.push(...await resolveSourceMap(file, this._fileToSources, this._sourceToFile));
      project.files = files;
      this.config.testIdAttributeName = project.use?.testIdAttribute;
    }

    const projectsToKeep = new Set<string>();
    for (const projectReport of report.projects) {
      projectsToKeep.add(projectReport.name);
      let project = this._projects.get(projectReport.name);
      if (!project)
        project = this._createProject(projectReport);
      this._updateProject(project, projectReport);
    }

    for (const projectName of this._projects.keys()) {
      if (!projectsToKeep.has(projectName))
        this._projects.delete(projectName);
    }

    this._didUpdate.fire();
  }

  private _createProject(projectReport: ProjectConfigWithFiles): TestProject {
    const project: TestProject = {
      model: this,
      ...projectReport,
      files: new Map(),
      isEnabled: true,
    };
    this._projects.set(project.name, project);
    return project;
  }

  private _updateProject(project: TestProject, projectReport: ProjectConfigWithFiles) {
    const filesToKeep = new Set<string>();
    for (const file of projectReport.files) {
      filesToKeep.add(file);
      const testFile = project.files.get(file);
      if (!testFile)
        this._createFile(project, file);
    }

    for (const file of project.files.keys()) {
      if (!filesToKeep.has(file))
        project.files.delete(file);
    }
  }

  private _createFile(project: TestProject, file: string): TestFile {
    const testFile = new TestFile(project, file);
    project.files.set(file, testFile);
    return testFile;
  }

  async workspaceChanged(change: WorkspaceChange) {
    let modelChanged = false;
    // Translate source maps from files to sources.
    change.changed = this._mapFilesToSources(change.changed);
    change.created = this._mapFilesToSources(change.created);
    change.deleted = this._mapFilesToSources(change.deleted);

    if (change.deleted.size) {
      for (const project of this._projects.values()) {
        for (const file of change.deleted) {
          if (project.files.has(file)) {
            project.files.delete(file);
            modelChanged = true;
          }
        }
      }
    }

    if (change.created.size) {
      let hasMatchingFiles = false;
      for (const project of this._projects.values()) {
        for (const file of change.created) {
          if (file.startsWith(project.testDir))
            hasMatchingFiles = true;
        }
      }
      if (hasMatchingFiles)
        await this.listFiles();
    }

    if (change.changed.size) {
      const filesToLoad = new Set<string>();
      for (const project of this._projects.values()) {
        for (const file of change.changed) {
          const testFile = project.files.get(file);
          if (!testFile || !testFile.entries())
            continue;
          filesToLoad.add(file);
        }
      }
      if (filesToLoad.size)
        await this.listTests([...filesToLoad]);
    }
    if (modelChanged)
      this._didUpdate.fire();
  }

  async listTests(files: string[]): Promise<reporterTypes.TestError[]> {
    const { rootSuite, errors } = await this._playwrightTest.listTests(this.config, files);
    this._updateProjects(rootSuite.suites, files);
    return errors;
  }

  private _updateProjects(projectSuites: reporterTypes.Suite[], requestedFiles: string[]) {
    for (const [projectName, project] of this._projects) {
      const projectSuite = projectSuites.find(e => e.project()!.name === projectName);
      const filesToDelete = new Set(requestedFiles);
      for (const fileSuite of projectSuite?.suites || []) {
        filesToDelete.delete(fileSuite.location!.file);
        const file = project.files.get(fileSuite.location!.file);
        if (!file)
          continue;
        file.setEntries([...fileSuite.suites, ...fileSuite.tests]);
      }
      // We requested update for those, but got no entries.
      for (const file of filesToDelete) {
        const testFile = project.files.get(file);
        if (testFile)
          testFile.setEntries([]);
      }
    }
    this._didUpdate.fire();
  }

  updateFromRunningProjects(projectSuites: reporterTypes.Suite[]) {
    for (const projectSuite of projectSuites) {
      const project = this._projects.get(projectSuite.project()!.name);
      if (project)
        this._updateFromRunningProject(project, projectSuite);
    }
  }

  private _updateFromRunningProject(project: TestProject, projectSuite: reporterTypes.Suite) {
    // When running tests, don't remove existing entries.
    for (const fileSuite of projectSuite.suites) {
      if (!fileSuite.allTests().length)
        continue;
      let file = project.files.get(fileSuite.location!.file);
      if (!file)
        file = this._createFile(project, fileSuite.location!.file);
      if (!file.entries())
        file.setEntries([...fileSuite.suites, ...fileSuite.tests]);
    }
    this._didUpdate.fire();
  }

  async runTests(projects: TestProject[], locations: string[] | null, reporter: reporterTypes.ReporterV2, parametrizedTestTitle: string | undefined, token: vscodeTypes.CancellationToken) {
    locations = locations || [];
    await this._playwrightTest.runTests(this.config, projects.map(p => p.name), locations, reporter, parametrizedTestTitle, token);
  }

  async debugTests(projects: TestProject[], locations: string[] | null, reporter: reporterTypes.ReporterV2, parametrizedTestTitle: string | undefined, token: vscodeTypes.CancellationToken) {
    locations = locations || [];
    await this._playwrightTest.debugTests(this._vscode, this.config, projects.map(p => p.name), projects.map(p => p.testDir), this._envProvider(), locations, reporter, parametrizedTestTitle, token);
  }

  private _mapFilesToSources(files: Set<string>): Set<string> {
    const result = new Set<string>();
    for (const file of files) {
      const sources = this._fileToSources.get(file);
      if (sources)
        sources.forEach(f => result.add(f));
      else
        result.add(file);
    }
    return result;
  }

  narrowDownFilesToEnabledProjects(fileNames: Set<string>) {
    const result = new Set<string>();
    for (const project of this.enabledProjects()) {
      for (const fileName of fileNames) {
        if (project.files.has(fileName))
          result.add(fileName);
      }
    }
    return result;
  }
}
