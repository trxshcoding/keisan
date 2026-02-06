import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "pathe";
import {
  tryPackageCommand,
  undeclareCommand,
  type AnyCommand,
  type Command,
  type ContextCommand,
  type PackagedCommand,
} from "../command.ts";
import { fromRoot } from "../lib/paths.ts";

export type CommandBundle = {
  all: PackagedCommand<AnyCommand<unknown>, unknown>[];
  slash: Array<PackagedCommand<Command<unknown>, unknown>>;
  context: Array<PackagedCommand<ContextCommand<any, unknown>, unknown>>;
};

/**
 * Dynamically load commands from the `src/commands` directory.
 */
export async function loadCommands(
  commandPath = join(fromRoot("src"), "commands"),
): Promise<CommandBundle> {
  const all: PackagedCommand<AnyCommand<unknown>, unknown>[] = [];
  const files = fs.readdirSync(commandPath).filter((f) => f.endsWith(".ts"));

  for (const file of files) {
    const full = join(commandPath, file);
    const mod = await import(pathToFileURL(full).href);
    try {
      const declared = undeclareCommand(mod.default);
      const packaged = tryPackageCommand(declared);
      all.push(packaged);
    } catch {
      // do NOT print out `err` here, it fucking crashes node❓❓❓❓❓
      console.warn(`Could not instantiate command from ${file}:`);
    }
  }

  const slash = all.filter(isSlashCommand);
  const context = all.filter(isContextCommand);
  return { all, slash, context };
}

function isSlashCommand(
  cmd: PackagedCommand<AnyCommand<unknown>, unknown>,
): cmd is PackagedCommand<Command<unknown>, unknown> {
  return "slashCommand" in cmd;
}

function isContextCommand(
  cmd: PackagedCommand<AnyCommand<unknown>, unknown>,
): cmd is PackagedCommand<ContextCommand<any, unknown>, unknown> {
  return "contextDefinition" in cmd;
}
