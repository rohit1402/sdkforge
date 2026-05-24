import type { SdkBlueprint, TypeNode } from '../../blueprint/types';

export type JsonSchema = Record<string, unknown>;

/**
 * Render a TypeNode as a JSON Schema (Draft 7).
 *
 * Named refs are resolved against `blueprint.namedTypes` and inlined,
 * since MCP tool input schemas are typically self-contained.
 */
export function toJsonSchema(type: TypeNode | undefined, blueprint: SdkBlueprint): JsonSchema {
    return walk(type, blueprint, new Set());
}

function walk(
    type: TypeNode | undefined,
    blueprint: SdkBlueprint,
    visiting: Set<string>,
): JsonSchema {
    if (!type) return {};

    switch (type.kind) {
        case 'primitive':
            return withNullable(
                { type: type.name === 'integer' ? 'integer' : type.name },
                type.nullable,
            );

        case 'array':
            return withNullable(
                {
                    type: 'array',
                    items: walk(type.items, blueprint, visiting),
                },
                type.nullable,
            );

        case 'object': {
            const schema: JsonSchema = { type: 'object' };
            if (type.properties.length > 0) {
                const properties: Record<string, JsonSchema> = {};
                const required: string[] = [];
                for (const p of type.properties) {
                    properties[p.name] = walk(p.type, blueprint, visiting);
                    if (p.required) required.push(p.name);
                }
                schema.properties = properties;
                if (required.length > 0) schema.required = required;
            }
            if (type.additionalProperties) {
                schema.additionalProperties = walk(type.additionalProperties, blueprint, visiting);
            }
            return withNullable(schema, type.nullable);
        }

        case 'ref': {
            // Cycle guard: emit a permissive schema rather than recursing forever.
            if (visiting.has(type.name)) return {};
            const target = blueprint.namedTypes[type.name];
            if (!target) return {};
            const nextVisiting = new Set(visiting);
            nextVisiting.add(type.name);
            return walk(target, blueprint, nextVisiting);
        }

        case 'union':
            return withNullable(
                { anyOf: type.variants.map((v) => walk(v, blueprint, visiting)) },
                type.nullable,
            );

        case 'intersection':
            return withNullable(
                { allOf: type.parts.map((p) => walk(p, blueprint, visiting)) },
                type.nullable,
            );

        case 'enum':
            return withNullable(
                {
                    type: type.base === 'string' ? 'string' : 'number',
                    enum: type.values,
                },
                type.nullable,
            );

        case 'blob':
            // No good JSON Schema representation for binary; treat as opaque string.
            return withNullable({ type: 'string' }, type.nullable);

        case 'unknown':
            return {};
    }
}

function withNullable(schema: JsonSchema, nullable: boolean): JsonSchema {
    if (!nullable || !('type' in schema)) return schema;
    return { ...schema, type: [schema.type, 'null'] };
}
