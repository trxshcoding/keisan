import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  ContextMenuCommandInteraction,
  Message,
} from "discord.js";
import { declareCommand } from "../command.ts";
import { NO_EXTRA_CONFIG } from "../config.ts";

export default declareCommand({
  commandName: "Mock",
  dependsOn: NO_EXTRA_CONFIG,
  targetType: ApplicationCommandType.Message,
  contextDefinition: new ContextMenuCommandBuilder()
    .setName("mock")
    .setType(ApplicationCommandType.Message),
  async run(interaction: ContextMenuCommandInteraction, target: Message): Promise<void> {
    await interaction.deferReply();
    let message = target.content;
    message = message.replace(/(.)(.)/g, (a, b, c) => b.toLowerCase() + c.toUpperCase());
    await interaction.followUp(message);
  },
});
