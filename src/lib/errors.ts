import {
  EmbedBuilder,
  type InteractionReplyOptions,
  MessageFlags,
  type RepliableInteraction,
} from "discord.js";
import { consola } from "consola";

const log = consola.withTag("errors");

export function asEmbed(err: unknown): InteractionReplyOptions {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const embed = new EmbedBuilder()
    .setTitle("Command failed")
    .setDescription("```" + message + "```")
    .setColor(0xff5555);
  if (stack) {
    embed.addFields({ name: "Stack", value: "```" + stack.slice(0, 4000) + "```" });
  }
  return { embeds: [embed], flags: [MessageFlags.Ephemeral] };
}

/**
 * Reply with a dev-only error embed. In production, only logs.
 */
export async function respondWithDevError(interaction: RepliableInteraction, err: unknown) {
  log.error(err);
  if (process.env.NODE_ENV === "production") return;
  try {
    const payload = asEmbed(err);
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
    else await interaction.reply(payload);
  } catch (sendErr) {
    log.error("Failed to send dev error embed", sendErr);
  }
}
