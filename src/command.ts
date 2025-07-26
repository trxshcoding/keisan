import {
    ApplicationCommandType,
    type AutocompleteFocusedOption,
    AutocompleteInteraction,
    type ButtonInteraction,
    ChatInputCommandInteraction,
    ContextMenuCommandBuilder,
    ContextMenuCommandInteraction,
    Message, type ModalSubmitInteraction,
    SharedSlashCommand,
    User
} from "discord.js";
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
    abstract run(interaction: ChatInputCommandInteraction, config: Config): Promise<void>;
    autoComplete(interaction: AutocompleteInteraction, config: Config, option: AutocompleteFocusedOption): Promise<void> {
        throw new Error("Autocompletion called on command that does not have #autoComplete implemented.");
    }
    button(interaction: ButtonInteraction, config: Config): Promise<void> {
        throw new Error("button called on command that does not have #button implemented.");
    }
    modal(interaction: ModalSubmitInteraction, config: Config): Promise<void> {
        throw new Error("modal called on command that does not have #modal implemented.");
    }
    abstract slashCommand: SharedSlashCommand
}
