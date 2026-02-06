import { declareCommand } from "../command.ts";
import {
  ApplicationIntegrationType,
  ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { lFmArtistResponseShape, mBSearchResponseShape } from "../music.ts";
import { z } from "zod";
import { httpJson } from "../lib/http.ts";

async function getNowPlayingArtist(
  username: string,
  lastFMApiKey: string,
  shoulduseLastfm: boolean,
) {
  if (!shoulduseLastfm) {
    const res = await httpJson<any>(`https://api.listenbrainz.org/1/user/${username}/playing-now`);
    if (!res?.payload || res.payload.count === 0) return;
    const searchRes = await searchMusicBrainzArtist(
      res.payload.listens[0].track_metadata.artist_name,
    );
    if (!searchRes) return;

    const lastFmRes = await getLastfmArtist(
      res.payload.listens[0].track_metadata.artist_mbids?.[0] ?? searchRes.id,
      lastFMApiKey,
    );
    if (lastFmRes === false) {
      return { partial: true, ...searchRes };
    }
    return { ...lastFmRes.artist };
  } else {
    const res = await httpJson<any>(`https://api.listenbrainz.org/1/user/${username}/playing-now`);
    if (!res?.recenttracks || !res.recenttracks?.track?.[0]) return;
    else {
      const track = res.recenttracks.track[0];
      const searchRes = await searchMusicBrainzArtist(track.artist["#text"]);
      if (!searchRes) return;

      const lastFmRes = await getLastfmArtist(track.artist.mbid || searchRes.id, lastFMApiKey);
      if (lastFmRes === false) {
        return { partial: true, ...searchRes };
      }
      return { ...lastFmRes.artist };
    }
  }
}

async function searchMusicBrainzArtist(artistName: string) {
  const resp = await httpJson<any>(
    `https://musicbrainz.org/ws/2/artist/?query=artist:${artistName}&fmt=json`,
  );

  const maybeArtist = mBSearchResponseShape.safeParse(resp);
  if (!maybeArtist.success) {
    return;
  }
  return maybeArtist.data.artists[0];
}

async function getLastfmArtist(artistMbid: string, lastfmKey: string) {
  const resp = await httpJson<any>(
    `https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&mbid=${artistMbid}&api_key=${lastfmKey}&format=json&limit=1`,
  );
  const maybeArtist = lFmArtistResponseShape.safeParse(resp);
  if (!maybeArtist.success) {
    return false;
  }
  return maybeArtist.data;
}

export default declareCommand({
  run: async function (interaction: ChatInputCommandInteraction, config) {
    await interaction.deferReply();
    const otherUser = interaction.options.getUser("discord_user");
    let user: string | null;
    let useLastFM: boolean | null;

    if (otherUser) {
      const entry = await config.prisma.user.findFirst({
        where: { id: otherUser.id },
      });
      if (!entry?.musicUsername) {
        await interaction.followUp({
          content: `${otherUser.username} doesn't have a music account saved`,
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }
      user = entry.musicUsername;
      useLastFM = !entry.musicUsesListenbrainz;
    } else {
      const entry = await config.prisma.user.findFirst({
        where: { id: interaction.user.id },
      });
      user = interaction.options.getString("user");
      useLastFM = interaction.options.getBoolean("uselastfm");

      if (entry?.musicUsername) {
        user ??= entry.musicUsername;
        useLastFM ??= !entry.musicUsesListenbrainz;
      }
    }

    if (user === null || useLastFM === null) {
      await interaction.followUp({
        content:
          "you don't have a music account saved. use the `/config nowplaying` command to save them, or specify them as arguments to only use once",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const nowPlayingArtist = await getNowPlayingArtist(user, config.lastFMApiKey, useLastFM);

    if (!nowPlayingArtist) {
      await interaction.followUp({
        content: "something somehow broke :P",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }
    if ("partial" in nowPlayingArtist) {
      await interaction.followUp({
        content: `${nowPlayingArtist.name} (${nowPlayingArtist.id})
-# couldn't find more info`,
      });
    } else {
      await interaction.followUp({
        content: `${nowPlayingArtist.name} (${nowPlayingArtist.mbid})
${nowPlayingArtist.tags.tag.map((t) => t.name).join(", ")}

${nowPlayingArtist.bio.summary}`,
      });
    }
  },
  dependsOn: z.object({
    lastFMApiKey: z.string(),
  }),
  slashCommand: new SlashCommandBuilder()
    .setName("nowplayingartist")
    .addStringOption((option) => {
      return option.setName("user").setDescription("username").setRequired(false);
    })
    .addBooleanOption((option) => {
      return option
        .setName("uselastfm")
        .setDescription("use last.fm or listenbrainz")
        .setRequired(false);
    })
    .addUserOption((option) => {
      return option
        .setName("discord_user")
        .setDescription(
          "a user with their music account saved by the bot. has priority over other options",
        )
        .setRequired(false);
    })
    .setDescription("get information about the current playing artist")
    .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
    .setContexts([
      InteractionContextType.BotDM,
      InteractionContextType.Guild,
      InteractionContextType.PrivateChannel,
    ]),
});
