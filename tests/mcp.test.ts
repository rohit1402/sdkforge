import { resolve } from 'node:path';
import { buildBlueprint } from '../src/blueprint/build';
import { toolName } from '../src/commands/mcp/helpers';
import { toJsonSchema } from '../src/commands/mcp/json-schema';
import { buildToolDefinitions } from '../src/commands/mcp/tools';
import { parseSpec } from '../src/parser';
import type { SdkBlueprint } from '../src/blueprint/types';

const EXAMPLES = resolve(__dirname, '..', 'examples');

describe('toolName', () => {
    it('snake_cases both segments', () => {
        expect(toolName('pets', 'listPets')).toBe('pets_list_pets');
        expect(toolName('userManagement', 'getUserById')).toBe('user_management_get_user_by_id');
    });
});

describe('toJsonSchema', () => {
    let blueprint: SdkBlueprint;
    beforeAll(async () => {
        const doc = await parseSpec(resolve(EXAMPLES, 'petstore.yaml'));
        blueprint = buildBlueprint(doc).blueprint;
    });

    it('converts a primitive', () => {
        expect(toJsonSchema({ kind: 'primitive', name: 'string', nullable: false }, blueprint)).toEqual({
            type: 'string',
        });
    });

    it('represents nullable primitives as a type array', () => {
        expect(toJsonSchema({ kind: 'primitive', name: 'string', nullable: true }, blueprint)).toEqual({
            type: ['string', 'null'],
        });
    });

    it('integer primitive maps to JSON Schema integer', () => {
        expect(toJsonSchema({ kind: 'primitive', name: 'integer', nullable: false }, blueprint)).toEqual({
            type: 'integer',
        });
    });

    it('inlines a $ref by resolving against named types', () => {
        const result = toJsonSchema({ kind: 'ref', name: 'Pet' }, blueprint);
        expect(result.type).toBe('object');
        expect((result.properties as Record<string, unknown>)['id']).toEqual({ type: 'string' });
        expect(result.required).toEqual(['id', 'name']);
    });

    it('emits anyOf for unions', () => {
        expect(
            toJsonSchema(
                {
                    kind: 'union',
                    variants: [
                        { kind: 'primitive', name: 'string', nullable: false },
                        { kind: 'primitive', name: 'number', nullable: false },
                    ],
                    nullable: false,
                },
                blueprint,
            ),
        ).toEqual({ anyOf: [{ type: 'string' }, { type: 'number' }] });
    });

    it('handles refs without infinite loop', () => {
        const result = toJsonSchema({ kind: 'ref', name: 'Pet' }, blueprint);
        expect(result).toBeDefined();
    });
});

describe('buildToolDefinitions', () => {
    let blueprint: SdkBlueprint;
    beforeAll(async () => {
        const doc = await parseSpec(resolve(EXAMPLES, 'petstore.yaml'));
        blueprint = buildBlueprint(doc).blueprint;
    });

    it('produces one tool per operation', () => {
        const tools = buildToolDefinitions(blueprint);
        expect(tools.map((t) => t.name).sort()).toEqual([
            'pets_create_pet',
            'pets_delete_pet_by_id',
            'pets_get_pet_by_id',
            'pets_list_pets',
            'store_place_order',
        ]);
    });

    it('includes path params as required in the input schema', () => {
        const tools = buildToolDefinitions(blueprint);
        const getPet = tools.find((t) => t.name === 'pets_get_pet_by_id')!;
        expect(getPet.inputSchema).toMatchObject({
            type: 'object',
            properties: { petId: { type: 'string' } },
            required: ['petId'],
        });
    });

    it('includes optional query params (not in required)', () => {
        const tools = buildToolDefinitions(blueprint);
        const list = tools.find((t) => t.name === 'pets_list_pets')!;
        const props = list.inputSchema.properties as Record<string, unknown>;
        expect(props['limit']).toEqual({ type: 'integer' });
        expect(list.inputSchema.required).toBeUndefined();
    });

    it('includes request body as a required `body` field', () => {
        const tools = buildToolDefinitions(blueprint);
        const create = tools.find((t) => t.name === 'pets_create_pet')!;
        const props = create.inputSchema.properties as Record<string, unknown>;
        expect(props['body']).toMatchObject({ type: 'object' });
        expect(create.inputSchema.required).toContain('body');
    });
});
