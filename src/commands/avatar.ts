import {
    ApplicationCommandType, AttachmentBuilder,
    ContainerBuilder,
    ContextMenuCommandBuilder,
    ContextMenuCommandInteraction,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    Message, MessageFlags, type User
} from "discord.js";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";
import { declareCommand } from "../command.ts";

export default declareCommand({
    commandName: "getavatar",
    dependsOn: NO_EXTRA_CONFIG,
    targetType: ApplicationCommandType.User,
    contextDefinition:
        new ContextMenuCommandBuilder()
            .setName('get avatar')
            .setType(ApplicationCommandType.User),
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
})