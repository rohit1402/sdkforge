import { formatTypeNode } from '../../../blueprint/format';
import type { PropertyNode, SdkBlueprint, TypeNode } from '../../../blueprint/types';

export interface RenderedTypes {
    namedTypes: Array<{ name: string; declaration: string }>;
}

export function renderTypes(blueprint: SdkBlueprint): RenderedTypes {
    return {
        namedTypes: Object.entries(blueprint.namedTypes).map(([name, type]) => ({
            name,
            declaration: renderNamedType(name, type),
        })),
    };
}

function renderNamedType(name: string, type: TypeNode): string {
    if (type.kind === 'object') {
        // Pure dictionary → type alias is cleaner than an empty interface with an index signature
        if (type.properties.length === 0 && type.additionalProperties) {
            return `export type ${name} = Record<string, ${formatTypeNode(type.additionalProperties)}>;`;
        }
        const lines = type.properties.map((p) => `    ${renderPropertyLine(p)}`);
        if (type.additionalProperties) {
            lines.push(`    [key: string]: ${formatTypeNode(type.additionalProperties)};`);
        }
        return `export interface ${name} {\n${lines.join('\n')}\n}`;
    }
    return `export type ${name} = ${formatTypeNode(type)};`;
}

function renderPropertyLine(p: PropertyNode): string {
    return `${p.name}${p.required ? '' : '?'}: ${formatTypeNode(p.type)};`;
}
