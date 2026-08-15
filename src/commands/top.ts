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

type Status = "OK" | "USERNOTFOUND" | "UNKNOWNERROR";

async function getTopMusicListenbrainz(username: string): Promise<{ status: Status; data?: any }> {
  let response: any;
  try {
    response = await httpJson(`https://api.listenbrainz.org/1/stats/user/${username}/recordings`);
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return { status: "USERNOTFOUND" };
    } else {
      return { status: "UNKNOWNERROR" };
    }
  }
  return { status: "OK", data: response.payload.recordings };
}

async function getTopMusicLastFm(
  username: string,
  token: string,
): Promise<{ status: Status; data?: any }> {
  let response: any;
  try {
    response = await httpJson(
      `https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${username}&api_key=${token}&format=json `,
    );
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return { status: "USERNOTFOUND" };
    } else {
      return { status: "UNKNOWNERROR" };
    }
  }
  return { status: "OK", data: response.toptracks.track };
}

export default declareCommand({
  async run(interaction: ChatInputCommandInteraction, config) {
    await interaction.deferReply();
    const amount = await interaction.options.getInteger("amount");
    const musicUser = await resolveMusicUser(interaction, config.prisma).catch(
      (e: Error) =>
        void interaction.followUp({
          content: e.message,
          flags: [MessageFlags.Ephemeral],
        }),
    );
    if (!musicUser) return;

    if (musicUser.useLastFM) {
      const topMusicList = await getTopMusicLastFm(musicUser.username, config.lastFMApiKey);
      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${musicUser.username} (${musicUser.useLastFM ? "lastFM" : "listenbrainz"}) top songs`,
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              (topMusicList.data as Array<any>)
                .toSpliced(clamp(0, amount ?? 3, 20))
                .map((a) => {
                  return `${a.artist.name} - ${a.name} (${a.playcount} times listened)`;
                })
                .join("\n"),
            ),
          ),
      ];
      await interaction.followUp({
        components,
        flags: [MessageFlags.IsComponentsV2],
      });
      return;
    }

    const topMusicList = await getTopMusicListenbrainz(musicUser.username);

    const components = [
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${musicUser.username} (${musicUser.useLastFM ? "lastFM" : "listenbrainz"}) top songs`,
          ),
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            (topMusicList.data as Array<any>)
              .toSpliced(clamp(0, amount ?? 3, 20))
              .map((a) => {
                return `${a.artist_name} - ${a.track_name} (${a.listen_count} times listened)`;
              })
              .join("\n"),
          ),
        ),
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
    .addIntegerOption((option) => {
      return option.setName("amount").setDescription("number of songs returned").setRequired(false);
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
