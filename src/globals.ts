import FlooURL from './floourl';
import { ExtensionContext, workspace, window, Disposable, commands, Uri } from 'vscode';
import './globals_';

// TODO: turn into Interface or something and call new...
declare var fl: {
  PLUGIN_VERSION: string;
  base_path: string;
  editor_settings: {
    room_owner: string;
    room: string;
  }
  floourl: FlooURL;
  username: string;
  editor: {
    context: ExtensionContext;
    disposables: Disposable[];
    getConfiguration: (k: string, v: string) => string;
  }
};

export default fl;