export function splitWords(input: string): string[] {
    return input
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

export function camelCase(input: string): string {
    const words = splitWords(input);
    if (words.length === 0) return '';
    return words.map((w, i) => (i === 0 ? w.toLowerCase() : capitalize(w))).join('');
}

export function pascalCase(input: string): string {
    return splitWords(input).map(capitalize).join('');
}

export function snakeCase(input: string): string {
    return splitWords(input)
        .map((w) => w.toLowerCase())
        .join('_');
}

export function isValidIdentifier(input: string): boolean {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(input) && !RESERVED.has(input);
}

function capitalize(word: string): string {
    if (word.length === 0) return word;
    return word[0]!.toUpperCase() + word.slice(1).toLowerCase();
}

const RESERVED = new Set([
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'enum',
    'export',
    'extends',
    'false',
    'finally',
    'for',
    'function',
    'if',
    'import',
    'in',
    'instanceof',
    'new',
    'null',
    'return',
    'super',
    'switch',
    'this',
    'throw',
    'true',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',
    'yield',
    'let',
    'static',
    'implements',
    'interface',
    'package',
    'private',
    'protected',
    'public',
]);
