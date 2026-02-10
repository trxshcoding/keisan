import {
  Events,
  InteractionContextType,
  type Client,
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ContextMenuCommandInteraction,
  type ModalSubmitInteraction,
  type Interaction,
} from "discord.js";
import type { AppContext } from "./context.ts";
import {
  type AnyCommand,
  type Command,
  type ContextCommand,
  type PackagedCommand,
} from "../command.ts";
import { respondWithDevError } from "../lib/errors.ts";

function replyWithError(interaction: Exclude<Interaction, AutocompleteInteraction>, e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  const truncated = message?.slice(0, 1800) || "unexpected error";

  if (message.includes("Missing Permissions")) {
    void (interaction.deferred || interaction.replied
      ? interaction.followUp("missing permissions")
      : interaction.reply("missing permissions"));
  } else if (message.includes("AutoMod")) {
    void (interaction.deferred || interaction.replied
      ? interaction.followUp("automod has blocked me")
      : interaction.reply("automod has blocked me"));
  } else {
    void (interaction.deferred || interaction.replied
      ? // fuck you tasky
        interaction.followUp("something sharted itself")
      : interaction.reply("something sharted itself"));
  }
}

export function makeDefaultAvailableEverywhere<
  T extends {
    setContexts(...contexts: Array<InteractionContextType>): any;
    readonly contexts?: InteractionContextType[];
  },
>(t: T): T {
  if (!t.contexts)
    t.setContexts(
      InteractionContextType.BotDM,
      InteractionContextType.Guild,
      InteractionContextType.PrivateChannel,
    );
  return t;
}

type SlashCommand = PackagedCommand<Command<unknown>, unknown>;
type ContextCmd = PackagedCommand<ContextCommand<any, unknown>, unknown>;
type CommandLookup<T> = Record<string, T>;

type MergedConfig = AppContext["config"] & Record<string, unknown>;

const buildConfig = (command: { storedConfig?: unknown }, ctx: AppContext): MergedConfig =>
  Object.assign({}, ctx.config, (command.storedConfig ?? {}) as Record<string, unknown>);

export function wireInteractions(
  client: Client,
  slash: PackagedCommand<AnyCommand<unknown>, unknown>[],
  context: PackagedCommand<AnyCommand<unknown>, unknown>[],
  ctx: AppContext,
) {
  const slashCommands = slash.filter(isSlashCommand);
  const contextCommands = context.filter(isContextCommand);

  const slashLookup: CommandLookup<SlashCommand> = Object.fromEntries(
    slashCommands.map((it) => [it.slashCommand.name, it]),
  );
  const contextLookup: CommandLookup<ContextCmd> = Object.fromEntries(
    contextCommands.map((it) => [it.contextDefinition.name, it]),
  );

  // Sanity check: context definition type matches target type
  contextCommands.forEach((it) => {
    if (it.contextDefinition.type !== it.targetType) {
      throw new Error(`${it.contextDefinition.name} has a different type than ${it.targetType}`);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleSlash(interaction, slashLookup, ctx);
      } else if (interaction.isContextMenuCommand()) {
        await handleContext(interaction, contextLookup, ctx);
      } else if (interaction.isAutocomplete()) {
        await handleAutocomplete(interaction, slashLookup, ctx);
      } else if (interaction.isButton()) {
        await handleButton(interaction, slashLookup, ctx);
      } else if (interaction.isModalSubmit()) {
        await handleModal(interaction, slashLookup, contextLookup, ctx);
      }
    } catch (e) {
      console.error("Router error", e);
      if (interaction.isRepliable()) {
        await respondWithDevError(interaction, e);
      }
      if (interaction.isRepliable()) {
        replyWithError(interaction, e);
      }
    }
  });
}

async function handleSlash(
  interaction: ChatInputCommandInteraction,
  lookup: CommandLookup<SlashCommand>,
  ctx: AppContext,
) {
  const command = lookup[interaction.commandName];
  if (!command) return;
  const config = { ...buildConfig(command, ctx), http: ctx.http, s3: ctx.s3 };
  await command.run(interaction, config);
}

async function handleContext(
  interaction: ContextMenuCommandInteraction,
  lookup: CommandLookup<ContextCmd>,
  ctx: AppContext,
) {
  const command = lookup[interaction.commandName];
  if (!command) return;
  const target = interaction.isUserContextMenuCommand()
    ? interaction.targetUser
    : interaction.isMessageContextMenuCommand()
      ? interaction.targetMessage
      : null;
  if (!target) return;
  const config = { ...buildConfig(command, ctx), http: ctx.http, s3: ctx.s3 };
  await command.run(interaction, target, config);
}

async function handleAutocomplete(
  interaction: AutocompleteInteraction,
  lookup: CommandLookup<SlashCommand>,
  ctx: AppContext,
) {
  const command = lookup[interaction.commandName];
  if (!command || !command.autoComplete) return;
  const focused = interaction.options.getFocused(true);
  const config = { ...buildConfig(command, ctx), http: ctx.http, s3: ctx.s3 };
  await command.autoComplete(interaction, config, focused);
}

async function handleButton(
  interaction: ButtonInteraction,
  lookup: CommandLookup<SlashCommand>,
  ctx: AppContext,
) {
  const parentInteraction = interaction.message.interaction;
  if (!parentInteraction) return;
  const commandName = parentInteraction.commandName.split(" ")[0];
  const command = lookup[commandName];
  if (!command || !command.button) return;
  const config = { ...buildConfig(command, ctx), http: ctx.http, s3: ctx.s3 };
  await command.button(interaction, config);
}

async function handleModal(
  interaction: ModalSubmitInteraction,
  slashLookup: CommandLookup<SlashCommand>,
  contextLookup: CommandLookup<ContextCmd>,
  ctx: AppContext,
) {
  if (interaction.customId.startsWith("CC:")) {
    const commandName = interaction.customId.split("|")[0].replace("CC:", "");
    const command = contextLookup[commandName];
    if (command?.modal) {
      const config = { ...buildConfig(command, ctx), http: ctx.http, s3: ctx.s3 };
      await command.modal(interaction, config);
    }
    return;
  }
  const commandName = interaction.customId.split("|")[0];
  const command = slashLookup[commandName];
  if (command?.modal) {
    const config = { ...buildConfig(command, ctx), http: ctx.http, s3: ctx.s3 };
    await command.modal(interaction, config);
  }
}

function isSlashCommand(cmd: PackagedCommand<AnyCommand<unknown>, unknown>): cmd is SlashCommand {
  return "slashCommand" in cmd;
}

function isContextCommand(cmd: PackagedCommand<AnyCommand<unknown>, unknown>): cmd is ContextCmd {
  return "contextDefinition" in cmd;
}
