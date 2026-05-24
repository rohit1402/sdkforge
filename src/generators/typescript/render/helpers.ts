import { pascalCase } from '../../../utils/casing';

export function resourceClassName(name: string): string {
    return `${pascalCase(name)}Resource`;
}
