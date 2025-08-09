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
import { rawconfig, type Config } from "./config.ts";
import type { z } from "zod";


const commandSymbol: unique symbol = Symbol("CommandSymbol")
type Brand = {
    [commandSymbol]: true,
}

export type ICommand<ExtraConfig> = {
    dependsOn: z.Schema<ExtraConfig>,
} & Brand

type OmitPrime<T, K extends keyof any> = T extends {} ? Omit<T, K> : T
export function declareCommand<ExtraConfig, T extends User | Message>(command: OmitPrime<ContextCommand<T, ExtraConfig>, keyof Brand>): ContextCommand<T, ExtraConfig>
export function declareCommand<ExtraConfig>(command: OmitPrime<Command<ExtraConfig>, keyof Brand>): Command<ExtraConfig>
export function declareCommand<ExtraConfig>(command: OmitPrime<AnyCommand<ExtraConfig>, keyof Brand>): AnyCommand<ExtraConfig> {
    const t = Object.assign(command, { [commandSymbol]: true } as const) satisfies Omit<AnyCommand<ExtraConfig>, keyof Brand> & Brand
    return t as any
}

export function undeclareCommand(obj: unknown): AnyCommand<unknown> {
    if (typeof obj !== 'object' || !obj || !Object.hasOwn(obj, commandSymbol))
        throw new Error(`${obj} is not a command`)
    // We only hand out [commandSymbol] via declareCommand, so this should be mostly valid
    return obj as AnyCommand<unknown>
}


export type ContextCommand<T extends User | Message, ExtraConfig> = ICommand<ExtraConfig> & {
    targetType: T extends User ? ApplicationCommandType.User : T extends Message ? ApplicationCommandType.Message : never;
    contextDefinition: ContextMenuCommandBuilder
    run(interaction: ContextMenuCommandInteraction, target: T extends User ? User : T extends Message ? Message : never, config: Config): Promise<void>
    commandName: string;
    modal?: (interaction: ModalSubmitInteraction, config: Config & ExtraConfig) => Promise<void>
}

export type Command<ExtraConfig> = ICommand<ExtraConfig> & {
    run(interaction: ChatInputCommandInteraction, config: Config & ExtraConfig): Promise<void>
    autoComplete?: (interaction: AutocompleteInteraction, config: Config & ExtraConfig, option: AutocompleteFocusedOption) => Promise<void>
    button?: (interaction: ButtonInteraction, config: Config & ExtraConfig) => Promise<void>
    modal?: (interaction: ModalSubmitInteraction, config: Config & ExtraConfig) => Promise<void>
    slashCommand: SharedSlashCommand
}

export type AnyCommand<ExtraConfig> = Command<ExtraConfig> | ContextCommand<User | Message, ExtraConfig>

export type PackagedCommand<T extends AnyCommand<ExtraConfig>, ExtraConfig> = T & { storedConfig: ExtraConfig }

export function tryPackageCommand<T extends AnyCommand<ExtraConfig>, ExtraConfig>(command: T): PackagedCommand<T, ExtraConfig> {
    const parsedExtraConfig = command.dependsOn.parse(rawconfig);
    return Object.assign(command, { storedConfig: parsedExtraConfig })
}
