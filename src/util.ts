import {ModalBuilder, SlashCommandBuilder} from "discord.js";
import type {Results} from "linguist-js/dist/types";
import {number} from "zod";

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

export class ContextyalBuilder extends ModalBuilder {
    private command: string

    constructor(command: string) {
        super()
        this.command = command
    }

    setCustomId(customId: string): this {
        this.data.custom_id = `CC:${this.command}|${customId}`
        return this
    }
}

export function getTop3Languages(result: Results) {
    let maxBytes = 0;
    Object.keys(result.languages.results).forEach(language => {
        maxBytes += result.languages.results[language].bytes
    })
    const newArray = Object.entries(result.languages.results).map(([k, v]) => ({
        ...v,
        language: k,
        percentage: Number((v.bytes / maxBytes * 100).toFixed(2)),
    }))
    newArray.sort((a, b) => b.bytes - a.bytes)
    newArray.length = 3;
    return newArray
}

export function escapeMarkdown(content: string) {
    return content.replace(/([#*_~`|])/g, "\\$1")
}