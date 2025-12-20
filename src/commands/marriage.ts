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
        
        switch (command) {
            case "status": {
                const user = await config.prisma.user.findUnique({
                    where: { id: interaction.user.id },
                    include: { partners: true }
                })

                if (!user || user.partners.length === 0) {
                    await interaction.reply("you aren't married to anyone (yet)")
                    return
                }

                const partnerNames = []
                for (const partner of user.partners) {
                    try {
                        const u = await interaction.client.users.fetch(partner.value)
                        partnerNames.push(`**${u.displayName}** (${u.username})`)
                    } catch {
                        partnerNames.push(`<@${partner.value}>`)
                    }
                }
                
                await interaction.reply(`you're married to ${partnerNames.join(", ")}`)
                break;
            }
            case "divorce": {
                const targetUser = interaction.options.getUser("user")
                const user = await config.prisma.user.findUnique({
                    where: { id: interaction.user.id },
                    include: { partners: true }
                })

                if (!user || user.partners.length === 0) {
                    await interaction.reply({
                        content: "can't divorce the voices sadly",
                        flags: [MessageFlags.Ephemeral]
                    })
                    return
                }

                let partnerIdToDivorce: string

                if (targetUser) {
                    if (!user.partners.some(p => p.value === targetUser.id)) {
                        await interaction.reply({
                            content: "you aren't married to them!",
                            flags: [MessageFlags.Ephemeral]
                        })
                        return
                    }
                    partnerIdToDivorce = targetUser.id
                } else {
                    if (user.partners.length > 1) {
                        await interaction.reply({
                            content: "you have multiple partners, please specify who to divorce",
                            flags: [MessageFlags.Ephemeral]
                        })
                        return
                    }
                    partnerIdToDivorce = user.partners[0].value
                }

                // ids are unique so it'll only be one and i want to use OR
                await config.prisma.partner.deleteMany({
                    where: {
                        OR: [
                            { userId: interaction.user.id, value: partnerIdToDivorce },
                            { userId: partnerIdToDivorce, value: interaction.user.id }
                        ]
                    }
                })
                const u = await interaction.client.users.fetch(partnerIdToDivorce)
                await interaction.reply(`you broke up with **${u.displayName}** 💔`)
                break;
            }
            case "propose": {
                const user = interaction.options.getUser("user", true)
                if (!user || user.id === interaction.user.id || user.bot) {
                    await interaction.reply({
                        content: "nope",
                        flags: [MessageFlags.Ephemeral]
                    })
                    return;
                }
                
                const existingPartner = await config.prisma.partner.findFirst({
                    where: {
                        userId: interaction.user.id,
                        value: user.id
                    }
                })
                if (existingPartner) {
                    await interaction.reply({
                        content: "you're already married to them!",
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
                const existing = await config.prisma.partner.findFirst({
                    where: { userId: proposal.from, value: proposal.to }
                })
                if (existing) return

                if (proposal.timeout) clearTimeout(proposal.timeout)
                proposals.splice(proposals.indexOf(proposal), 1)
                
                await config.prisma.user.upsert({ where: { id: proposal.from }, update: {}, create: { id: proposal.from } })
                await config.prisma.user.upsert({ where: { id: proposal.to }, update: {}, create: { id: proposal.to } })

                await config.prisma.partner.create({
                    data: {
                        userId: proposal.from,
                        value: proposal.to
                    }
                })
                await config.prisma.partner.create({
                    data: {
                        userId: proposal.to,
                        value: proposal.from
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
                        .setDescription("new wife")
                        .setRequired(true)
                )
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("divorce")
                .setDescription("just like in real life")
                .addUserOption(
                    new SlashCommandUserOption()
                        .setName("user")
                        .setDescription("who to divorce (required if you have multiple partners)")
                        .setRequired(false)
                )
        )
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]),
})
