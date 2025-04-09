import { AutocompleteFocusedOption, AutocompleteInteraction, ChatInputCommandInteraction, ContextMenuCommandBuilder, ContextMenuCommandInteraction, SharedSlashCommand, Snowflake, User } from "discord.js";
import { Config } from "./config";

export abstract class ICommand { }

export abstract class ContextCommand extends ICommand {
    abstract contextDefinition: ContextMenuCommandBuilder
    abstract run(interaction: ContextMenuCommandInteraction, target: Snowflake): Promise<void>
}

export abstract class Command extends ICommand {
    abstract run(interaction: ChatInputCommandInteraction, config: Config): Promise<void>;
    autoComplete(interaction: AutocompleteInteraction, config: Config, option: AutocompleteFocusedOption): Promise<void> {
        throw new Error("Autocompletion called on command that does not have #autoComplete implemented.");
    }
    abstract slashCommand: SharedSlashCommand
}
