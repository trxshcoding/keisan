import {
    ApplicationCommandType,
    ContextMenuCommandBuilder,
    ContextMenuCommandInteraction, escapeCodeBlock,
    Message,
    type UserResolvable
} from "discord.js";
import { parse as acornParse } from 'acorn'
import { type ModuleDeclaration, type Statement } from "acorn";
import { generate } from "astring";
import { inspect } from "node:util";
import { config, NO_EXTRA_CONFIG } from "../config.ts";
import { declareCommand } from "../command.ts";


function transformLastInBlock<T extends Statement | ModuleDeclaration>(
    array: Array<T | Statement>) {
    if (array) {
        array[array.length - 1] = transformStatement<T | Statement>(array[array.length - 1])
    }
}
function transformStatement<T extends Statement | ModuleDeclaration>(
    ast: T): T | Statement {
    switch (ast.type) {
        case 'ExpressionStatement':
            return {
                type: 'ExpressionStatement',
                start: 0,
                end: 0,
                expression: {
                    type: 'AssignmentExpression',
                    operator: '=',
                    start: 0,
                    end: 0,
                    left: {
                        start: 0,
                        end: 0,
                        type: 'Identifier',
                        name: '__ret'
                    },
                    right: ast.expression
                }
            }
        case 'BlockStatement':
            transformLastInBlock(ast.body)
            break
        case 'ForStatement':
        case "WhileStatement":
        case 'ForOfStatement':
        case 'ForInStatement':
        case 'DoWhileStatement':
        case 'WithStatement':
            ast.body = transformStatement(ast.body)
            break
        case 'IfStatement':
            ast.consequent = transformStatement(ast.consequent)
            if (ast.alternate)
                ast.alternate = transformStatement(ast.alternate)
            break
    }

    return ast
}


export default declareCommand({
    commandName: "eval",
    dependsOn: NO_EXTRA_CONFIG,
    targetType: ApplicationCommandType.Message,
    contextDefinition:
        new ContextMenuCommandBuilder()
            .setName('eval')
            .setType(ApplicationCommandType.Message),
    async run(interaction: ContextMenuCommandInteraction, target: Message): Promise<void> {
        if (interaction.user.id !== config.owner) {
            await interaction.reply("who tf are you")
            return;
        }
        await interaction.deferReply();
        const match = target.content.match(/```js\n(.*?)```/s)
        if (!match) {
            await interaction.followUp("no codeblock found")
            return
        }
        const code = match[1];
        let ast = acornParse(code, {
            ecmaVersion: 2020,
            allowReturnOutsideFunction: true,
            allowAwaitOutsideFunction: true,
        })
        if (ast.body) {
            ast.body.unshift({
                type: 'VariableDeclaration',
                kind: 'let',
                end: 0, start: 0,
                declarations: [{
                    end: 0, start: 0,
                    id: {
                        start: 0,
                        end: 0,
                        type: 'Identifier',
                        name: '__ret'
                    },
                    type: "VariableDeclarator"
                }]
            })
            transformLastInBlock(ast.body)
            ast.body.push({
                type: 'ReturnStatement',
                end: 0, start: 0,
                argument: {
                    type: 'Identifier',
                    end: 0,
                    start: 0,
                    name: '__ret'
                }
            })
        }
        const mappedCode = generate(ast)

        const bindings: { name: string, value: any }[] = [
            { name: 'add100', value: (x: number) => x + 100 },
            { name: 'client', value: interaction.client },
            { name: 'interaction', value: interaction },
            { name: 'getUser', value: (snowflake: UserResolvable) => interaction.client.users.fetch(snowflake) },
        ]
        const func = new Function(...bindings.map(it => it.name), `"use strict";\nreturn (async () => {\n${mappedCode}\n})();`,)

        await interaction.editReply("running...")
        let result
        result = await func(...bindings.map(it => it.value))
        if (typeof result === "undefined") {
            await interaction.editReply("result was undefined, did you forget to return?")
        } else {
            await interaction.editReply('```js\n' + escapeCodeBlock(inspect(result)) + "\n```")
        }
    }
})
