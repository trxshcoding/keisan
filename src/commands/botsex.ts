import { ApplicationCommandType, ContextMenuCommandBuilder, ContextMenuCommandInteraction, InteractionContextType, Snowflake, User } from "discord.js";
import { ContextCommand } from "../command.ts";

export default class RailUser extends ContextCommand<User> {
    targetType: ApplicationCommandType.User = ApplicationCommandType.User;
    contextDefinition: ContextMenuCommandBuilder =
        new ContextMenuCommandBuilder()
            .setName('rail')
            .setType(ApplicationCommandType.User)
    async run(interaction: ContextMenuCommandInteraction, target: User): Promise<void> {
        await interaction.reply(`Raililng <@${target.id}>.`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        await interaction.editReply(`UHGhghgghghgh. Railing successfull.`)
    }
}