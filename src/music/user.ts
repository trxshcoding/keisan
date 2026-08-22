import type { ChatInputCommandInteraction } from "discord.js";
import { PrismaClient } from "../generated/prisma/index.js";

export type MusicUser = {
  username: string;
  useLastFM: boolean;
  nowplayingView?: string | null;
};

export async function resolveMusicUser(
  interaction: ChatInputCommandInteraction,
  prisma: PrismaClient,
): Promise<MusicUser | null> {
  const otherUser = interaction.options.getUser("discord_user");

  if (otherUser) {
    const entry = await prisma.user.findFirst({
      where: { id: otherUser.id },
    });
    if (!entry?.musicUsername) {
      throw new Error(`${otherUser.username} doesn't have a music account saved`);
    }
    return {
      username: entry.musicUsername,
      useLastFM: !entry.musicUsesListenbrainz,
      nowplayingView: entry.nowplayingView,
    };
  }

  const entry = await prisma.user.findFirst({
    where: { id: interaction.user.id },
  });
  const user = interaction.options.getString("user");
  const useLastFMOption = interaction.options.getString("platform");

  if (entry?.musicUsername) {
    return {
      username: user ?? entry.musicUsername,
      useLastFM:
        useLastFMOption !== null ? useLastFMOption === "lastfm" : !entry.musicUsesListenbrainz,
      nowplayingView: entry.nowplayingView,
    };
  }

  if (user === null || useLastFMOption === null) {
    throw new Error(
      "you don't have a music account saved. use the `/config nowplaying` command to save them, or specify them as arguments to only use once",
    );
  }

  return { username: user, useLastFM: useLastFMOption === "lastfm" };
}
