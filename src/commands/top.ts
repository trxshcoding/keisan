import { declareCommand } from "../command.ts";
import {
  ApplicationIntegrationType,
  ChatInputCommandInteraction,
  ContainerBuilder,
  InteractionContextType,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { resolveMusicUser } from "../music.ts";
import { httpJson } from "../lib/http.ts";
import { clamp } from "../utils/general.ts";
import { z } from "zod";

type FailureStatus = "USERNOTFOUND" | "UNKNOWNERROR";
interface TopMusicTrack {
  name: string;
  artistName: string;
  playCount: number;
}
interface TopMusicArtist {
  artistName: string;
  playCount: number;
}
interface TopMusicAlbum {
  albumName: string;
  artistName: string;
  playCount: number;
}

const topMusicListenbrainz = {
  getTracks: async (
    username: string,
    _?: string,
  ): Promise<{ status: "OK"; data: TopMusicTrack[] } | { status: FailureStatus }> => {
    const response = await httpJson(
      `https://api.listenbrainz.org/1/stats/user/${username}/recordings`,
    ).catch((error) => {
      if (error.response && error.response.status === 404) {
        return { iserror: true, status: "USERNOTFOUND" satisfies FailureStatus };
      } else {
        return { iserror: true, status: "UNKNOWNERROR" satisfies FailureStatus };
      }
    });
    if (response.iserror) return { status: response.status };

    return {
      status: "OK",
      data: (response.payload.recordings as any[]).map((r) => ({
        name: r.track_name,
        artistName: r.artist_name,
        playCount: r.listen_count,
      })),
    };
  },
  getArtists: async (
    username: string,
    _?: string,
  ): Promise<{ status: "OK"; data: TopMusicArtist[] } | { status: FailureStatus }> => {
    const response = await httpJson(
      `https://api.listenbrainz.org/1/stats/user/${username}/artists`,
    ).catch((error) => {
      if (error.response && error.response.status === 404) {
        return { iserror: true, status: "USERNOTFOUND" satisfies FailureStatus };
      } else {
        return { iserror: true, status: "UNKNOWNERROR" satisfies FailureStatus };
      }
    });
    if (response.iserror) return { status: response.status };

    return {
      status: "OK",
      data: (response.payload.artists as any[]).map((r) => ({
        artistName: r.artist_name,
        playCount: r.listen_count,
      })),
    };
  },
  getAlbums: async (
    username: string,
    _?: string,
  ): Promise<{ status: "OK"; data: TopMusicAlbum[] } | { status: FailureStatus }> => {
    const response = await httpJson(
      `https://api.listenbrainz.org/1/stats/user/${username}/artist-activity`,
    ).catch((error) => {
      if (error.response && error.response.status === 404) {
        return { iserror: true, status: "USERNOTFOUND" satisfies FailureStatus };
      } else {
        return { iserror: true, status: "UNKNOWNERROR" satisfies FailureStatus };
      }
    });
    if (response.iserror) return { status: response.status };

    const albums = (response.payload.artist_activity as any[])
      .flatMap((a) => (a.albums as any[]).map((al) => ({ artist_name: a.name, ...al })))
      .sort((a, b) => b.listen_count - a.listen_count);

    return {
      status: "OK",
      data: albums.map((r) => ({
        artistName: r.artist_name,
        albumName: r.name,
        playCount: r.listen_count,
      })),
    };
  },
};

const topMusicLastFM = {
  getTracks: async (
    username: string,
    token: string,
  ): Promise<{ status: "OK"; data: TopMusicTrack[] } | { status: FailureStatus }> => {
    const response = await httpJson(
      `https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${username}&api_key=${token}&format=json`,
    ).catch((error) => {
      console.log(error);
      if (error.response && error.response.status === 404) {
        return { iserror: true, status: "USERNOTFOUND" satisfies FailureStatus };
      } else {
        return { iserror: true, status: "UNKNOWNERROR" satisfies FailureStatus };
      }
    });
    if (response.iserror) return { status: response.status };

    return {
      status: "OK",
      data: (response.toptracks.track as any[]).map((t) => ({
        name: t.name,
        artistName: t.artist.name,
        playCount: t.playcount,
      })),
    };
  },
  getArtists: async (
    username: string,
    token: string,
  ): Promise<{ status: "OK"; data: TopMusicArtist[] } | { status: FailureStatus }> => {
    const response = await httpJson(
      `https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${username}&api_key=${token}&format=json`,
    ).catch((error) => {
      if (error.response && error.response.status === 404) {
        return { iserror: true, status: "USERNOTFOUND" satisfies FailureStatus };
      } else {
        return { iserror: true, status: "UNKNOWNERROR" satisfies FailureStatus };
      }
    });
    if (response.iserror) return { status: response.status };

    return {
      status: "OK",
      data: (response.topartists.artist as any[]).map((t) => ({
        artistName: t.name,
        playCount: t.playcount,
      })),
    };
  },
  getAlbums: async (
    username: string,
    token: string,
  ): Promise<{ status: "OK"; data: TopMusicAlbum[] } | { status: FailureStatus }> => {
    const response = await httpJson(
      `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${username}&api_key=${token}&format=json`,
    ).catch((error) => {
      if (error.response && error.response.status === 404) {
        return { iserror: true, status: "USERNOTFOUND" satisfies FailureStatus };
      } else {
        return { iserror: true, status: "UNKNOWNERROR" satisfies FailureStatus };
      }
    });
    if (response.iserror) return { status: response.status };

    return {
      status: "OK",
      data: (response.topalbums.album as any[]).map((t) => ({
        albumName: t.name,
        artistName: t.artist.name,
        playCount: t.playcount,
      })),
    };
  },
};

export default declareCommand({
  async run(interaction: ChatInputCommandInteraction, config) {
    await interaction.deferReply();
    const amount = interaction.options.getInteger("amount");
    const type = (interaction.options.getString("type") ?? "track") as "track" | "album" | "artist";
    const musicUser = await resolveMusicUser(interaction, config.prisma).catch(
      (e: Error) =>
        void interaction.followUp({
          content: e.message,
          flags: [MessageFlags.Ephemeral],
        }),
    );
    if (!musicUser) return;

    const topMusicList = musicUser.useLastFM ? topMusicLastFM : topMusicListenbrainz;
    let list: string;
    switch (type) {
      case "track": {
        const res = await topMusicList.getTracks(musicUser.username, config.lastFMApiKey);
        switch (res.status) {
          case "UNKNOWNERROR":
            await interaction.followUp("unexpected error; please try again shortly");
            return;
          case "USERNOTFOUND":
            await interaction.followUp(`user ${musicUser.username} not found`);
            return;
          case "OK": {
            list = res.data
              .toSpliced(clamp(0, amount ?? 3, 20))
              .map((a) => {
                return `${a.artistName} - **${a.name}** (${a.playCount} plays)`;
              })
              .join("\n");
            break;
          }
        }
        break;
      }
      case "artist": {
        const res = await topMusicList.getArtists(musicUser.username, config.lastFMApiKey);
        switch (res.status) {
          case "UNKNOWNERROR":
            await interaction.followUp("unexpected error; please try again shortly");
            return;
          case "USERNOTFOUND":
            await interaction.followUp(`user ${musicUser.username} not found`);
            return;
          case "OK": {
            list = res.data
              .toSpliced(clamp(0, amount ?? 3, 20))
              .map((a) => {
                return `${a.artistName} (${a.playCount} plays)`;
              })
              .join("\n");
            break;
          }
        }
        break;
      }
      case "album": {
        const res = await topMusicList.getAlbums(musicUser.username, config.lastFMApiKey);
        switch (res.status) {
          case "UNKNOWNERROR":
            await interaction.followUp("unexpected error; please try again shortly");
            return;
          case "USERNOTFOUND":
            await interaction.followUp(`user ${musicUser.username} not found`);
            return;
          case "OK": {
            list = res.data
              .toSpliced(clamp(0, amount ?? 3, 20))
              .map((a) => {
                return `${a.artistName} - **${a.albumName}** (${a.playCount} plays)`;
              })
              .join("\n");
            break;
          }
        }
        break;
      }
    }

    const components = [
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${musicUser.username} (${musicUser.useLastFM ? "lastFM" : "listenbrainz"}) top ${type}s`,
          ),
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
        )
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(list)),
    ];
    await interaction.followUp({
      components,
      flags: [MessageFlags.IsComponentsV2],
    });
  },
  dependsOn: z.object({
    lastFMApiKey: z.string(),
  }),
  slashCommand: new SlashCommandBuilder()
    .setName("top")
    .setDescription("get top music")
    .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
    .addStringOption((option) => {
      return option
        .setName("type")
        .setDescription("type of top listens")
        .addChoices(
          { name: "Tracks", value: "track" },
          { name: "Artists", value: "artist" },
          { name: "Albums", value: "album" },
        )
        .setRequired(false);
    })
    .addIntegerOption((option) => {
      return option.setName("amount").setDescription("number of items returned").setRequired(false);
    })
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
