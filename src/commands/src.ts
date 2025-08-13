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
import { z } from "zod";
import {NO_EXTRA_CONFIG} from "../config.ts";
import {rm} from "fs/promises"
import analyse from "linguist-js";
import {getTop3Languages} from "../util.ts";
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

        await interaction.followUp(`${resp[0].language} is the top language in this repo with ${resp[0].percentage}% code`);
        await rm(tmpobj.name, {recursive: true})
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