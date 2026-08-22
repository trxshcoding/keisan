import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";
import { escapeMarkdown } from "../utils/general.ts";
import { songLinkLabel } from "./link-resolve.ts";

export function trackContainer(opts: {
  songName: string;
  artistName: string;
  albumName?: string;
  coverUrl?: string;
  link?: string;
}): ContainerBuilder {
  const container = new ContainerBuilder();
  const textDisplays = [
    new TextDisplayBuilder().setContent(`# ${escapeMarkdown(opts.songName)}`),
    new TextDisplayBuilder().setContent(
      `${escapeMarkdown(opts.artistName)}${opts.albumName ? ` · *${escapeMarkdown(opts.albumName)}*` : ""}`,
    ),
  ];

  if (opts.coverUrl) {
    container.addSectionComponents(
      new SectionBuilder()
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(opts.coverUrl))
        .addTextDisplayComponents(...textDisplays),
    );
  } else {
    container.addTextDisplayComponents(...textDisplays);
  }

  if (opts.link) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setURL(opts.link)
          .setLabel(songLinkLabel(opts.link)),
      ),
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# couldn't find a streaming link"),
    );
  }

  return container;
}
