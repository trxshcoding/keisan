//thank you to https://git.lunya.pet/Lunya/Ai for the inspiration
import {Command} from "../command.ts";
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
import type {Config} from "../config.ts";
import {trimWhitespace} from "../helper.ts";

const fediUserRegex = /@[^.@\s]+@(?:[^.@\s]+\.)+[^.@\s]+/

export default class fediLookUpCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        await interaction.deferReply();
        const fedistring = interaction.options.getString("string")!
        if (!fediUserRegex.test(fedistring)) {
            //we're just gonna assume this is a note id
            const resp = await fetch(`https://${config.sharkeyInstance}/api/notes/show`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    noteId: fedistring,
                })
            }).then(res => res.json())
            if ("error" in resp) {
                await interaction.followUp(`nyaaaa 3:\n\`${resp.error.code}\``);
                return;
            }
            let mainComponent
            const components:(TextDisplayBuilder|ContainerBuilder|ActionRowBuilder<MessageActionRowComponentBuilder>)[] = [
                mainComponent = new ContainerBuilder()
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
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(resp.text),
                    )
                    .setSpoiler(resp.cw !== null),
                new ActionRowBuilder<MessageActionRowComponentBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Link)
                            .setLabel("view post")
                            .setURL(resp.uri),
                    ),
            ]


            if (resp.files.length > 0){
                const images = new MediaGalleryBuilder()
                for (const file of resp.files) {
                    if (!file.type.startsWith("image/")) {
                        continue;
                    }
                    images.addItems(
                        new MediaGalleryItemBuilder()
                            .setURL(file.url)
                            .setDescription(file.comment)
                            .setSpoiler(file.isSensitive)
                    )
                }
                mainComponent.addMediaGalleryComponents(
                    images,
                )
            }
            if (resp.cw !== null) {
                components.unshift(new TextDisplayBuilder().setContent("cw: "+ resp.cw))
            }
            await interaction.followUp({
                components: components,
                flags: [MessageFlags.IsComponentsV2],
            });
            return;
        }
        const userhost = trimWhitespace(fedistring.split("@").splice(1))

        const resp = await fetch(`https://${config.sharkeyInstance}/api/users/show`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: userhost[0],
                host: userhost[1],
            })
        }).then(res => res.json())
        if ("error" in resp) {
            await interaction.followUp(`nyaaaa 3:\n\`${resp.error.code}\``);
            return;
        }
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
                        .setURL(resp.url),
                ),
        ];
        await interaction.followUp({
            components,
            flags: [MessageFlags.IsComponentsV2],
        });
    }

    slashCommand = new SlashCommandBuilder()
        .setName("fedilookup")
        .setDescription("look up shit from fedi").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ]).addStringOption(option => {
                return option.setName("string").setDescription("either note id or user").setRequired(true);
            }
        )
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}