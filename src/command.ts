import {ChatInputCommandInteraction, SharedSlashCommand} from "discord.js";
import { Config } from "./config";

export abstract class Command {
    abstract run(interaction: ChatInputCommandInteraction, config: Config): Promise<void>;
    abstract slashCommand: SharedSlashCommand
}
