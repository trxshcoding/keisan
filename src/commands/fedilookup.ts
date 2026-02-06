//thank you to https://git.lunya.pet/Lunya/Ai for the inspiration
import {
  ActionRowBuilder,
  type ApplicationEmoji,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  InteractionContextType,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  type MessageActionRowComponentBuilder,
  MessageFlags,
  SectionBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";
import { chunkArray, createResizedEmoji, trimWhitespace } from "../util.ts";
import { declareCommand } from "../command.ts";
import { z } from "zod";
import { httpJson } from "../lib/http.ts";

const fediUserRegex = /@[^.@\s]+@(?:[^.@\s]+\.)+[^.@\s]+/;
const emojiRatelimits = {
  chunks: 3,
  chunkSize: 5,
} as const;

const fediNoteResponse = z.object({
  user: z.object({
    name: z.string().nullable(),
    username: z.string(),
    host: z.string().nullable(),
    avatarUrl: z.string().url(),
    description: z.string().nullable(),
    emojis: z.record(z.string(), z.string().url()),
  }),
  text: z.string().nullable(),
  cw: z.string().nullable(),
  emojis: z.record(z.string(), z.string().url()),
  files: z.array(
    z.object({
      type: z.string(),
      url: z.string().url(),
      isSensitive: z.boolean(),
      comment: z.string().nullable(),
    }),
  ),
  uri: z.string().url().nullable(),
  renoteCount: z.number(),
  repliesCount: z.number(),
  reactionCount: z.number(),
  reactions: z.record(z.string(), z.number()),
  reactionEmojis: z.record(z.string(), z.string().url()),
});
const fediUserResponse = z.object({
  name: z.string().nullable(),
  username: z.string(),
  host: z.string().nullable(),
  avatarUrl: z.string().url(),
  description: z.string().nullable(),
  emojis: z.record(z.string(), z.string().url()),
  url: z.string().nullable(),
});

export default declareCommand({
  async run(interaction: ChatInputCommandInteraction, config) {
    await interaction.deferReply();
    const fedistring = interaction.options.getString("string")!;
    let shit = fedistring;
    if (fediUserRegex.test(fedistring) && !fedistring.startsWith("http")) {
      const [user, host] = trimWhitespace(fedistring.split("@").splice(1));
      //SURELY every instance has tls right?
      shit = `https://${host}/@${user}`;
    }

    const sharkeyBase = new URL(
      config.sharkeyInstance.startsWith("http")
        ? config.sharkeyInstance
        : `https://${config.sharkeyInstance}`,
    );
    const apiUrl = new URL("/api/ap/show", sharkeyBase);

    const { object, type } = await httpJson<{ object: unknown; type: string }>(apiUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.sharkeyToken}`,
      },
      body: {
        uri: shit,
      },
    });

    if (type === "Note") {
      let resp;
      try {
        resp = fediNoteResponse.parse(object);
      } catch {
        await interaction.followUp(
          `nyaaaa 3:\n\`${(object as any)?.error?.code || "cant parse response"}\``,
        );
        console.log(resp);
        return;
      }

      const emojiItems = Object.entries(resp.emojis)
        .concat(
          resp.user.name
            ? Object.entries(resp.user.emojis).filter(
                (emoji) => resp.user.name?.includes(`:${emoji[0]}:`) && !resp.emojis[emoji[0]],
              )
            : [],
        )
        .concat(Object.entries(resp.reactionEmojis)) as [string, string][];
      const emojis = {} as Record<string, ApplicationEmoji>;
      const emojiBatches = chunkArray(emojiItems, emojiRatelimits.chunkSize);
      if (emojiBatches.length <= emojiRatelimits.chunks) {
        for (const chunk of emojiBatches) {
          const promise = await Promise.all(
            chunk.map(async ([name, link]) => ({
              name,
              emoji: await createResizedEmoji(interaction, link),
            })),
          );
          promise.forEach((e) => {
            if (!e.emoji) return;
            emojis[e.name] = e.emoji;
          });
        }
      }

      let mainComponent;
      const components: (
        | TextDisplayBuilder
        | ContainerBuilder
        | ActionRowBuilder<MessageActionRowComponentBuilder>
      )[] = [
        (mainComponent = new ContainerBuilder().setSpoiler(resp.cw !== null).addSectionComponents(
          new SectionBuilder()
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(resp.user.avatarUrl))
            .addTextDisplayComponents(
              /*
                                if host is null, its the same host as the api
                                why is it written like this? idfk
                                */
              new TextDisplayBuilder().setContent(
                `## ${(resp.user.name || resp.user.username).replace(/:([\w-]+):/g, (_, name) => {
                  if (!emojis[name]) return _;
                  else return emojis[name].toString();
                })} (@${resp.user.username}@${resp.user.host === null ? config.sharkeyInstance : resp.user.host})`,
              ),
            ),
        )),
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("view post")
            /*
                            im done with this garbage. `resp.uri` is NOT EVEN THERE when THE FUCKING instance IS THE SAME
                            as the FUCKIOGN G WERDSKLP;GVFHEWRL'VGFHNCEW'RLFPVBHNGETFVBN

                            */
            .setURL(!resp.uri ? new URL(`/notes/${fedistring}`, sharkeyBase).toString() : resp.uri),
        ),
      ];

      if (resp.text) {
        mainComponent.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            resp.text.replace(/:([\w-]+):/g, (_, name) => {
              if (!emojis[name]) return _;
              else return emojis[name].toString();
            }),
          ),
        );
      }

      if (resp.reactionCount > 0 || resp.renoteCount > 0) {
        mainComponent.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`-# ${resp.renoteCount} renotes
-# ${Object.entries(resp.reactions)
            .map(
              ([name, count]) => `${count} ${emojis[name.replace(/:/g, "")]?.toString() || name}`,
            )
            .join("  ")}`),
        );
      }

      if (resp.files.length > 0) {
        const images = new MediaGalleryBuilder();
        for (const file of resp.files) {
          if (!file.type.startsWith("image/")) {
            continue;
          }
          let img;
          images.addItems(
            (img = new MediaGalleryItemBuilder().setURL(file.url).setSpoiler(file.isSensitive)),
          );
          if (file.comment) img.setDescription(file.comment);
        }
        mainComponent.addMediaGalleryComponents(images);
      }
      if (resp.cw !== null) {
        components.unshift(new TextDisplayBuilder().setContent("cw: " + resp.cw));
      }
      await interaction.followUp({
        components: components,
        flags: [MessageFlags.IsComponentsV2],
      });
      Object.values(emojis).forEach((emoji) => emoji.delete());
      return;
    } else if (type === "User") {
      let resp;
      try {
        resp = fediUserResponse.parse(object);
      } catch {
        await interaction.followUp(
          `nyaaaa 3:\n\`${(object as any)?.error?.code || "cant parse response"}\``,
        );
        console.log(resp);
        return;
      }

      const emojiItems = Object.entries(resp.emojis).filter(
        (emoji) =>
          resp.name?.includes(`:${emoji[0]}:`) || resp.description?.includes(`:${emoji[0]}:`),
      );
      const emojis = {} as Record<string, ApplicationEmoji>;
      const emojiBatches = chunkArray(emojiItems, emojiRatelimits.chunkSize);
      if (emojiBatches.length <= emojiRatelimits.chunks) {
        for (const chunk of emojiBatches) {
          const promise = await Promise.all(
            chunk.map(async ([name, link]) => ({
              name,
              emoji: await createResizedEmoji(interaction, link),
            })),
          );
          promise.forEach((e) => {
            if (!e.emoji) return;
            emojis[e.name] = e.emoji;
          });
        }
      }

      const components = [
        new ContainerBuilder()
          .addSectionComponents(
            new SectionBuilder()
              .setThumbnailAccessory(new ThumbnailBuilder().setURL(resp.avatarUrl))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `## ${(resp.name || resp.username).replace(/:([\w-]+):/g, (_, name) => {
                    if (!emojis[name]) return _;
                    else return emojis[name].toString();
                  })}`,
                ),
                //same as above. host is null when its the same as the api
                new TextDisplayBuilder().setContent(
                  `@${resp.username}@${resp.host === null ? config.sharkeyInstance : resp.host}`,
                ),
              ),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              (resp.description || "-# absolutely nothing...").replace(/:([\w-]+):/g, (_, name) => {
                if (!emojis[name]) return _;
                else return emojis[name].toString();
              }),
            ),
          ),
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("go to profile")
            /*
                            the fucking `resp.url` is null when the host is the same as the api. who designed this???????
                            thankfully since we're working with a sharkey api, we're ssure this is how the link is
                            structured, so we can just make it the fuck up
                            */
            .setURL(
              resp.url === null ? `https://${config.sharkeyInstance}/@${resp.username}` : resp.url,
            ),
        ),
      ];
      await interaction.followUp({
        components,
        flags: [MessageFlags.IsComponentsV2],
      });
      Object.values(emojis).forEach((emoji) => emoji.delete());
    }
  },
  dependsOn: z.object({
    sharkeyInstance: z.string(),
    sharkeyToken: z.string(),
  }),
  slashCommand: new SlashCommandBuilder()
    .setName("fedilookup")
    .setDescription("look up shit from fedi")
    .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
    .addStringOption((option) => {
      return option.setName("string").setDescription("either note id or user").setRequired(true);
    })
    .setContexts([
      InteractionContextType.BotDM,
      InteractionContextType.Guild,
      InteractionContextType.PrivateChannel,
    ]),
});
