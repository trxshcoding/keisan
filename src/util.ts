import { ModalBuilder, SlashCommandBuilder } from "discord.js";

export function chunkArray<T>(
    array: T[],
    chunkSize: number
): T[][] {
    const b: T[][] = []
    array.forEach(element =>
        b && b[b.length - 1] && b[b.length - 1].length < chunkSize
            ? b[b.length - 1].push(element)
            : b.push([element])
    )
    return b
}


export function trimWhitespace(input: string): string;
export function trimWhitespace(input: string[]): string[];

export function trimWhitespace(input: string | string[]) {
    return Array.isArray(input) ? input.map(s => s.trim()) : input.trim();
}

export class AmyodalBuilder extends ModalBuilder {
    private command: SlashCommandBuilder
    constructor(command: SlashCommandBuilder) {
        super()
        this.command = command
    }
    setCustomId(customId: string): this {
        this.data.custom_id = `${this.command.name}|${customId}`
        return this
    }
}