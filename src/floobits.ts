'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import FlooURL from './floourl';

import fl from './globals';
import './ignore';

let filetree, usersModel, users, floorc, auth, me, buffer, bufs, handler;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

const TextDocuments: { [s: string]: vscode.TextDocument; } = {};

const listen = (context: vscode.ExtensionContext) => {

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json

  let disposable = vscode.commands.registerCommand('extension.joinWorkspace', () => {
    // The code you place here will be executed every time your command is executed

    // Display a message box to the user
    vscode.window.showInformationMessage('Hello World!');
  });

  context.subscriptions.push(disposable);

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((event: vscode.TextEditor) => {
    console.log('hello', event);
  }));

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
    TextDocuments[document.uri.toString()] = document;
  }));

  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
    delete TextDocuments[document.uri.toString()];
  }));


  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
    console.log(event.document.uri.fsPath, event.document.fileName, event.contentChanges.map(e => e.text).join(','));
  }));
};

const on_request_perms = (data) => {
  const user = this.users.getByConnectionID(data.user_id);
  if (!user) {
    return;
  }
  const handleRequestPerm = require("./build/handle_request_perm");
  const view = handleRequestPerm({ username: user.username, userId: data.user_id, perms: data.perms });
  // const atomUtils = require("./atom_utils");
  // atomUtils.addModalPanel("handle-request-perm", view);
};

const on_room_info = (workspace) => {
  console.info("room_info", workspace);

  bufs.on_room_info(workspace);
  handler.on_room_info(workspace);
  const _ = require("lodash");
  _.each(workspace.terms, function (t) {
    const username = workspace.users[t.owner].username;
    t.owner = username;
    return t;
  });

  // terminal_manager.on_floobits(this.me.id, workspace.terms);

  // if (this.context_disposable) {
  //   return;
  // }

  // const CompositeDisposable = require("atom").CompositeDisposable;
  // this.context_disposable = new CompositeDisposable();

  // this.context_disposable.add(
  //   atom.commands.add(".tree-view .selected",
  //     "Floobits: Add to Workspace",
  //     this.add_file_from_menu.bind(this)
  //   )
  // );
  // const editorAction = require("./common/editor_action");
  // this.context_disposable.add(
  //   atom.commands.add("atom-workspace", {
  //     "Floobits: Open Workspace in Browser": this.open_in_browser.bind(this),
  //     "Floobits: Summon": this.summon.bind(this),
  //     "Floobits: Follow User": this.follow.bind(this),
  //     "Floobits: Toggle Follow Mode": this.toggle_follow.bind(this),
  //     "Floobits: Add Current File": this.add_current_file.bind(this),
  //     "Floobits: Clear All Highlights": editorAction.clear_highlights,
  //     "Floobits: Workspace Permissions": this.permissions.bind(this),
  //     "Floobits: Chat": this.open_chat.bind(this),
  //   })
  // );

  // this.context_disposable.add(
  //   atom.contextMenu.add({
  //     ".tree-view .selected": [
  //       {
  //         label: "Floobits: Add to Workspace",
  //         command: "Floobits: Add to Workspace",
  //       },
  //     ],
  //     ".pane atom-text-editor": [
  //       {
  //         label: "Floobits: Add Current File",
  //         command: "Floobits: Add Current File",
  //       },
  //     ],
  //   })
  // );
};

const leave_workspace = () => {
  // terminal_manager.stop();

  // if (atom_listener) {
  //   atom_listener.stop();
  //   atom_listener = null;
  // }

  if (bufs) {
    bufs.stop();
    bufs = null;
  }

  if (handler) {
    const message_action = require("./common/message_action");
    message_action.error("Left " + handler.floourl.toString(), true);
    handler.stop();
    handler = null;
  }
  // if (webrtc) {
  //   webrtc.stopUserMedia();
  //   webrtc = null;
  // }

  // if (userPanel) {
  //   userPanel.destroy();
  //   userPanel = null;
  // }

  // if (statusBar) {
  //   statusBar.destroy();
  //   statusBar = null;
  // }
};

