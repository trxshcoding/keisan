import {
    ApplicationCommandType, AttachmentBuilder,
    ContextMenuCommandBuilder,
    ContextMenuCommandInteraction,
    Message, type User
} from "discord.js";
import {Buffer} from 'node:buffer';
import { ContextCommand } from "../command.ts";
import type {Config} from "../config.ts";

export default class Mock extends ContextCommand<User> {
    targetType: ApplicationCommandType.User = ApplicationCommandType.User;
    contextDefinition: ContextMenuCommandBuilder =
        new ContextMenuCommandBuilder()
            .setName('getavatar')
            .setType(ApplicationCommandType.User)
    async run(interaction:ContextMenuCommandInteraction, target:User, config:Config): Promise<void> {
        await interaction.deferReply()
        const avatar = target.avatarURL({
            size: 4096
        })
        console.log(avatar)
        if (!avatar) {
            await interaction.followUp("user doesnt have an avatar")
            return
        }
        const buffer = await fetch(avatar).then((r) => r.arrayBuffer())
        await interaction.followUp({
            files: [
                new AttachmentBuilder(Buffer.from(buffer))
                    // i cant be arsed anymore. fuck this shit
                    // TODO:sunnie will fix this
                    .setName("meow." + avatar.replaceAll("https://", "").split("/")[3].split(".")[1].replaceAll("?size=4096", ""))
            ],
        })
    }
}