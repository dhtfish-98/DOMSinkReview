#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
import { run } from './cli-runner.mjs';
process.exitCode = await run(process.argv.slice(2), process.stdin, process.stdout);
