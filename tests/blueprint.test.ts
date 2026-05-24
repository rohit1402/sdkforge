import { resolve } from 'node:path';
import { buildBlueprint } from '../src/blueprint/build';
import { createContext } from '../src/blueprint/context';
import { formatTypeNode } from '../src/blueprint/format';
import { toTypeNode } from '../src/blueprint/schema';
import { parseSpec } from '../src/parser';

const EXAMPLES = resolve(__dirname, '..', 'examples');

describe('buildBlueprint — petstore.yaml', () => {
    it('produces the expected resources and operations', async () => {
        const doc = await parseSpec(resolve(EXAMPLES, 'petstore.yaml'));
        const { blueprint, warnings } = buildBlueprint(doc);

        expect(blueprint.resources.map((r) => r.name).sort()).toEqual(['pets', 'store']);

        const pets = blueprint.resources.find((r) => r.name === 'pets')!;
        expect(pets.operations.map((o) => o.name).sort()).toEqual([
            'createPet',
            'deletePetById',
            'getPetById',
            'listPets',
        ]);

        expect(warnings).toHaveLength(0);
    });

    it('captures named types from components.schemas', async () => {
        const doc = await parseSpec(resolve(EXAMPLES, 'petstore.yaml'));
        const { blueprint } = buildBlueprint(doc);

        expect(Object.keys(blueprint.namedTypes).sort()).toEqual([
            'Error',
            'Metadata',
            'NewPet',
            'Order',
            'Pet',
        ]);
    });

    it('captures additionalProperties as a pure dictionary type', async () => {
        const doc = await parseSpec(resolve(EXAMPLES, 'petstore.yaml'));
        const { blueprint } = buildBlueprint(doc);

        const metadata = blueprint.namedTypes['Metadata'];
        expect(metadata?.kind).toBe('object');
        if (metadata?.kind !== 'object') return;

        expect(metadata.properties).toEqual([]);
        expect(metadata.additionalProperties).toEqual({
            kind: 'primitive',
            name: 'string',
            nullable: false,
        });
    });

    it('detects bearer auth', async () => {
        const doc = await parseSpec(resolve(EXAMPLES, 'petstore.yaml'));
        const { blueprint } = buildBlueprint(doc);

        expect(blueprint.meta.hasBearerAuth).toBe(true);
    });

    it('reads baseUrl from the first server entry', async () => {
        const doc = await parseSpec(resolve(EXAMPLES, 'petstore.yaml'));
        const { blueprint } = buildBlueprint(doc);

        expect(blueprint.meta.baseUrl).toBe('https://petstore.example.com/v1');
    });
});

describe('buildBlueprint — users.yaml (no tags)', () => {
    it('falls back to path-segment grouping when tags are absent', async () => {
        const doc = await parseSpec(resolve(EXAMPLES, 'users.yaml'));
        const { blueprint, warnings } = buildBlueprint(doc);

        expect(blueprint.resources.map((r) => r.name)).toEqual(['users']);

        const ops = blueprint.resources[0]!.operations;
        expect(ops.map((o) => o.name).sort()).toEqual(['getUserById', 'getUsers']);

        // GET /users/{id} has no operationId → fallback-naming warning expected
        expect(warnings.some((w) => w.code === 'fallback-naming')).toBe(true);
    });
});

describe('formatTypeNode — invalid identifier property names', () => {
    it('quotes property names with dots', () => {
        const ctx = createContext();
        const result = toTypeNode(
            {
                type: 'object',
                required: ['api_key.created'],
                properties: { 'api_key.created': { type: 'string' } },
            } as any,
            ctx,
            'loc',
            0,
        );
        expect(formatTypeNode(result)).toBe('{ "api_key.created": string }');
    });

    it('leaves valid identifier names unquoted', () => {
        const ctx = createContext();
        const result = toTypeNode(
            {
                type: 'object',
                required: ['userId'],
                properties: { userId: { type: 'string' } },
            } as any,
            ctx,
            'loc',
            0,
        );
        expect(formatTypeNode(result)).toBe('{ userId: string }');
    });
});

describe('toTypeNode — additionalProperties edge cases', () => {
    it('treats `true` as an unknown index type', () => {
        const ctx = createContext();
        const result = toTypeNode({ type: 'object', additionalProperties: true } as any, ctx, 'loc', 0);
        expect(result.kind).toBe('object');
        if (result.kind !== 'object') return;
        expect(result.additionalProperties).toEqual({ kind: 'unknown', nullable: false });
        expect(formatTypeNode(result)).toBe('Record<string, unknown>');
    });

    it('treats `false` as no index type (closed object)', () => {
        const ctx = createContext();
        const result = toTypeNode(
            { type: 'object', properties: { id: { type: 'string' } }, additionalProperties: false } as any,
            ctx,
            'loc',
            0,
        );
        expect(result.kind).toBe('object');
        if (result.kind !== 'object') return;
        expect(result.additionalProperties).toBeUndefined();
    });

    it('renders mixed shape as { prop; [key: string]: T }', () => {
        const ctx = createContext();
        const result = toTypeNode(
            {
                type: 'object',
                required: ['primary'],
                properties: { primary: { type: 'boolean' } },
                additionalProperties: { type: 'boolean' },
            } as any,
            ctx,
            'loc',
            0,
        );
        expect(formatTypeNode(result)).toBe('{ primary: boolean; [key: string]: boolean }');
    });
});

describe('buildBlueprint — degraded.yaml', () => {
    it('skips operations with unsupported request bodies', async () => {
        const doc = await parseSpec(resolve(EXAMPLES, 'degraded.yaml'));
        const { blueprint, warnings } = buildBlueprint(doc);

        const skipped = warnings.find((w) => w.code === 'skipped-operation');
        expect(skipped).toBeDefined();
        expect(skipped?.message).toMatch(/multipart\/form-data/);

        // uploadFile is skipped (multipart); getItem and replaceItem remain
        const allOps = blueprint.resources.flatMap((r) => r.operations.map((o) => o.name)).sort();
        expect(allOps).toEqual(['getItem', 'replaceItem']);
    });

    it('emits oneOf as a union with a lossy-degradation warning', async () => {
        const doc = await parseSpec(resolve(EXAMPLES, 'degraded.yaml'));
        const { blueprint, warnings } = buildBlueprint(doc);

        expect(warnings.some((w) => w.code === 'lossy-degradation' && w.message.includes('oneOf'))).toBe(true);

        const getItem = blueprint.resources[0]!.operations.find((o) => o.name === 'getItem')!;
        const okResp = getItem.responses.find((r) => r.status === 200)!;
        expect(okResp.type?.kind).toBe('union');
    });

    it('resolves $ref request bodies through components.requestBodies', async () => {
        const doc = await parseSpec(resolve(EXAMPLES, 'degraded.yaml'));
        const { blueprint, warnings } = buildBlueprint(doc);

        const replaceItem = blueprint.resources[0]!.operations.find((o) => o.name === 'replaceItem')!;
        expect(replaceItem).toBeDefined();
        expect(replaceItem.requestBody).toBeDefined();
        expect(replaceItem.requestBody?.contentType).toBe('application/json');
        expect(replaceItem.requestBody?.required).toBe(true);
        expect(replaceItem.requestBody?.type).toEqual({ kind: 'ref', name: 'Book' });

        // No skip-operation warning for replaceItem — only the multipart one
        const skipReasons = warnings.filter((w) => w.code === 'skipped-operation').map((w) => w.location);
        expect(skipReasons).toEqual(['POST /uploads']);
    });
});
