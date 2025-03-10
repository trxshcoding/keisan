import { AutocompleteFocusedOption, AutocompleteInteraction, ChatInputCommandInteraction, SharedSlashCommand } from "discord.js";
import { Config } from "./config";

export abstract class Command {
    abstract run(interaction: ChatInputCommandInteraction, config: Config): Promise<void>;
    autoComplete(interaction: AutocompleteInteraction, config: Config, option: AutocompleteFocusedOption) : Promise<void> {
        throw new Error("Autocompletion called on command that does not have #autoComplete implemented.");
    }
    abstract slashCommand: SharedSlashCommand
}
