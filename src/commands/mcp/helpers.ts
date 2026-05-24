import { snakeCase } from '../../utils/casing';

export function toolName(resourceName: string, operationName: string): string {
    return `${snakeCase(resourceName)}_${snakeCase(operationName)}`;
}
