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

import * as vscodeTypes from './vscodeTypes';

export function registerChatTools(vscode: vscodeTypes.VSCode) {
  return vscode.lm.registerTool('pw_pageContent', new PageContentTool(vscode));
}

interface IPageContentParameters {
}

export class PageContentTool implements vscodeTypes.LanguageModelTool<IPageContentParameters> {
  readonly vscode: vscodeTypes.VSCode;

  constructor(vscode: vscodeTypes.VSCode) {
    this.vscode = vscode;
  }

  async invoke(
    options: vscodeTypes.LanguageModelToolInvocationOptions<IPageContentParameters>,
    token: vscodeTypes.CancellationToken
  ) {
    return new this.vscode.LanguageModelToolResult([new this.vscode.LanguageModelTextPart(data)]);
  }

  async prepareInvocation(
    options: vscodeTypes.LanguageModelToolInvocationPrepareOptions<IPageContentParameters>,
    token: vscodeTypes.CancellationToken
  ) {
    const confirmationMessages = {
      title: 'Playwright',
      message: new this.vscode.MarkdownString(`Allow fetching page content?`),
    };
    return {
      invocationMessage: 'Fetching page content',
      confirmationMessages,
    };
  }
}

const data = `
- text: This is just a demo of TodoMVC for testing, not the
- link "real TodoMVC app."
- heading "todos" [level=1]
- textbox "What needs to be done?"
- checkbox "❯Mark all as complete": "on"
- text: ❯Mark all as complete
- list:
  - listitem:
    - checkbox "Toggle Todo": "on"
    - text: buy flowers
  - listitem:
    - checkbox "Toggle Todo": "on"
    - text: send mail
- strong: "2"
- text: items left
- list:
  - listitem:
    - link "All"
  - listitem:
    - link "Active"
  - listitem:
    - link "Completed"
- contentinfo:
  - paragraph: Double-click to edit a todo
  - paragraph:
    - text: Created by
    - link "Remo H. Jansen"
  - paragraph:
    - text: Part of
    - link "TodoMVC"
`;
