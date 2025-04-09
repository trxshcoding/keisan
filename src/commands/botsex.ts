import { ApplicationCommandType, ContextMenuCommandBuilder, ContextMenuCommandInteraction, InteractionContextType, Snowflake } from "discord.js";
import { ContextCommand } from "../command.ts";

export default class RailUser extends ContextCommand {
    contextDefinition: ContextMenuCommandBuilder =
        new ContextMenuCommandBuilder()
            .setName('rail')
            .setType(ApplicationCommandType.User)
    async run(interaction: ContextMenuCommandInteraction, target: Snowflake): Promise<void> {
        await interaction.reply(`Raililng <@${target}>.`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        await interaction.editReply(`UHGhghgghghgh. Railing successfull.`)
    }
}