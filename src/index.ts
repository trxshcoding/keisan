import config from "../config.json" with {type: "json"};
import {
    ActionRow,
    ActionRowBuilder,
    Application,
    ApplicationIntegrationType,
    ButtonBuilder,
    ButtonStyle,
    Client,
    EmbedBuilder,
    Events,
    GatewayIntentBits,
    InteractionContextType,
    REST,
    Routes,
    SlashCommandBuilder
} from "discord.js";
import { getSongOnPreferredProvider } from "./helper.ts";

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
        .setDescription("balls")
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
        Routes.applicationCommands(client.user.id), { body: commands },
    );
    // @ts-ignore
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
})

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    if (commandName !== "nowplaying") return;
    await interaction.deferReply()


    const meow = await fetch(`https://api.listenbrainz.org/1/user/${config.listenbrainzAccount}/playing-now`).then((res) => res.json());
    if (!meow) {
        interaction.followUp("something shat itself!");
        return;
    }
    if (meow.payload.count === 0) {
        interaction.followUp("user isnt listening to music");
    } else {
        const track_metadata = meow.payload.listens[0].track_metadata
        const link = keepV(track_metadata.additional_info.origin_url)

        const preferredApi = getSongOnPreferredProvider(await fetch(`https://api.song.link/v1-alpha.1/links?url=${link}`).then(a => a.json()), link)
        const embed = new EmbedBuilder()
            .setAuthor({
                name: preferredApi.artist,
            })
            .setTitle(preferredApi.title)
            .setThumbnail(preferredApi.thumbnailUrl)
            .setFooter({
                text: "amy jr",
            });
            const nya = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setURL(preferredApi.link).setLabel("link").setStyle(ButtonStyle.Link))
        interaction.followUp({
            components: [
                nya
            ],
            embeds: [embed]
        });
    }

})

await client.login(config.token);