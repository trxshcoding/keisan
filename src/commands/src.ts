import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import * as fs from "fs";
import * as tmp from "tmp";
import * as git from "isomorphic-git";
import * as http from "isomorphic-git/http/node";
import { declareCommand } from "../command.ts";
import { NO_EXTRA_CONFIG } from "../config.ts";
import { rm } from "fs/promises";
import analyse from "linguist-js";
import { bufferToEmoji, getGithubAvatar, getTop3Languages, imageBullshittery } from "../util.ts";

export default declareCommand({
  async run(interaction, _config) {
    const COMMIT_LIMIT = 25000;
    await interaction.deferReply();
    let repoName = interaction.options.getString("repo", true);
    try {
      new URL(repoName);
    } catch {
      repoName = new URL(repoName, "https://github.com/").toString();
    }
    const tmpobj = tmp.dirSync();
    await git.clone({
      fs,
      http,
      dir: tmpobj.name,
      url: repoName,
      depth: COMMIT_LIMIT,
    });
    const commits = await git.log({
      fs,
      dir: tmpobj.name,
    });
    if (commits.length === COMMIT_LIMIT) {
      await interaction.followUp("repository is too big. exiting...");
    }
    const resp = getTop3Languages(await analyse(tmpobj.name));
    const topContributors = Object.entries(
      commits.reduce(
        (obj, c) => {
          const name = c.commit.author.name!;
          const email = c.commit.author.email!;

          if (obj[email]) obj[email].count++;
          else obj[email] = { name, count: 1 };
          return obj;
        },
        {} as Record<string, { name: string; count: number }>,
      ),
    )
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 3);
    const emojiPromises = topContributors.map(async ([email, { name }]) => {
      let avatar: Buffer;
      if (repoName.startsWith("https://github.com")) avatar = await getGithubAvatar(name, email);
      else avatar = imageBullshittery(name);
      return await bufferToEmoji(avatar, interaction.client);
    });
    const emojis = await Promise.all(emojiPromises);
    const topContributorList = topContributors
      .map(
        ([, { name, count }], i) => `${emojis[i]?.toString() ?? ""} ${name} with ${count} commits`,
      )
      .join(", ");
    let response = `## <${repoName}>
${commits.length} commits
Top contributors: ${topContributorList}
Last commit was <t:${commits[0].commit.author.timestamp}>
First commit was <t:${commits.at(-1)!.commit.author.timestamp}>
`;
    for (const i of resp) {
      if (i.percentage < 1.0) continue;
      const amount = Math.round((i.percentage / 10) * 2) / 2;
      const fullBlocks = Math.floor(amount);
      const halfBlock = amount % 1 !== 0;
      let bar = "■".repeat(fullBlocks);
      if (halfBlock) {
        bar += "□";
      }
      response += `${i.language}: ${bar}\n`;
    }
    await interaction.followUp(response);
    await rm(tmpobj.name, { recursive: true });
    await Promise.all(emojis.map((a) => a.delete()));
  },
  dependsOn: NO_EXTRA_CONFIG,
  slashCommand: new SlashCommandBuilder()
    .setName("src")
    .setDescription("get src of shit")
    .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
    .addStringOption((option) => {
      return option.setName("repo").setDescription("name").setRequired(true);
    })
    .setContexts([
      InteractionContextType.BotDM,
      InteractionContextType.Guild,
      InteractionContextType.PrivateChannel,
    ]),
});
