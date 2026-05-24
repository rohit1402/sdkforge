import type { OpenAPIV3 } from 'openapi-types';
import { sanitizeIdentifier } from '../utils/casing';
import type { BlueprintContext } from './context';
import type { TypeNode } from './types';

const MAX_ANONYMOUS_DEPTH = 3;

export function toTypeNode(
    schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined,
    ctx: BlueprintContext,
    location: string,
    depth: number,
): TypeNode {
    if (!schema) return { kind: 'unknown', nullable: false };

    if ('$ref' in schema) {
        const name = refToSchemaName(schema.$ref);
        if (!name) {
            ctx.warn('lossy-degradation', `Unresolvable $ref: ${schema.$ref}`, location);
            return { kind: 'unknown', nullable: false };
        }
        return { kind: 'ref', name };
    }

    const nullable = schema.nullable === true;

    if (schema.discriminator) {
        ctx.warn(
            'lossy-degradation',
            'discriminator polymorphism not supported; emitting unknown',
            location,
        );
        return { kind: 'unknown', nullable };
    }

    if (schema.oneOf || schema.anyOf) {
        const subs = (schema.oneOf ?? schema.anyOf)!;
        const which = schema.oneOf ? 'oneOf' : 'anyOf';
        ctx.warn('lossy-degradation', `${which} emitted as TS union`, location);
        const variants = subs.map((s, i) =>
            toTypeNode(s, ctx, `${location} ${which}[${i}]`, depth + 1),
        );
        return { kind: 'union', variants, nullable };
    }

    if (schema.allOf) {
        const parts = schema.allOf.map((s, i) =>
            toTypeNode(s, ctx, `${location} allOf[${i}]`, depth + 1),
        );
        return { kind: 'intersection', parts, nullable };
    }

    if (
        schema.enum &&
        (schema.type === 'string' || schema.type === 'number' || schema.type === 'integer')
    ) {
        const base = schema.type === 'string' ? 'string' : 'number';
        return { kind: 'enum', base, values: schema.enum, nullable };
    }

    if (schema.type === 'string' && schema.format === 'binary') {
        return { kind: 'blob', nullable };
    }

    if (
        schema.type === 'string' ||
        schema.type === 'number' ||
        schema.type === 'integer' ||
        schema.type === 'boolean'
    ) {
        return { kind: 'primitive', name: schema.type, nullable };
    }

    if (schema.type === 'array') {
        return {
            kind: 'array',
            items: toTypeNode(schema.items, ctx, `${location} items`, depth + 1),
            nullable,
        };
    }

    if (
        schema.type === 'object' ||
        schema.properties ||
        schema.additionalProperties !== undefined
    ) {
        if (depth > MAX_ANONYMOUS_DEPTH) {
            ctx.warn(
                'lossy-degradation',
                `Anonymous object nested deeper than ${MAX_ANONYMOUS_DEPTH} levels; emitting unknown`,
                location,
            );
            return { kind: 'unknown', nullable };
        }
        const required = new Set(schema.required ?? []);
        const properties = Object.entries(schema.properties ?? {}).map(([name, sub]) => ({
            name,
            type: toTypeNode(sub, ctx, `${location}.${name}`, depth + 1),
            required: required.has(name),
        }));
        const additionalProperties = resolveAdditionalProperties(
            schema.additionalProperties,
            ctx,
            location,
            depth,
        );
        return { kind: 'object', properties, additionalProperties, nullable };
    }

    return { kind: 'unknown', nullable };
}

function refToSchemaName(ref: string): string | undefined {
    const match = ref.match(/^#\/components\/schemas\/([^/]+)$/);
    return match?.[1] ? sanitizeIdentifier(match[1]) : undefined;
}

function resolveAdditionalProperties(
    value: OpenAPIV3.SchemaObject['additionalProperties'],
    ctx: BlueprintContext,
    location: string,
    depth: number,
): TypeNode | undefined {
    if (value === undefined || value === false) return undefined;
    if (value === true) return { kind: 'unknown', nullable: false };
    return toTypeNode(value, ctx, `${location} additionalProperties`, depth + 1);
}
