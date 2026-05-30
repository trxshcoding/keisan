import { Client, Events } from "discord.js";
import { consola } from "consola";
import { config } from "./config.ts";
import { loadCommands } from "./bot/registry.ts";
import { makeDefaultAvailableEverywhere, wireInteractions } from "./bot/router.ts";
import { appContext } from "./bot/context.ts";
import { fromRoot } from "./lib/paths.ts";

const client = new Client({ intents: [] });
const commandDir = fromRoot("src", "commands");

const { slash, context } = await loadCommands(commandDir);

client.once(Events.ClientReady, async () => {
  consola.ready("Discord client ready");
  const toRegister = [
    ...(slash as any[]).flatMap((it) => {
      const base = [it.slashCommand];
      const aliases = (it.aliases ?? [])
        .filter((alias: string) => alias !== it.slashCommand.name)
        .map((alias: string) => {
          const json = it.slashCommand.toJSON();
          return { ...json, name: alias };
        });
      return [...base.map((b) => b.toJSON()), ...aliases];
    }),
    ...(context as any[]).map((it) => it.contextDefinition),
  ].map(makeDefaultAvailableEverywhere);
  const data = await client.application!.commands.set(toRegister);
  // @ts-ignore
  consola.success(`Registered ${data.size} application (/) commands`);
});

wireInteractions(client, slash, context, appContext);

await client.login(config.token);
