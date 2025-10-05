import { declareCommand } from "../command.ts";
import {
    ActionRowBuilder,
    ApplicationIntegrationType,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    InteractionContextType, MessageFlags, SlashCommandBooleanOption,
    SlashCommandBuilder, SlashCommandStringOption, SlashCommandSubcommandBuilder,
    SlashCommandUserOption,
    type InteractionResponse,
    type Message
} from "discord.js";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";

type Proposal = {
    from: string;
    to: string;
    interaction: InteractionResponse;
    at: number;
    timeout?: NodeJS.Timeout;
}
const proposals = [] as Proposal[]

export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        const command = interaction.options.getSubcommand(true)
        const marriage = await config.prisma.marriage.findFirst({
            where: {
                OR: [{ userOneId: interaction.user.id }, { userTwoId: interaction.user.id }]
            }
        })
        switch (command) {
            case "status": {
                if (marriage) {
                    const otherUserId = marriage.userOneId === interaction.user.id
                        ? marriage.userTwoId
                        : marriage.userOneId
                    const user = await interaction.client.users.fetch(otherUserId)
                    if (!user)
                        await interaction.reply(`you're married to <@${otherUserId}>`)
                    else
                        await interaction.reply(`you're married to **${user.displayName}** (${user.username})`)
                } else {
                    await interaction.reply("you aren't married to anyone (yet)")
                }
                break;
            }
            case "divorce": {
                if (!marriage) {
                    await interaction.reply({
                        content: "can't divorce the voices sadly",
                        flags: [MessageFlags.Ephemeral]
                    })
                    return
                }

                // ids are unique so it'll only be one and i want to use OR
                await config.prisma.marriage.deleteMany({
                    where: {
                        OR: [{ userOneId: interaction.user.id }, { userTwoId: interaction.user.id }]
                    }
                })
                const otherUserId = marriage.userOneId === interaction.user.id
                    ? marriage.userTwoId
                    : marriage.userOneId
                const user = await interaction.client.users.fetch(otherUserId)
                await interaction.reply(`you broke up with **${user.displayName}** 💔`)
                break;
            }
            case "propose": {
                if (marriage) {
                    await interaction.reply({
                        content: "how dare you cheat like that",
                        flags: [MessageFlags.Ephemeral]
                    })
                    return;
                }
                const user = interaction.options.getUser("user", true)
                if (!user || user.id === interaction.user.id || user.bot) {
                    await interaction.reply({
                        content: "nope",
                        flags: [MessageFlags.Ephemeral]
                    })
                    return;
                }
                const existingMarriage = await config.prisma.marriage.findFirst({
                    where: {
                        OR: [{ userOneId: user.id }, { userTwoId: user.id }]
                    }
                })
                if (existingMarriage) {
                    await interaction.reply({
                        content: "that person's already married!",
                        flags: [MessageFlags.Ephemeral]
                    })
                    return;
                }
                if (proposals.find(p => p.from === interaction.user.id)) {
                    await interaction.reply({
                        content: "calm down sweetie",
                        flags: [MessageFlags.Ephemeral]
                    })
                    return;
                }

                await interaction.reply({
                    content: `**${user.displayName}**, will you be **${interaction.user.displayName}**'s forever love?`,
                    components: [
                        new ActionRowBuilder()
                            .addComponents([
                                new ButtonBuilder()
                                    .setCustomId("yes")
                                    .setStyle(ButtonStyle.Success)
                                    .setLabel("Yes!"),
                                new ButtonBuilder()
                                    .setCustomId("no")
                                    .setStyle(ButtonStyle.Danger)
                                    .setLabel("no")
                            ])
                            .toJSON()
                    ]
                }).then(res => {
                    const item = {
                        from: interaction.user.id,
                        to: user.id,
                        interaction: res,
                        at: Date.now()
                    } as Proposal
                    const timeout = setTimeout(() => {
                        proposals.splice(proposals.indexOf(item), 1)
                        res.edit({
                            components: []
                        })
                        // @ts-expect-error "interaction" is the generic Interaction type even though this is clearly 
                        // from a message how are the types this bad
                        res.interaction.followUp("they didn't respond 💔")
                    }, 30_000)
                    item.timeout = timeout
                    proposals.push(item)
                })
                break;
            }
        }
    },
    dependsOn: NO_EXTRA_CONFIG,
    async button(interaction, config) {
        const proposal = proposals.find(p => p.interaction.id === interaction.message.interactionMetadata!.id)
        if (!proposal) return
        if (interaction.user.id !== proposal.to) {
            await interaction.deferUpdate()
            return
        }
        switch (interaction.customId) {
            case "yes": {
                const marriage = await config.prisma.marriage.findFirst({
                    where: {
                        OR: [{ userOneId: proposal.from }, { userTwoId: proposal.from }, { userOneId: proposal.to }, { userTwoId: proposal.to }]
                    }
                })
                if (marriage) return

                if (proposal.timeout) clearTimeout(proposal.timeout)
                proposals.splice(proposals.indexOf(proposal), 1)
                await config.prisma.marriage.create({
                    data: {
                        userOneId: proposal.from,
                        userTwoId: proposal.to
                    }
                })
                await interaction.reply("i declare you two wife and wife!")
                return;
            }
            case "no": {
                if (proposal.timeout) clearTimeout(proposal.timeout)
                proposals.splice(proposals.indexOf(proposal), 1)

                await interaction.reply("rejected 💔")
                return;
            }
        }
    },
    slashCommand: new SlashCommandBuilder()
        .setName("marriage")
        .setDescription("so romantic").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("status")
                .setDescription("get marriage status")
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("propose")
                .setDescription("will you be mine? 🥺")
                .addUserOption(
                    new SlashCommandUserOption()
                        .setName("user")
                        .setDescription("new wife (only wife)")
                        .setRequired(true)
                )
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("divorce")
                .setDescription("just like in real life")
        )
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]),
})
