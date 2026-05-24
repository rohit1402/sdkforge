import { existsSync, readdirSync, statSync } from 'node:fs';
import { ParseError } from '../parser';

export class ValidationError extends Error {}
export class IOError extends Error {}

export function validateInputPath(inputPath: string): void {
    if (!existsSync(inputPath)) {
        throw new ValidationError(`Input file not found: ${inputPath}`);
    }
    const stat = statSync(inputPath);
    if (!stat.isFile()) {
        throw new ValidationError(`Input is not a file: ${inputPath}`);
    }
}

export function validateOutputPath(outputPath: string, force: boolean): void {
    if (!existsSync(outputPath)) return;

    const stat = statSync(outputPath);
    if (!stat.isDirectory()) {
        throw new IOError(`Output path exists and is not a directory: ${outputPath}`);
    }

    const entries = readdirSync(outputPath);
    if (entries.length > 0 && !force) {
        throw new IOError(
            `Output directory is not empty: ${outputPath}\nPass --force to overwrite.`,
        );
    }
}

export function exitCodeFor(err: unknown): number {
    if (err instanceof ValidationError) return 1;
    if (err instanceof ParseError) return 1;
    if (err instanceof IOError) return 3;
    return 2;
}
