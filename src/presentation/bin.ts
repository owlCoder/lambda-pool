#!/usr/bin/env node
// Executable shim: wires real process I/O into the testable runCli().
import { runCli } from "./cli.ts";

const code = await runCli({
  argv: process.argv.slice(2),
  env: process.env,
  out: (s) => console.log(s),
  err: (s) => console.error(s),
});
process.exit(code);
