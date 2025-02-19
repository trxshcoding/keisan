import {ChatInputCommandInteraction, SharedSlashCommand} from "discord.js";

export class Command {
    constructor(){}
    async run (interaction: ChatInputCommandInteraction, config): Promise<void>{};
    slashCommand: SharedSlashCommand
}