export function singularize(word: string): string {
    if (word.length < 3) return word;
    const lower = word.toLowerCase();
    if (lower.endsWith('ies') && lower.length > 3) return word.slice(0, -3) + 'y';
    if (lower.endsWith('ses') || lower.endsWith('xes') || lower.endsWith('zes'))
        return word.slice(0, -2);
    if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us'))
        return word.slice(0, -1);
    return word;
}
