'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

interface FlooURL {
  host: string;
  port: number;
  owner: string;
  secure: boolean;
  workspace: string;
};

declare var fl: {
  PLUGIN_VERSION: string;
  base_path: string;
  editor_settings: {
    room_owner: string;
    room: string;
  }
  floourl: FlooURL;
  username: string;
};

debugger;

import './globals';

fl.PLUGIN_VERSION = "0.0.1";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

const TextDocuments:{ [s: string]: vscode.TextDocument; } = {};


export function activate(context: vscode.ExtensionContext) {

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "floobits" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  
  let disposable = vscode.commands.registerCommand('extension.joinWorkspace', () => {
    // The code you place here will be executed every time your command is executed

    // Display a message box to the user
    vscode.window.showInformationMessage('Hello World!');
  });

  context.subscriptions.push(disposable);

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((event: vscode.TextEditor) =>  {
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

  // start: function (floourl, url, created, floobitsPath) {
  const that = this;
  const floourl: FlooURL = {
    host: 'floobits.com',
    port: 3448,
    owner: 'ggreer',
    secure: true,
    workspace: 'installer',
  }
  const url: string = "https://floobits.com/Floobits/vscode"
  // that.leave_workspace();
  const floobitsPath: string = vscode.workspace.rootPath;
  const usersModel = require("./common/user_model");
  that.users = new usersModel.Users();
  const floorc = require("./common/floorc");
  const auth = this.auth = floorc.auth[floourl.host];
  that.me = new usersModel.User({id: auth.username});
  const buffer = require("./common/buffer_model");
  that.bufs = new buffer.Buffers();

  const Filetree = require("./common/filetree_model");
  that.filetree = new Filetree();
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
  floop.onROOM_INFO(that.on_room_info, that);
  floop.onDISCONNECT(that.on_disconnect, that);
  floop.onREQUEST_PERMS(that.on_request_perms, that);

  // atom.commands.dispatch(atom.views.getView(atom.workspace), "tree-view:show");

  that.floourl = floourl;

  // const AtomListener = require("./atom_listener");
  // this.atom_listener = new AtomListener(that.bufs, that.users, that.me);
  // this.atom_listener.start();
  const editorAction = require("./common/editor_action");
  const prefs = require("./common/userPref_model");
  editorAction.set(that.bufs, prefs);

  const FlooHandler = require("./common/handlers/floohandler").FlooHandler;
  const created: boolean = false;
  that.handler = new FlooHandler(floobitsPath, floourl, that.me, that.users, that.bufs, that.filetree, created);
  const WebRTC = require("./common/webrtc");
  that.webrtc = new WebRTC(that.users, that.me);
  const statusBar = require("./build/status_bar");
  const view = statusBar({floourl: floourl, me: that.me});
  const reactStatusBar = require("./react_wrapper").create_node("status-bar", view);
  // that.statusBar = atom.workspace.addBottomPanel({item: reactStatusBar});

  that.open_chat();
  that.bufs.start();
  that.handler.start(auth);
  // if (atom.config.get("floobits.userList")) {
  //   that.user_list();
  // }

}

// this method is called when your extension is deactivated
export function deactivate() {
}
