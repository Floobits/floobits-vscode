import * as vscode from 'vscode';

const fs = require("fs");
const path = require("path");

const floop = require("./common/floop");
const utils = require("./common/utils");

// import { commands, Disposable, ExtensionContext, TextEditor, window } from 'vscode';
const _ = require("lodash");

interface Conflict {
  id: {path: string, txt: string, md5: string, encoding: string}
}

interface Conflicts {
  newFiles: Conflict[];
  missing: Conflict[];
  different: Conflict[];
}

let disposable: vscode.Disposable;

const editorAction = require("./common/editor_action");
const TextDocuments: { [s: string]: vscode.TextDocument; } = {};

const subscribeToEditor = (context: vscode.ExtensionContext) => {
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

const remote = (conflicts: Conflicts, bufs) => {
  // this.setState({enabled: false});
  _.each(conflicts.different, (b, id) => {
    let encoding = b.encoding || "utf8";
    floop.send_set_buf({
      id, encoding,
      buf: b.txt.toString(encoding),
      md5: b.md5,
    }, null, (err) => {
      if (!err) {
        // this.setState({different: this.state.different.add(id)});
        floop.send_saved({id: id});
      }
    });
  });

  _.each(conflicts.missing, (b, id) => {
    floop.send_delete_buf({id}, null, () => {
      // TODO: check err
      // this.setState({missing: this.state.missing.add(id)});
    });
  });

  _.each(conflicts.newFiles, (b, rel) => {
    fs.readFile(b.path, (err, data) => {
      if (err) {
        console.log(err);
        return;
      }

      const encoding = utils.is_binary(data, data.length) ? "base64" : "utf8";
      floop.send_create_buf({
        path: rel,
        buf: data.toString(encoding),
        encoding: encoding,
        md5: utils.md5(data),
      }, null, () => {
        // this.setState({newFiles: this.state.newFiles.add(rel)});
      });
    });
  });
};

const local = (conflicts: Conflicts, bufs) => {
  // this.setState({
  //   enabled: false,
  //   newFiles: new Set(_.keys(this.props.newFiles)),
  // });
  _.each(conflicts.missing, (b, id) => {
    floop.send_get_buf(id);
    // () => this.setState({missing: this.state.missing.add(id)})
  });
  _.each(conflicts.different, (b, id) => {
    floop.send_get_buf(id);
    // () => this.setState({different: this.state.different.add(id)})
  });
  const toFetch = _.merge({}, conflicts.missing, conflicts.different);
  //   this.handledConflicts = true;

  bufs.forEach(function (b, id) {
    if (id in toFetch) {
      return;
    }
    // Set populated so we send patches for things we sent set_buf for
    b.set({populated: true}, {silent: true});
  });
  //   // this.start_chokidar_();
};

const handleConflicts = (conflicts: Conflicts, bufs) => {
  if (_.isEmpty(conflicts.newFiles) && _.isEmpty(conflicts.different) && _.isEmpty(conflicts.missing)) {
    // this.start_chokidar_();
    this.handledConflicts = true;
    return;
  }

  const pluralize = (arg: number) => arg !== 1 ? 's' : '';

  let overwriteLocal: string = '';
  let overwriteRemote: string = '';

  const missing: string[]= _.map(conflicts.missing, b => b.path);
  const changed: string[] = _.map(conflicts.different, b => b.path);
  const newFiles: string[]= _.map(conflicts.newFiles, b => b.path);

  const toRemove: string[] = missing; // + ignored);
  const to_upload: string[] = _(newFiles).union(changed).difference(toRemove).value();

  const toFetch: string[] = _.union(changed, missing);
  const to_uploadLen: number = to_upload.length
  const toRemoveLen: number = toRemove.length
  const remoteLen: number = toRemoveLen + to_uploadLen
  const toFetchLen: number = toFetch.length

  console.log('To fetch: ', toFetch.join(', '))
  console.log('To upload: ', to_upload.join(', '))
  console.log('To remove: ', toRemove.join(', '))

  if (!toFetchLen) {
    overwriteLocal = 'Fetch nothing'
  } else if (toFetchLen < 5) {
    overwriteLocal = `Fetch ${toFetch.join(', ')}`;
  } else {
    overwriteLocal = `Fetch ${toFetchLen} file${pluralize(toFetchLen)}`;
  }

  let to_upload_str: string;
  if (to_uploadLen < 5) {
    to_upload_str = `Upload ${to_upload.join(', ')}`;
  } else {
    to_upload_str = `Upload ${to_uploadLen}`;
  }

  let toRemove_str: string;
  if (toRemoveLen < 5) {
    toRemove_str = `remove ${toRemove.join(', ')}`;
  } else {
    toRemove_str = `remove ${toRemoveLen}`;
  }

  if (to_uploadLen) {
    overwriteRemote += to_upload_str;
    if (toRemoveLen) {
      overwriteRemote += ' and '
    }
  }

  if (toRemoveLen) {
    overwriteRemote += toRemove_str;
  }

  if (remoteLen >= 5 && overwriteRemote) {
    overwriteRemote += ' files'
  }

   // Be fancy and capitalize "remove" if it's the first thing in the string
  if (overwriteRemote.length) {
      overwriteRemote = overwriteRemote[0].toUpperCase() + overwriteRemote.slice(1);
  }

  let connected_users_msg: string = '';

  // const filter_user => (u) {
  //   if u.get('is_anon'):
  //       return False
  //   if 'patch' not in u.get('perms'):
  //       return False
  //   if u.get('username') == self.username:
  //       return False
  //   return True
  // }


  // users = set([v['username'] for k, v in self.workspace_info['users'].items() if filter_user(v)])
  // if users:
  //     if len(users) < 4:
  //         connected_users_msg = ' Connected: ' + ', '.join(users)
  //     else:
  //         connected_users_msg = ' %s users connected' % len(users)

   // TODO: change action based on numbers of stuff

  const opts = [
    `Overwrite ${remoteLen} remote file${pluralize(remoteLen)}.`,
    `Overwrite ${toFetchLen} local file${pluralize(toFetchLen)}`,
    'Cancel',
  ];

  vscode.window.showQuickPick(opts)
    .then(val => {
      switch (val) {
        case opts[0]:
          return remote(conflicts, bufs);
        case opts[1]:
          return local(conflicts, bufs);
        case opts[2]:
          return stop();
      }
     });
};

const subscribeToFloobits = (context: vscode.ExtensionContext, bufs) => {
  editorAction.onHANDLE_CONFLICTS((conflicts: Conflicts) => handleConflicts(conflicts, bufs));
};

export const listen = (context: vscode.ExtensionContext, bufs) => {
  if (disposable) {
    console.error("already listening. disposing old listeners");
    disposable.dispose();
  }

  disposable = vscode.commands.registerCommand('extension.joinWorkspace', () => {
    vscode.window.showInformationMessage('Now listening to VSCode Events.');
  });

  context.subscriptions.push(disposable);
  subscribeToEditor(context);
  subscribeToFloobits(context, bufs);
};

  // editorAction.onGET_OPEN_EDITORS(getOpenEditors);


export const stop = () => {
  disposable.dispose();
  editorAction.off();
  disposable = null;
};


// const getOpenEditors = async () => {
//   try {
//     // const editorTracker = new ActiveEditorTracker();

//     let active: vscode.TextEditor = vscode.window.activeTextEditor;
//     let editor = active;
//     const openEditors: vscode.TextEditor[] = [];
//     do {
//       if (editor !== undefined) {
//         // If we didn't start with a valid editor, set one once we find it
//         if (active === undefined) {
//             active = editor;
//         }

//         openEditors.push(editor);
//       }

//       // editor = await editorTracker.awaitNext(500);
//       if (editor !== undefined && openEditors.some(e => editor. .document.fileName === e.document.fileName)) { break; }
//     } while ((active === undefined && editor === undefined) || !TextEditorComparer.equals(active, editor, { useId: true, usePosition: true }));

//     // editorTracker.dispose();

//     const editors = openEditors
//         .filter(_ => _.document !== undefined)
//         .map(_ => {
//             return {
//                 uri: _.document.uri,
//                 viewColumn: _.viewColumn
//             } as ISavedEditor;
//         });

//     this.context.workspaceState.update(WorkspaceState.SavedDocuments, editors);
//   }
//   catch (ex) {
//       Logger.error(ex, 'DocumentManager.save');
//   }
// };