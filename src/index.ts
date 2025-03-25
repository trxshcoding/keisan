import {
    Client,
    Events,
    GatewayIntentBits,
    InteractionCallback,
    REST,
    Routes,
} from "discord.js";
import path from "node:path";
import fs from "node:fs";
import { Command } from "./command.ts";
import { fileURLToPath } from "url";
import { config } from "./config.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
    intents: [],
});

const commands: Command[] = []


const commandDir = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandDir)) {
    if (!file.endsWith('.ts')) continue
    let command = await import(path.join(commandDir, file));
    commands.push(new command.default())
}

const commandLookup = Object.fromEntries(commands.map(it => [it.slashCommand.name, it]))

client.once(Events.ClientReady, async () => {
    console.log("Ready");
    const rest = new REST().setToken(config.token);
    const data = await rest.put(
        Routes.applicationCommands(client.user!.id), { body: commands.map(command => command.slashCommand.toJSON()) },
    );
    // @ts-ignore
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
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
        await command.run(interaction, config);
    } catch (e) {
        console.error("error during command execution: " + commandName, e)
        interaction.reply("something sharted itself")
    }

})

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isAutocomplete()) return
    const {commandName} = interaction;

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

await client.login(config.token);
