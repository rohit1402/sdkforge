import { resolve } from 'node:path';
import { buildBlueprint } from '../src/blueprint/build';
import { buildToolHandlers } from '../src/commands/mcp/handlers';
import { buildToolDefinitions } from '../src/commands/mcp/tools';
import { parseSpec } from '../src/parser';
import type { SdkBlueprint } from '../src/blueprint/types';

const EXAMPLES = resolve(__dirname, '..', 'examples');

describe('mcp command — handlers', () => {
    let blueprint: SdkBlueprint;
    let fetchMock: jest.SpyInstance;

    beforeAll(async () => {
        const doc = await parseSpec(resolve(EXAMPLES, 'petstore.yaml'));
        blueprint = buildBlueprint(doc).blueprint;
    });

    beforeEach(() => {
        fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
            Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                }),
            ),
        );
    });

    afterEach(() => {
        fetchMock.mockRestore();
    });

    it('buildToolDefinitions returns one tool per operation', () => {
        const tools = buildToolDefinitions(blueprint);
        expect(tools.map((t) => t.name).sort()).toEqual([
            'pets_create_pet',
            'pets_delete_pet_by_id',
            'pets_get_pet_by_id',
            'pets_list_pets',
            'store_place_order',
        ]);
    });

    it('buildToolHandlers returns a handler per tool', () => {
        const handlers = buildToolHandlers(blueprint, { baseURL: 'https://api.example.com' });
        expect(Object.keys(handlers).sort()).toEqual([
            'pets_create_pet',
            'pets_delete_pet_by_id',
            'pets_get_pet_by_id',
            'pets_list_pets',
            'store_place_order',
        ]);
    });

    it('substitutes path params into the URL', async () => {
        const handlers = buildToolHandlers(blueprint, { baseURL: 'https://api.example.com' });
        await handlers['pets_get_pet_by_id']!({ petId: 'p_123' });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url] = fetchMock.mock.calls[0]!;
        expect(String(url)).toBe('https://api.example.com/pets/p_123');
    });

    it('passes query params to the URL', async () => {
        const handlers = buildToolHandlers(blueprint, { baseURL: 'https://api.example.com' });
        await handlers['pets_list_pets']!({ limit: 20 });

        const [url] = fetchMock.mock.calls[0]!;
        expect(String(url)).toBe('https://api.example.com/pets?limit=20');
    });

    it('omits query params that are undefined', async () => {
        const handlers = buildToolHandlers(blueprint, { baseURL: 'https://api.example.com' });
        await handlers['pets_list_pets']!({});

        const [url] = fetchMock.mock.calls[0]!;
        expect(String(url)).toBe('https://api.example.com/pets');
    });

    it('passes body as JSON in the request', async () => {
        const handlers = buildToolHandlers(blueprint, { baseURL: 'https://api.example.com' });
        await handlers['pets_create_pet']!({ body: { name: 'Mochi', tag: 'cat' } });

        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.method).toBe('POST');
        expect(init.body).toBe(JSON.stringify({ name: 'Mochi', tag: 'cat' }));
        expect(init.headers['Content-Type']).toBe('application/json');
    });

    it('injects Bearer auth when apiKey is set', async () => {
        const handlers = buildToolHandlers(blueprint, {
            baseURL: 'https://api.example.com',
            apiKey: 'secret-token',
        });
        await handlers['pets_list_pets']!({});

        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.headers['Authorization']).toBe('Bearer secret-token');
    });

    it('throws when a required path param is missing', async () => {
        const handlers = buildToolHandlers(blueprint, { baseURL: 'https://api.example.com' });
        await expect(handlers['pets_get_pet_by_id']!({})).rejects.toThrow(/petId/);
    });

    it('throws SDKError on non-2xx responses', async () => {
        fetchMock.mockImplementationOnce(() =>
            Promise.resolve(
                new Response(JSON.stringify({ code: 404, message: 'not found' }), {
                    status: 404,
                    statusText: 'Not Found',
                    headers: { 'content-type': 'application/json' },
                }),
            ),
        );
        const handlers = buildToolHandlers(blueprint, { baseURL: 'https://api.example.com' });
        await expect(handlers['pets_get_pet_by_id']!({ petId: 'missing' })).rejects.toMatchObject({
            name: 'SDKError',
            status: 404,
            statusText: 'Not Found',
            body: { code: 404, message: 'not found' },
        });
    });
});
