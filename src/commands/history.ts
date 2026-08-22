import { declareCommand } from "../command.ts";
import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { z } from "zod";
import { escapeMarkdown } from "../utils/general.ts";
import { httpJson } from "../lib/http.ts";
import { trackContainer } from "../music/components.ts";
import { resolveTrackFromLink } from "../music/link-resolve.ts";
import { searchMusicPlatforms } from "../music/search.ts";
import { resolveMusicUser } from "../music/user.ts";

type HistoryItem = {
  songName: string;
  artistName: string;
  albumName?: string;
  link?: string;
};
async function getHistory(
  username: string,
  lastFMApiKey?: string,
): Promise<HistoryItem[] | undefined> {
  if (!lastFMApiKey) {
    const res = await httpJson<{ payload?: { listens: Array<{ track_metadata: any }> } }>(
      `https://api.listenbrainz.org/1/user/${username}/listens`,
    );
    if (!res?.payload) return;
    else {
      return res.payload.listens.map((l: any) => ({
        songName: l.track_metadata.track_name,
        artistName: l.track_metadata.artist_name,
        albumName: l.track_metadata.release_name,
        link: l.track_metadata.additional_info?.origin_url,
      }));
    }
  } else {
    const res = await httpJson<any>(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${lastFMApiKey}&format=json`,
    );
    if (!res?.recenttracks) return;
    else {
      const tracks = res.recenttracks.track;
      if (!tracks) return;
      return tracks
        .filter((t: any) => !t["@attr"]?.nowplaying)
        .map((t: any) => ({
          songName: t.name,
          artistName: t.artist["#text"],
          albumName: t.album["#text"],
        }));
    }
  }
}

const songEmbed = (h: HistoryItem[], pos: number, username: string, useLastFM: boolean) =>
  new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ${escapeMarkdown(h[pos].songName)}
-# by ${escapeMarkdown(h[pos].artistName)}${h[pos].albumName ? ` - from ${escapeMarkdown(h[pos].albumName)}` : ""}`),
    )
    .addActionRowComponents(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setEmoji({
            name: "⬅️",
          })
          .setCustomId(`back-${pos - 1}-${username}-${useLastFM ? "f" : "l"}`)
          .setDisabled(pos === 0),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel("expand")
          .setCustomId(`expand-${pos}-${username}-${useLastFM ? "f" : "l"}`),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setEmoji({
            name: "➡️",
          })
          .setCustomId(`forward-${pos + 1}-${username}-${useLastFM ? "f" : "l"}`)
          .setDisabled(pos === h.length - 1),
      ),
    );

const historyCache = {
  listenbrainz: {} as { [k: string]: HistoryItem[] },
  lastfm: {} as { [k: string]: HistoryItem[] },
};

export default declareCommand({
  async run(interaction: ChatInputCommandInteraction, config) {
    await interaction.deferReply();

    const musicUser = await resolveMusicUser(interaction, config.prisma).catch(
      (e: Error) =>
        void interaction.followUp({
          content: e.message,
          flags: [MessageFlags.Ephemeral],
        }),
    );
    if (!musicUser) return;

    const history = await getHistory(
      musicUser.username,
      musicUser.useLastFM ? config.lastFMApiKey : undefined,
    );

    if (!history || history.length === 0) {
      await interaction.followUp({
        content: "that user hasn't listened to anything lately",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }
    historyCache[musicUser.useLastFM ? "lastfm" : "listenbrainz"][musicUser.username] = history;

    await interaction.followUp({
      components: [songEmbed(history, 0, musicUser.username, musicUser.useLastFM)],
      flags: [MessageFlags.IsComponentsV2],
    });
  },
  async button(interaction, _config) {
    const [customId, posStr, username, platformLetter] = interaction.customId.split("-");
    const pos = Number(posStr);
    const platform = platformLetter === "f" ? "lastfm" : "listenbrainz";

    const history = historyCache[platform][username];
    if (!history || !history[pos]) {
      await interaction.followUp({
        content: "how",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    switch (customId) {
      case "back":
      case "forward": {
        if (interaction.user.id !== interaction.message.interactionMetadata?.user.id) {
          await interaction.deferUpdate();
          return;
        }
        await interaction.update({
          components: [songEmbed(history, pos, username, platform === "lastfm")],
          flags: [MessageFlags.IsComponentsV2],
        });
        break;
      }
      case "expand": {
        await interaction.deferReply({
          flags: [MessageFlags.Ephemeral],
        });
        const item = history[pos];
        let link = history[pos].link;

        if (!link && platform === "lastfm") {
          const searchResult = await searchMusicPlatforms(item.songName, item.artistName);
          if (searchResult) {
            link = searchResult.link;
            item.albumName ??= searchResult.albumName;
          }
        }
        if (!link) {
          await interaction.followUp({
            content: "couldn't find a link for that song, sorry",
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }

        const resolved = await resolveTrackFromLink(link);

        await interaction.followUp({
          components: [
            trackContainer({
              songName: resolved?.title ?? item.songName,
              artistName: resolved?.artist ?? item.artistName,
              albumName: item.albumName,
              coverUrl: resolved?.coverUrl,
              link,
            }),
          ],
          flags: [MessageFlags.IsComponentsV2],
        });
      }
    }
  },

  dependsOn: z.object({
    lastFMApiKey: z.string(),
  }),
  slashCommand: new SlashCommandBuilder()
    .setName("history")
    .setDescription("get the song history of a user")
    .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
    .addStringOption((option) => {
      return option.setName("user").setDescription("username").setRequired(false);
    })
    .addStringOption((option) => {
      return option
        .setName("platform")
        .setDescription("scrobble platform")
        .addChoices(
          { name: "Last.fm", value: "lastfm" },
          { name: "ListenBrainz", value: "listenbrainz" },
        )
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
    .setContexts([
      InteractionContextType.BotDM,
      InteractionContextType.Guild,
      InteractionContextType.PrivateChannel,
    ]),
});
