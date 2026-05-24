import { dedupeNames, resolveOperationName, resolveResourceName } from '../src/blueprint/naming';
import type { BlueprintContext } from '../src/blueprint/context';
import { createContext } from '../src/blueprint/context';
import type { HttpMethod, OperationBlueprint } from '../src/blueprint/types';

function makeCtx(): BlueprintContext {
    return createContext();
}

describe('resolveResourceName', () => {
    it('uses the first tag when present', () => {
        expect(resolveResourceName({ tags: ['pets', 'admin'] } as any, '/pets')).toBe('pets');
    });

    it('camelCases multi-word tags', () => {
        expect(resolveResourceName({ tags: ['user-management'] } as any, '/')).toBe('userManagement');
    });

    it('falls back to first path segment when no tags', () => {
        expect(resolveResourceName({} as any, '/users/{id}')).toBe('users');
    });

    it('skips path-parameter segments in fallback', () => {
        expect(resolveResourceName({} as any, '/{tenant}/users')).toBe('users');
    });

    it('returns "root" for the literal / path', () => {
        expect(resolveResourceName({} as any, '/')).toBe('root');
    });
});

describe('resolveOperationName', () => {
    it('uses operationId when valid', () => {
        const ctx = makeCtx();
        expect(resolveOperationName('GET', '/pets', { operationId: 'listPets' } as any, ctx, 'loc')).toBe('listPets');
        expect(ctx.warnings).toHaveLength(0);
    });

    it('camelCases operationId', () => {
        const ctx = makeCtx();
        expect(resolveOperationName('POST', '/pets', { operationId: 'create_pet' } as any, ctx, 'loc')).toBe('createPet');
    });

    it('falls back to derived name when operationId is missing', () => {
        const ctx = makeCtx();
        const name = resolveOperationName('GET', '/users/{id}', {} as any, ctx, 'GET /users/{id}');
        expect(name).toBe('getUserById');
        expect(ctx.warnings).toHaveLength(1);
        expect(ctx.warnings[0]?.code).toBe('fallback-naming');
    });

    it('falls back when operationId is not a valid identifier', () => {
        const ctx = makeCtx();
        expect(resolveOperationName('GET', '/pets', { operationId: '123-invalid' } as any, ctx, 'loc')).toBe('getPets');
        expect(ctx.warnings).toHaveLength(1);
    });

    it('derives standard verbs from HTTP method', () => {
        const cases: Array<[HttpMethod, string, string]> = [
            ['GET', '/users', 'getUsers'],
            ['GET', '/users/{id}', 'getUserById'],
            ['POST', '/users', 'createUsers'],
            ['PUT', '/users/{id}', 'updateUserById'],
            ['PATCH', '/users/{id}', 'updateUserById'],
            ['DELETE', '/users/{id}', 'deleteUserById'],
        ];
        for (const [method, path, expected] of cases) {
            const ctx = makeCtx();
            expect(resolveOperationName(method, path, {} as any, ctx, `${method} ${path}`)).toBe(expected);
        }
    });

    it('singularizes the segment before a path parameter', () => {
        const ctx = makeCtx();
        expect(resolveOperationName('GET', '/categories/{id}', {} as any, ctx, 'loc')).toBe('getCategoryById');
    });
});

describe('dedupeNames', () => {
    it('preserves unique names', () => {
        const ctx = makeCtx();
        const ops = [{ name: 'getUser' }, { name: 'createUser' }] as OperationBlueprint[];
        const result = dedupeNames(ops, 'users', ctx);
        expect(result.map((o) => o.name)).toEqual(['getUser', 'createUser']);
        expect(ctx.warnings).toHaveLength(0);
    });

    it('appends suffix on collision and warns', () => {
        const ctx = makeCtx();
        const ops = [{ name: 'getUser' }, { name: 'getUser' }, { name: 'getUser' }] as OperationBlueprint[];
        const result = dedupeNames(ops, 'users', ctx);
        expect(result.map((o) => o.name)).toEqual(['getUser', 'getUser2', 'getUser3']);
        expect(ctx.warnings).toHaveLength(2);
        expect(ctx.warnings.every((w) => w.code === 'name-collision')).toBe(true);
    });
});
