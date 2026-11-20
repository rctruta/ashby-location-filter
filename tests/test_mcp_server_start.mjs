// The MCP server must answer when started through a symlink, which is how
// npx and global installs run a package's command.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER = fileURLToPath(new URL("../mcp/server.js", import.meta.url));
const INITIALIZE = {
  jsonrpc: "2.0", id: 1, method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } },
};

function firstReply(entry) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry], { stdio: ["pipe", "pipe", "inherit"] });
    let out = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("no reply within 5s")); }, 5000);
    child.stdout.on("data", (chunk) => {
      out += chunk;
      if (out.includes("\n")) { clearTimeout(timer); child.kill(); resolve(JSON.parse(out.split("\n")[0])); }
    });
    child.on("exit", (code) => {
      if (!out) { clearTimeout(timer); reject(new Error(`exited with ${code} before replying`)); }
    });
    child.stdin.write(JSON.stringify(INITIALIZE) + "\n");
  });
}

test("answers initialize when started directly", async () => {
  const reply = await firstReply(SERVER);
  assert.equal(reply.result.serverInfo.name, "ashby-location-filter");
});

test("answers initialize when started through a symlink", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-link-"));
  const link = path.join(dir, "ashby-location-filter-mcp");
  fs.symlinkSync(SERVER, link);
  try {
    const reply = await firstReply(link);
    assert.equal(reply.result.serverInfo.name, "ashby-location-filter");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
