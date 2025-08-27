import {
    ActionRowBuilder,
    ApplicationIntegrationType, ButtonBuilder, ButtonStyle,
    ChatInputCommandInteraction, EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import * as tmp from 'tmp'
import * as git from '@napi-rs/simple-git'
import { declareCommand } from "../command.ts";
import { NO_EXTRA_CONFIG } from "../config.ts";
import { rm } from "fs/promises"
import analyse from "linguist-js";
import { bufferToEmoji, getGithubAvatar, getTop3Languages, imageBullshittery } from "../util.ts";

export default declareCommand({
    async run(interaction, config) {
        const COMMIT_LIMIT = 25000;
        await interaction.deferReply();
        let repoName = interaction.options.getString("repo", true)
        try {
            new URL(repoName);
        } catch {
            repoName = new URL(repoName, "https://github.com/").toString();
        }
        const tmpobj = tmp.dirSync();
        const repo = git.Repository.clone(repoName, tmpobj.name)
        const resp = getTop3Languages(await analyse(tmpobj.name))

        const revwalk = repo.revWalk();
        revwalk.setSorting(git.Sort.Time);
        revwalk.push(repo.head().target()!);

        const commits = [];
        let count = 0;

        for (const oid of revwalk) {
            count++;

            if (count > COMMIT_LIMIT) {
                await interaction.followUp("this repository is too big.")
                await rm(tmpobj.name, { recursive: true })
                return
            }

            commits.push(repo.findCommit(oid)!);
        }

        const topContributors = Object.entries(commits.reduce((obj, c) => {
            const name = c.author().name()!
            const email = c.author().email()!

            if (obj[email]) obj[email].count++
            else obj[email] = { name, count: 1 }
            return obj
        }, {} as Record<string, { name: string, count: number }>))
            .sort(([, a], [, b]) => b.count - a.count)
            .slice(0, 3)
        const emojiPromises = topContributors.map(async ([email, { name }]) => {
            let avatar: Buffer
            if (repoName.startsWith("https://github.com"))
                avatar = await getGithubAvatar(name, email)
            else avatar = imageBullshittery(name)
            return await bufferToEmoji(avatar, interaction.client)
        })
        const emojis = await Promise.all(emojiPromises)
        const topContributorList = topContributors
            .map(([, { name, count }], i) => `${emojis[i]} ${name} with ${count} commits`)
            .join(", ")
        let response = `## <${repoName}>
${commits.length} commits
Top contributors: ${topContributorList}
Last commit was <t:${commits[0].time().getTime() / 1000}>
First commit was <t:${commits.at(-1)!.time().getTime() / 1000}>`

        if (resp[0]){
            response += `\n${resp[0].language} is the top language in this repo with ${resp[0].percentage}% code`
        }
        await interaction.followUp(response);
        await rm(tmpobj.name, { recursive: true })
        emojis.forEach(a => {
            a.delete();
        })
    },
    dependsOn: NO_EXTRA_CONFIG,
    slashCommand: new SlashCommandBuilder()
        .setName("src")
        .setDescription("get src of shit").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ]).addStringOption(option => {
            return option.setName("repo").setDescription("name").setRequired(true);
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ])
})