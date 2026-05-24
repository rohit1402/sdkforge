import type { Warning, WarningCode } from './types';

export interface BlueprintContext {
    warnings: Warning[];
    warn: (code: WarningCode, message: string, location?: string) => void;
}

export function createContext(): BlueprintContext {
    const warnings: Warning[] = [];
    return {
        warnings,
        warn: (code, message, location) => warnings.push({ code, message, location }),
    };
}
