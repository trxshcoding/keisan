import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";
import { escapeMarkdown } from "../utils/general.ts";
import {
  linkProvider,
  providerEmojis,
  providerSearchEmojis,
  songLinkLabel,
  userSearchableProviders,
  type UserSearchableProviders,
} from "./link-resolve.ts";

export function MusicLinkButton(link: string, withLabel = true) {
  const provider = linkProvider(link);
  let button = new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(link);
  if (provider && providerEmojis[provider]) button = button.setEmoji(providerEmojis[provider]);

  if (withLabel) button = button.setLabel(songLinkLabel(link));
  return button;
}

export function MusicSearchButton(
  query: string,
  provider: UserSearchableProviders,
  withLabel = true,
) {
  let button = new ButtonBuilder().setStyle(ButtonStyle.Link);
  if (provider && providerSearchEmojis[provider])
    button = button.setEmoji(providerSearchEmojis[provider]);
  switch (provider) {
    case "spotify":
      button = button.setURL(`https://open.spotify.com/search/${encodeURIComponent(query)}`);
      if (withLabel) button = button.setLabel("Spotify");
      break;
    case "youtubeMusic":
      button = button.setURL(`https://music.youtube.com/search?q=${encodeURIComponent(query)}`);
      if (withLabel) button = button.setLabel("YouTube Music");
      break;
    case "appleMusic":
      button = button.setURL(`https://music.apple.com/us/search?term=${encodeURIComponent(query)}`);
      if (withLabel) button = button.setLabel("Apple Music");
      break;
  }

  return button;
}

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
      new ActionRowBuilder<ButtonBuilder>().addComponents(MusicLinkButton(opts.link)),
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# couldn't find a streaming link"),
    );
  }

  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("also find this track on:"),
  );
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      userSearchableProviders
        .filter((p) => (opts.link ? p !== linkProvider(opts.link) : true))
        .map((p) => MusicSearchButton(`${opts.artistName} ${opts.songName}`, p)),
    ),
  );

  return container;
}
