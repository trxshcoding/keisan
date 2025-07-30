import {
    ApplicationCommandType, AttachmentBuilder,
    ContainerBuilder,
    ContextMenuCommandBuilder,
    ContextMenuCommandInteraction,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    Message, MessageFlags, type User
} from "discord.js";
import { Buffer } from 'node:buffer';
import { ContextCommand } from "../command.ts";
import type { Config } from "../config.ts";

export default class GetAvatar extends ContextCommand<User> {
    commandName = "getavatar";
    targetType: ApplicationCommandType.User = ApplicationCommandType.User;
    contextDefinition: ContextMenuCommandBuilder =
        new ContextMenuCommandBuilder()
            .setName('get avatar')
            .setType(ApplicationCommandType.User)
    async run(interaction: ContextMenuCommandInteraction, target: User, config: Config): Promise<void> {
        await interaction.deferReply()

        const avatar = target.avatarURL({
            size: 4096
        })
        if (!avatar) {
            await interaction.followUp("user doesn't have an avatar")
            return
        }

        const container =
            new ContainerBuilder().addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(avatar),
                ),
            )

        await target.fetch(true).then(user => {
            const banner = user.bannerURL({
                size: 4096
            })
            if (banner) container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(banner),
                ),
            )
        })

        await interaction.followUp({
            components: [container],
            flags: [MessageFlags.IsComponentsV2]
        })
    }
}