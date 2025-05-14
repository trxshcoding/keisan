import { ApplicationCommandType, type AutocompleteFocusedOption, AutocompleteInteraction, ChatInputCommandInteraction, ContextMenuCommandBuilder, ContextMenuCommandInteraction, Message, SharedSlashCommand, User } from "discord.js";
import { type Config } from "./config.ts";
import type {S3Client} from "@aws-sdk/client-s3";

export abstract class ICommand { }

export abstract class ContextCommand<T extends User | Message> extends ICommand {
    abstract targetType:
        T extends User ? ApplicationCommandType.User :
        T extends Message ? ApplicationCommandType.Message :
        never;
    abstract contextDefinition: ContextMenuCommandBuilder
    abstract run(interaction: ContextMenuCommandInteraction, target: T extends User ? User : T extends Message ? Message : never, config: Config): Promise<void>
}

export abstract class Command extends ICommand {
    abstract run(interaction: ChatInputCommandInteraction, config: Config, s3: S3Client): Promise<void>;
    autoComplete(interaction: AutocompleteInteraction, config: Config, option: AutocompleteFocusedOption, s3: S3Client): Promise<void> {
        throw new Error("Autocompletion called on command that does not have #autoComplete implemented.");
    }
    abstract slashCommand: SharedSlashCommand
}
