#!/usr/bin/env node

import { parseArgs, usage } from "./cli/args.js";
import { runSimulation } from "./simulation/runSimulation.js";
import type { Config } from "./shared/types.js";

async function main(): Promise<void> {
  let config: Config;

  try {
    config = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}\n`);
    console.error(usage());
    process.exit(1);
  }

  await runSimulation(config);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
