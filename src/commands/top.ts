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
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { httpJson } from "../lib/http.ts";
import { clamp } from "../utils/general.ts";
import { z } from "zod";
import { resolveMusicUser } from "../music/user.ts";

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

const topMusicTypes = ["track", "artist", "album"] as const;
const artistCache = {} as { [id: string]: string[] };

function fuzzySearch(query: string, suggestions: string[]): string[] {
  const lower = query.toLowerCase();
  const results: string[] = [];
  const seen = new Set<string>();

  const add = (name: string) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push(name);
  };

  const exact = suggestions.find((s) => s.toLowerCase() === lower);
  if (exact) add(exact);
  else add(query);

  for (const s of suggestions) if (s.toLowerCase().startsWith(lower)) add(s);

  for (const s of suggestions)
    if (
      s
        .toLowerCase()
        .split(/\s+/)
        .some((word) => word.startsWith(lower))
    )
      add(s);

  for (const s of suggestions) if (s.toLowerCase().includes(lower)) add(s);

  return results.slice(0, 25);
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
      `https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${username}&api_key=${token}&limit=1000&format=json`,
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
      `https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${username}&api_key=${token}&limit=1000&format=json`,
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
      `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${username}&api_key=${token}&limit=1000&format=json`,
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

const slashCommand = new SlashCommandBuilder()
  .setName("top")
  .setDescription("get top music")
  .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
  .setContexts([
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel,
  ]);
for (const type of topMusicTypes) {
  let baseSubcommand = new SlashCommandSubcommandBuilder()
    .setName(type + "s")
    .setDescription(`get top ${type}s for a user`);
  if (["track", "album"].includes(type))
    baseSubcommand = baseSubcommand.addStringOption((option) => {
      return option
        .setName("artist")
        .setDescription("filter for a specific artist")
        .setAutocomplete(true)
        .setRequired(false);
    });
  slashCommand.addSubcommand(
    baseSubcommand
      .addIntegerOption((option) => {
        return option
          .setName("amount")
          .setDescription("number of items returned")
          .setRequired(false);
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
      }),
  );
}

export default declareCommand({
  async run(interaction: ChatInputCommandInteraction, config) {
    await interaction.deferReply();
    const rawAmount = interaction.options.getInteger("amount");
    const amount = clamp(0, rawAmount ?? 3, 20);
    const type = interaction.options
      .getSubcommand(true)
      .replace(/s$/, "") as (typeof topMusicTypes)[number];
    const artist = interaction.options.getString("artist", false);
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
              .filter((t) =>
                artist ? t.artistName.toLocaleLowerCase() === artist.toLowerCase() : true,
              )
              .toSpliced(amount)
              .map((t) => {
                return `${artist ? "" : `${t.artistName} - `}**${t.name}** (${t.playCount} plays)`;
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
              .toSpliced(amount)
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
              .filter((al) =>
                artist ? al.artistName.toLocaleLowerCase() === artist.toLowerCase() : true,
              )
              .toSpliced(amount)
              .map((al) => {
                return `${artist ? "" : `${al.artistName} - `}**${al.albumName}** (${al.playCount} plays)`;
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
            `${musicUser.username} (${musicUser.useLastFM ? "last.fm" : "listenbrainz"})'s top ${type}s ${artist ? `by ${artist}` : ""}`,
          ),
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
        )
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(list || "nothin' here")),
    ];
    await interaction.followUp({
      components,
      flags: [MessageFlags.IsComponentsV2],
    });
  },
  autoComplete: async (interaction, config, option) => {
    const focusedValue = option.value.toLowerCase();
    const query = focusedValue.trim().slice(0, 100);
    if (!query) return void interaction.respond([]);
    if (option.name !== "artist") return void interaction.respond([{ name: query, value: query }]);
    let artistSuggestions = artistCache[interaction.user.id];

    if (!artistSuggestions) {
      const user = await config.prisma.user.findFirst({
        where: { id: interaction.user.id },
      });
      if (!user || !user.musicUsername)
        return void interaction.respond([{ name: query, value: query }]);

      const topArtists = await (
        user.musicUsesListenbrainz ? topMusicListenbrainz : topMusicLastFM
      ).getArtists(user.musicUsername, config.lastFMApiKey);
      if (topArtists.status !== "OK")
        return void interaction.respond([{ name: query, value: query }]);

      artistCache[interaction.user.id] = topArtists.data.map((a) => a.artistName);
      artistSuggestions = artistCache[interaction.user.id];
      setTimeout(() => delete artistCache[interaction.user.id], 3600_000);
    }

    const matches = fuzzySearch(query, artistSuggestions);
    if (matches.length === 0) return void interaction.respond([{ name: query, value: query }]);
    return void interaction.respond(matches.map((name) => ({ name, value: name })));
  },
  dependsOn: z.object({
    lastFMApiKey: z.string(),
  }),
  slashCommand,
});
