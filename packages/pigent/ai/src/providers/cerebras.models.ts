// Empty built-in catalog for cerebras.
// Generated on a network-restricted build: models.dev was unreachable, so this
// provider ships no static catalog in Pigent v0.1. Model definitions can be
// supplied through settings.json models.providers.
import { flattenModelCatalog, type ModelCatalog } from "../model-catalog.ts";

export const CEREBRAS_MODELS: ModelCatalog<{}, "cerebras"> = flattenModelCatalog("cerebras", {});
