import {
    ActionRowBuilder,
    ApplicationIntegrationType, ButtonBuilder, ButtonStyle,
    ChatInputCommandInteraction, EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import * as tmp from 'tmp'
import * as git from '@napi-rs/simple-git'
import {declareCommand} from "../command.ts";
import {z} from "zod";
import {NO_EXTRA_CONFIG} from "../config.ts";
import {rm} from "fs/promises"
import analyse from "linguist-js";
import {bufferToEmoji, getTop3Languages, imageBullshittery} from "../util.ts";
import {Commit} from "@napi-rs/simple-git";

export default declareCommand({
    async run(interaction, config) {
        await interaction.deferReply();
        let reponame = interaction.options.getString("repo", true)
        try {
            new URL(reponame);
        } catch {
            reponame = new URL(reponame, "https://github.com/").toString();
        }
        const tmpobj = tmp.dirSync();
        const repo = git.Repository.clone(reponame, tmpobj.name)
        const resp = getTop3Languages(await analyse(tmpobj.name))

        const commits = [...repo.revWalk().setSorting(git.Sort.Time).push(repo.head().target()!)].map(
            c => repo.findCommit(c)!
        )
        const topContributors = Object.entries(commits.reduce((obj, c) => {
            const name = c.author().name()!
            const email = c.author().email()!

            if (obj[email]) obj[email].count++
            else obj[email] = {name, count: 1}
            return obj
        }, {} as Record<string, { name: string, count: number }>))
            .sort(([, a], [, b]) => b.count - a.count)
            .slice(0, 3)
        const emojiPromises = topContributors.map(async ([, {name}]) => await bufferToEmoji(imageBullshittery(name), interaction.client, name))
        const emojis = await Promise.all(emojiPromises)
        const btopContributors = topContributors
            .map(([, {name, count}], i) => `${emojis[i]} ${name} with ${count} commits`)
            .join(", ")

        await interaction.followUp(`## <${reponame}>
${commits.length} commits
Top contributors: ${btopContributors}
Last commit was <t:${commits[0].time().getTime() / 1000}>
First Commit was <t:${commits.at(-1)!.time().getTime() / 1000}>
${resp[0].language} is the top language in this repo with ${resp[0].percentage}% code`);
        await rm(tmpobj.name, {recursive: true})
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