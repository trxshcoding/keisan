import config from "../config.json" with {type: "json"};
import {
    Application,
    ApplicationIntegrationType,
    Client,
    Events,
    GatewayIntentBits,
    InteractionContextType,
    REST,
    Routes,
    SlashCommandBuilder
} from "discord.js";

const client = new Client({
    intents: Object.keys(GatewayIntentBits).map((a) => {
        //@ts-ignore
        return GatewayIntentBits[a]
    }),
});

function keepV(url) {
    const urlObj = new URL(url);
    const vParam = urlObj.searchParams.get("v");

    urlObj.search = "";

    if (vParam) {
        urlObj.searchParams.set("v", vParam);
    }

    return urlObj.toString();
}

const commands = [
    new SlashCommandBuilder().setName("nowplaying")
        .setDescription("balls").addStringOption(option =>
            option
            .setName("user")
            .setDescription("username")
            .setRequired(true)
        )
        .setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ])
].map(command => command.toJSON())


client.once(Events.ClientReady, async () => {
    console.log("Ready");
    const rest = new REST().setToken(config.token);
    const data = await rest.put(
        Routes.applicationCommands(client.user.id), {body: commands},
    );
    // @ts-ignore
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
})

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const {commandName} = interaction;
    if (commandName !== "nowplaying") return;
    await interaction.deferReply()

    const user = interaction.options.getString('user');

    const meow = await fetch(`https://api.listenbrainz.org/1/user/${user}/playing-now`).then((res) => res.json());
    if (!meow) {
        interaction.followUp("something shat itself!");
        return;
    }
    if (meow.payload.count === 0) {
        interaction.followUp("user isnt listening to music");
    } else {
        interaction.followUp("[" + meow.payload.listens[0].track_metadata.artist_name + " - " + meow.payload.listens[0].track_metadata.track_name + "](" + keepV(meow.payload.listens[0].track_metadata.additional_info.origin_url) + ")");
    }

})

await client.login(config.token);