import { camelCase, isValidIdentifier, pascalCase, splitWords } from '../src/utils/casing';

describe('splitWords', () => {
    it('splits kebab-case', () => {
        expect(splitWords('foo-bar-baz')).toEqual(['foo', 'bar', 'baz']);
    });

    it('splits snake_case', () => {
        expect(splitWords('foo_bar_baz')).toEqual(['foo', 'bar', 'baz']);
    });

    it('splits camelCase', () => {
        expect(splitWords('fooBarBaz')).toEqual(['foo', 'Bar', 'Baz']);
    });

    it('splits PascalCase', () => {
        expect(splitWords('FooBarBaz')).toEqual(['Foo', 'Bar', 'Baz']);
    });

    it('handles consecutive uppercase (acronym boundary)', () => {
        expect(splitWords('parseJSONResponse')).toEqual(['parse', 'JSON', 'Response']);
    });

    it('returns empty array on empty input', () => {
        expect(splitWords('')).toEqual([]);
    });

    it('strips non-alphanumeric runs', () => {
        expect(splitWords('foo--bar...baz')).toEqual(['foo', 'bar', 'baz']);
    });
});

describe('camelCase', () => {
    it('converts kebab-case', () => {
        expect(camelCase('foo-bar-baz')).toBe('fooBarBaz');
    });

    it('converts snake_case', () => {
        expect(camelCase('user_id')).toBe('userId');
    });

    it('preserves already-camelCase input', () => {
        expect(camelCase('userId')).toBe('userId');
    });

    it('downcases PascalCase first word', () => {
        expect(camelCase('UserId')).toBe('userId');
    });

    it('returns empty string on empty input', () => {
        expect(camelCase('')).toBe('');
    });

    it('handles single-word input', () => {
        expect(camelCase('users')).toBe('users');
    });
});

describe('pascalCase', () => {
    it('converts snake_case', () => {
        expect(pascalCase('user_id')).toBe('UserId');
    });

    it('converts kebab-case', () => {
        expect(pascalCase('foo-bar')).toBe('FooBar');
    });

    it('preserves single capitalized word', () => {
        expect(pascalCase('Pet')).toBe('Pet');
    });
});

describe('isValidIdentifier', () => {
    it('accepts simple identifiers', () => {
        expect(isValidIdentifier('foo')).toBe(true);
        expect(isValidIdentifier('fooBar')).toBe(true);
        expect(isValidIdentifier('_private')).toBe(true);
        expect(isValidIdentifier('$dollar')).toBe(true);
        expect(isValidIdentifier('a123')).toBe(true);
    });

    it('rejects identifiers starting with a digit', () => {
        expect(isValidIdentifier('123abc')).toBe(false);
    });

    it('rejects identifiers with hyphens or spaces', () => {
        expect(isValidIdentifier('foo-bar')).toBe(false);
        expect(isValidIdentifier('foo bar')).toBe(false);
    });

    it('rejects reserved words', () => {
        expect(isValidIdentifier('class')).toBe(false);
        expect(isValidIdentifier('return')).toBe(false);
        expect(isValidIdentifier('interface')).toBe(false);
    });

    it('rejects empty string', () => {
        expect(isValidIdentifier('')).toBe(false);
    });
});
