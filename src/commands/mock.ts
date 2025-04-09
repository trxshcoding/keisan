import {
    ApplicationCommandType,
    ContextMenuCommandBuilder,
    ContextMenuCommandInteraction,
    InteractionContextType,
    Message,
    Snowflake,
    User
} from "discord.js";
import { ContextCommand } from "../command.ts";

export default class Mock extends ContextCommand<Message> {
    targetType: ApplicationCommandType.Message = ApplicationCommandType.Message;
    contextDefinition: ContextMenuCommandBuilder =
        new ContextMenuCommandBuilder()
            .setName('mock')
            .setType(ApplicationCommandType.Message)
    async run(interaction: ContextMenuCommandInteraction, target: Message): Promise<void> {
        await interaction.deferReply();
        let message = target.content;
        message = message.replace(/(.)(.)/g, (a,b,c)=>b.toLowerCase() + c.toUpperCase())
        await interaction.followUp(message);
    }
}