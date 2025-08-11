//thank you to https://git.lunya.pet/Lunya/Ai for the inspiration
import {
    ActionRowBuilder,
    ApplicationIntegrationType,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    ContainerBuilder,
    InteractionContextType,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    type MessageActionRowComponentBuilder,
    MessageFlags,
    SectionBuilder,
    SlashCommandBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder
} from "discord.js";
import {trimWhitespace} from "../util.ts";
import {declareCommand} from "../command.ts";
import {z} from "zod";

const fediUserRegex = /@[^.@\s]+@(?:[^.@\s]+\.)+[^.@\s]+/

export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config) {
        await interaction.deferReply();
        const fedistring = interaction.options.getString("string")!
        let shit = fedistring;
        if (fediUserRegex.test(fedistring) && !fedistring.startsWith("http")) {
            const [user, host] = trimWhitespace(fedistring.split("@").splice(1))
            //SURELY every instance has tls right?
            shit = `https://${host}/@${user}`
        }

        const {object: resp, type} = await fetch(`https://${config.sharkeyInstance}/api/ap/show`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.sharkeyToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uri: shit
            })
        }).then(res => res.json())
        if ("error" in resp) {
            await interaction.followUp(`nyaaaa 3:\n\`${resp.error.code}\``);
            console.log(resp);
            return;
        }
        if (type === "Note") {
            let mainComponent
            const components: (TextDisplayBuilder | ContainerBuilder | ActionRowBuilder<MessageActionRowComponentBuilder>)[] = [
                mainComponent = new ContainerBuilder()
                    .setSpoiler(resp.cw !== null)
                    .addSectionComponents(
                        new SectionBuilder()
                            .setThumbnailAccessory(
                                new ThumbnailBuilder()
                                    .setURL(resp.user.avatarUrl)
                            )
                            .addTextDisplayComponents(
                                /*
                                if host is null, its the same host as the api
                                why is it written like this? idfk
                                */
                                new TextDisplayBuilder().setContent(`## ${resp.user.name} (@${resp.user.username}@${resp.user.host === null ? config.sharkeyInstance : resp.user.host})`),
                            ),
                    ),
                new ActionRowBuilder<MessageActionRowComponentBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Link)
                            .setLabel("view post")
                            /*
                            im done with this garbage. `resp.uri` is NOT EVEN THERE when THE FUCKING instance IS THE SAME
                            as the FUCKIOGN G WERDSKLP;GVFHEWRL'VGFHNCEW'RLFPVBHNGETFVBN

                            */
                            .setURL(!resp.uri ? `https://${config.sharkeyInstance}/notes/${fedistring}` : resp.uri),
                    ),
            ]

            if (resp.text) {
                mainComponent.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(resp.text),
                )
            }

            if (resp.files.length > 0) {
                const images = new MediaGalleryBuilder()
                for (const file of resp.files) {
                    if (!file.type.startsWith("image/")) {
                        continue;
                    }
                    let img
                    images.addItems(
                        img = new MediaGalleryItemBuilder()
                            .setURL(file.url)
                            .setSpoiler(file.isSensitive)
                    )
                    if (file.comment) img.setDescription(file.comment)
                }
                mainComponent.addMediaGalleryComponents(
                    images,
                )
            }
            if (resp.cw !== null) {
                components.unshift(new TextDisplayBuilder().setContent("cw: " + resp.cw))
            }
            await interaction.followUp({
                components: components,
                flags: [MessageFlags.IsComponentsV2],
            });
            return;
        } else if (type === "User") {
            const components = [
                new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .setThumbnailAccessory(
                                new ThumbnailBuilder()
                                    .setURL(resp.avatarUrl)
                            )
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## ${resp.name}`),
                                //same as above. host is null when its the same as the api
                                new TextDisplayBuilder().setContent(`@${resp.username}@${resp.host === null ? config.sharkeyInstance : resp.host}`),
                            ),
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(resp.description),
                    ),
                new ActionRowBuilder<MessageActionRowComponentBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Link)
                            .setLabel("go to profile")
                            /*
                            the fucking `resp.url` is null when the host is the same as the api. who designed this???????
                            thankfully since we're working with a sharkey api, we're ssure this is how the link is
                            structured, so we can just make it the fuck up
                            */
                            .setURL(resp.url === null ? `https://${config.sharkeyInstance}/@${resp.username}` : resp.url),
                    ),
            ];
            await interaction.followUp({
                components,
                flags: [MessageFlags.IsComponentsV2],
            });

        }

    },
    dependsOn: z.object({
        sharkeyInstance: z.string(),
        sharkeyToken: z.string()
    }),
    slashCommand: new SlashCommandBuilder()
        .setName("fedilookup")
        .setDescription("look up shit from fedi").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ]).addStringOption(option => {
            return option.setName("string").setDescription("either note id or user").setRequired(true);
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ])
})