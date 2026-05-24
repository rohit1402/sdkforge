import type { SdkBlueprint } from '../../../blueprint/types';
import { resourceClassName } from './helpers';

export interface RenderedClient {
    baseUrl: string;
    resources: Array<{ name: string; className: string; fileName: string }>;
}

export function renderClient(blueprint: SdkBlueprint): RenderedClient {
    return {
        baseUrl: blueprint.meta.baseUrl ?? '',
        resources: blueprint.resources.map((r) => ({
            name: r.name,
            className: resourceClassName(r.name),
            fileName: r.name,
        })),
    };
}
