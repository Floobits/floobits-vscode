import * as vscode from 'vscode';

const TextDocuments: { [s: string]: vscode.TextDocument; } = {};

let disposable: vscode.Disposable;

export const listen = (context: vscode.ExtensionContext) => {
  if (disposable) {
    console.error("already listening. disposing old listeners");
    disposable.dispose();
  }

  disposable = vscode.commands.registerCommand('extension.joinWorkspace', () => {
    vscode.window.showInformationMessage('Now listening to VSCode Events.');
  });

  context.subscriptions.push(disposable);

  // Window events
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor) => {
    console.log('activated', editor.document.fileName);
    // editor.selections.Z
  }));

  context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection((event: vscode.TextEditorSelectionChangeEvent) => {
    console.log('selected stuff', event.textEditor.document.fileName, event.selections.map((selection: vscode.Selection) =>
       `${event.textEditor.document.offsetAt(selection.start)} - ${event.textEditor.document.offsetAt(selection.end)}`
    ).join('\n'));
  }));

  context.subscriptions.push(vscode.window.onDidChangeTextEditorViewColumn((event: vscode.TextEditorViewColumnChangeEvent) => {
    console.log('view ported?', event.textEditor.document.fileName, event.viewColumn.toExponential(), event.viewColumn);
    debugger;
  }));


  // Workspace events
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    console.log('saved', document.fileName);
  }));

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
    console.log('opened', document.fileName);
    TextDocuments[document.fileName] = document;
  }));

  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
    console.log('closed', document.fileName);
    delete TextDocuments[document.fileName];
  }));

  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
    console.log("changed", event.document.fileName, event.contentChanges.map(e => e.text).join(','));
  }));
};

export const stop = () => {
  disposable.dispose();
  disposable = null;
};
