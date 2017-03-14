"use strict";

var util = require("util");

class FlooURL {
  host: string;
  port: number;
  owner: string;
  secure: boolean;
  workspace: string;

  constructor(owner: string, workspace: string, host: string, port: string) {
    this.owner = owner;
    this.workspace = workspace;
    this.host = host;
    this.port = parseInt(port, 10);
  }


  toAPIString (): string {
    return util.format("https://%s/api/room/%s/%s", this.host, this.owner, this.workspace);
  }

  toString (): string {
    return util.format("https://%s%s/%s/%s", this.host, this.port === 3448 ? "" : ":" + this.port, this.owner, this.workspace);
  }
};

export default FlooURL;