const on_disconnect = (msg) => {
  msg = msg && msg.reason;
  const message_action = require("./common/message_action");
  message_action.warn(msg || "Disconnected from workspace", true);
  // We were disconnected for a reason. Don't reconnect.
  if (!msg) {
    return;
  }
  leave_workspace();
};

function joinWorkspace(context: vscode.ExtensionContext, floourl: FlooURL, url: string, created: boolean, floobitsPath: string) {
  // context.globalState
  // that.leave_workspace();
  const thing: string = context.globalState.get<string>('floobits');
  if (thing && thing !== vscode.workspace.rootPath) {
    return;
  }
  context.globalState.update('floobits', undefined);
  const usersModel = require("./common/user_model");
  users = new usersModel.Users();
  const floorc = require("./common/floorc");
  auth = floorc.auth[floourl.host];
  me = new usersModel.User({ id: auth.username });
  const buffer = require("./common/buffer_model");
  bufs = new buffer.Buffers();

  const Filetree = require("./common/filetree_model");
  filetree = new Filetree();
  const utils = require("./common/utils");
  const floo = utils.load_floo(floobitsPath);
  floo.url = floourl.toString();
  utils.write_floo(floobitsPath, floo);

  fl.base_path = floobitsPath;
  fl.floourl = floourl;

  const PersistentJson = require("./common/persistentjson");
  const persistentJson = new PersistentJson();
  persistentJson.load();
  persistentJson.update(floobitsPath, url);
  persistentJson.write();

  const floop = require("./common/floop");


  floop.onROOM_INFO(on_room_info);
  floop.onDISCONNECT(on_disconnect);
  floop.onREQUEST_PERMS(on_request_perms);

  // atom.commands.dispatch(atom.views.getView(atom.workspace), "tree-view:show");

  floourl = floourl;

  // const AtomListener = require("./atom_listener");
  // this.atom_listener = new AtomListener(bufs, users, me);
  // this.atom_listener.start();
  const editorAction = require("./common/editor_action");
  const prefs = require("./common/userPref_model");
  editorAction.set(bufs, prefs);

  const FlooHandler = require("./common/handlers/floohandler").FlooHandler;
  handler = new FlooHandler(floobitsPath, floourl, me, users, bufs, filetree, created);
  // const WebRTC = require("./common/webrtc");
  // webrtc = new WebRTC(users, me);
  const statusBar = require("./build/status_bar");
  const view = statusBar({ floourl: floourl, me: me });
  const reactStatusBar = require("./react_wrapper").create_node("status-bar", view);
  // statusBar = atom.workspace.addBottomPanel({item: reactStatusBar});

  // open_chat();
  bufs.start();
  handler.start(auth);

  // if (atom.config.get("floobits.userList")) {
  //   user_list();
  // }
};


export function activate(context: vscode.ExtensionContext) {
  const disposables: vscode.Disposable[] = [];
  context.subscriptions.push(new vscode.Disposable(() => vscode.Disposable.from(...disposables).dispose()));

  fl.editor = {
    context, disposables,
    getConfiguration: (k, v) => vscode.workspace.getConfiguration(k).get<string>(v),
  };
  const { version } = require(context.asAbsolutePath('./package.json')) as { version: string };
  fl.PLUGIN_VERSION = version;
  
  console.log('Floobits is active!');
  const floourl: FlooURL = new FlooURL('Floobits', 'atom', 'floobits.com', '3448');
  fl.floourl = floourl;

  const url: string = "https://floobits.com/Floobits/atom";
  const floobitsPath: string = '/floobits/floobits-atom';
  // const floobitsPath: string = vscode.workspace.rootPath;

  if (floobitsPath !== vscode.workspace.rootPath) {
    context.globalState.update('floobits', floobitsPath);
    vscode.commands.executeCommand('vscode.openFolder', floobitsPath)
    return;
  }
  joinWorkspace(context, floourl, url, false, floobitsPath);
}

// this method is called when your extension is deactivated
export function deactivate() {
}
