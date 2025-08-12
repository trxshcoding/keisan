import {
    ApplicationCommandType,
    Client,
    Events,
    InteractionContextType,
    REST,
    type AutocompleteInteraction,
    type Interaction,
} from "discord.js";
import path from "node:path";
import fs from "node:fs";
import { tryPackageCommand, undeclareCommand, type AnyCommand, type PackagedCommand } from "./command.ts";
import { fileURLToPath } from "url";
import { type Config, config } from "./config.ts";
import { CopyObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { registerFont } from "canvas";
import * as tmp from 'tmp'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
tmp.setGracefulCleanup();
const client = new Client({
    intents: [],
});


const allCommands: PackagedCommand<AnyCommand<unknown>, unknown>[] = []
const commandDir = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandDir)) {
    if (!file.endsWith('.ts')) continue
    let command = await import(path.join(commandDir, file));
    try {
        const declaredCommand = undeclareCommand(command.default);
        const packagedCommand = tryPackageCommand(declaredCommand)
        allCommands.push(packagedCommand)
    } catch (e) {
        console.warn(`Could not instantiate command from ${file}`)
    }
}
const commands = allCommands.filter(it => 'slashCommand' in it);
const contextCommands = allCommands.filter(it => 'contextDefinition' in it);
const contextCommandLUT = Object.fromEntries(contextCommands.map(it => [it.contextDefinition.name, it]))
const commandLookup = Object.fromEntries(commands.map(it => [it.slashCommand.name, it]))

contextCommands.forEach(it => {
    if (it.contextDefinition.type !== it.targetType) {
        throw new Error(`${it.contextDefinition} has a different type than ${it.targetType}`)
    }
})

function makeDefaultAvailableEverywhere<T extends { setContexts(...contexts: Array<InteractionContextType>): any, readonly contexts?: InteractionContextType[] }>(t: T): T {
    if (!t.contexts)
        t.setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
    return t
}

function replyWithError(interaction: Exclude<Interaction, AutocompleteInteraction>) {
    interaction.deferred || interaction.replied
        ? interaction.followUp("something sharted itself")
        : interaction.reply("something sharted itself")
}

client.once(Events.ClientReady, async () => {
    console.log("Ready");
    const rest = new REST().setToken(config.token);
    const data = await client.application!.commands.set(
        [
            ...commands.map(it => it.slashCommand),
            ...contextCommands.map(it => it.contextDefinition)
        ].map(makeDefaultAvailableEverywhere)
    )
    // @ts-ignore
    console.log(`Successfully reloaded ${data.size} application (/) commands.`);
})
//me and my 1000 Events.InteractionCreates
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isContextMenuCommand()) return;
    const { commandName } = interaction
    const command = contextCommandLUT[commandName]
    if (!command) {
        console.error("unknown context command: " + commandName)
        return
    }
    // The <any> cast here is valid, since the type of the interaction is set in accordance to the definition
    if (command.targetType != (interaction.isUserContextMenuCommand() ? ApplicationCommandType.User : ApplicationCommandType.Message))
        console.error("Out of date discord definition of this context command")
    try {
        await command.run(interaction, interaction.isUserContextMenuCommand() ? interaction.targetUser : interaction.targetMessage, Object.assign({}, config, command.storedConfig))
    } catch (e) {
        console.error("error during context command execution: " + commandName, e)
        replyWithError(interaction)
    }
});
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith("CC:")) return
    const commandName = interaction.customId.split("|")[0]
    const command = contextCommandLUT[commandName.replaceAll("CC:", "")]
    if (!command) {
        console.error("unknown command: " + commandName)
        return
    }
    try {
        await command.modal?.(interaction, Object.assign({}, config, command.storedConfig));
    } catch (e) {
        console.error("error during command execution: " + commandName, e)
        replyWithError(interaction)
    }
})
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    const command = commandLookup[commandName]
    if (!command) {
        console.error("unknown command: " + commandName)
        return
    }

    try {
        await command.run(interaction, Object.assign({}, config, command.storedConfig));
    } catch (e) {
        console.error("error during command execution: " + commandName, e)
        replyWithError(interaction)
    }

})

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isAutocomplete()) return
    const { commandName } = interaction;

    const command = commandLookup[commandName]
    if (!command) {
        console.error("unknown command: " + commandName)
        return
    }

    try {
        await command.autoComplete?.(interaction, Object.assign({}, config, command.storedConfig), interaction.options.getFocused(true));
    } catch (e) {
        console.error("error during command execution: " + commandName, e)
    }
})
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.isMessageComponent()) return;
    //deprecated? skill issue.
    const { commandName } = interaction.message.interaction!;
    const command = commandLookup[commandName]
    if (!command) {
        console.error("unknown command: " + commandName)
        return
    }
    try {
        await command.button?.(interaction, Object.assign({}, config, command.storedConfig));
    } catch (e) {
        console.error("error during command execution: " + commandName, e)
        replyWithError(interaction)
    }
})

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    /*
    i dislike doing this very much. depending on customId
    for commandName means i cant just have it be whatever i want,
    it has to contain the commandName, but i dont *think*
    theres any other way. wanna prove me wrong? open a PR.
    i want you to fix this. please fix this

    update: sunnie just made it even more amazing
    */
    if (interaction.customId.startsWith("CC:")) return
    const commandName = interaction.customId.split("|")[0]

    const command = commandLookup[commandName]
    if (!command) {
        console.error("unknown command: " + commandName)
        return
    }
    try {
        await command.modal?.(interaction, Object.assign({}, config, command.storedConfig));
    } catch (e) {
        console.error("error during command execution: " + commandName, e)
    }
})
await client.login(config.token);
