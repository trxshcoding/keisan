import {
    ApplicationCommandType,
    Client,
    Events,
    InteractionContextType,
    REST,
} from "discord.js";
import path from "node:path";
import fs from "node:fs";
import { Command, ContextCommand, ICommand } from "./command.ts";
import { fileURLToPath } from "url";
import {type Config, config} from "./config.ts";
import {ListObjectsV2Command, S3Client} from "@aws-sdk/client-s3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
    intents: [],
});

const allCommands: ICommand[] = []


const commandDir = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandDir)) {
    if (!file.endsWith('.ts')) continue
    let command = await import(path.join(commandDir, file));
    let instance
    try {
        instance = new command.default()
    } catch (e) {
        throw new Error(`Could not instantiate command from ${file}`, { cause: e })
    }
    if (!(instance instanceof ICommand))
        throw `${instance} is not an ICommand instance (imported from ${file})`;
    allCommands.push(instance)
}
const commands = allCommands.filter(it => it instanceof Command);
const contextCommands = allCommands.filter(it => it instanceof ContextCommand);
const contextCommandLUT = Object.fromEntries(contextCommands.map(it => [it.contextDefinition.name, it]))
const commandLookup = Object.fromEntries(commands.map(it => [it.slashCommand.name, it]))

contextCommands.forEach(it => it.contextDefinition.type === it.targetType)

function makeDefaultAvailableEverywhere<T extends { setContexts(...contexts: Array<InteractionContextType>): any, readonly contexts?: InteractionContextType[] }>(t: T): T {
    if (!t.contexts)
        t.setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
    return t
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
        await command.run(interaction, interaction.isUserContextMenuCommand() ? interaction.targetUser : interaction.targetMessage, config)
    } catch (e) {
        console.error("error during context command execution: " + commandName, e)
        interaction.reply("something sharted itself")
    }
});
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    const command = commandLookup[commandName]
    if (!command) {
        console.error("unknown command: " + commandName)
        return
    }

    try {
        await command.run(interaction, config);
    } catch (e) {
        console.error("error during command execution: " + commandName, e)
        interaction.reply("something sharted itself")
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
        await command.autoComplete(interaction, config, interaction.options.getFocused(true));
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
        await command.button(interaction, config);
    } catch (e) {
        console.error("error during command execution: " + commandName, e)
    }


})
await client.login(config.token);
