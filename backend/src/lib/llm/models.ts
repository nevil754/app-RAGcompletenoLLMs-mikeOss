import type { Provider } from "./types";

//⚠️ pero nel code non viene MAI usato OpenRouter(anche se esiste nelle env vars), quindi non posso usare modelli free di OpenRouter, e non ho api keys dirette x Claude o Gemini.   
//QUINDI IO USO la mia openai key e quindi posso usare solo i modelli openai!
//see original file at https://github.com/willchen96/mike/blob/main/backend/.env.example


// Canonical model IDs
// Main-chat tier (top-end) — user picks one of these per message.
export const CLAUDE_MAIN_MODELS = [
    "claude-opus-4-7", 
    "claude-sonnet-4-6"
] as const;  //non uso claude
export const GEMINI_MAIN_MODELS = [
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
] as const;  //non uso gemini


export const OPENAI_MAIN_MODELS = [
    "gpt-4.1-mini",
]as const;  //io uso openai!


// Mid-tier (used for tabular review) — user picks one in account settings.
export const CLAUDE_MID_MODELS = ["claude-sonnet-4-6"] as const;  //non uso claude
export const GEMINI_MID_MODELS = ["gemini-3-flash-preview"] as const;  //non uso gemini

export const OPENAI_MID_MODELS = ["gpt-4.1"] as const;  //io uso openai!

// Low-tier (used for title generation, lightweight extractions) — user picks
// one in account settings.
export const CLAUDE_LOW_MODELS = ["claude-haiku-4-5"] as const;  //non uso claude
export const GEMINI_LOW_MODELS = ["gemini-3.1-flash-lite-preview"] as const;  //non uso gemini

export const OPENAI_LOW_MODELS = ["gpt-4.1-nano"] as const;  //io uso openai!



export const DEFAULT_MAIN_MODEL =  "gpt-4.1-mini"   //"gemini-3-flash-preview";
export const DEFAULT_TITLE_MODEL =  "gpt-4.1-nano"   //"gemini-3.1-flash-lite-preview";
export const DEFAULT_TABULAR_MODEL =  "gpt-4.1-nano"   //"gemini-3-flash-preview";

const ALL_MODELS = new Set<string>([  //usando Set non puoi avere cloni!!
    // ...CLAUDE_MAIN_MODELS,
    // ...GEMINI_MAIN_MODELS,
    // ...CLAUDE_MID_MODELS,
    // ...GEMINI_MID_MODELS,
    // ...CLAUDE_LOW_MODELS,
    // ...GEMINI_LOW_MODELS,
    ...OPENAI_MAIN_MODELS,
    ...OPENAI_MID_MODELS,
    ...OPENAI_LOW_MODELS,
]);

// Provider inference

export function providerForModel(model: string): Provider {
    if (model.startsWith("claude")) return "claude";
    if (model.startsWith("gemini")) return "gemini";
    if (model.toLowerCase().startsWith("gpt")) return "openai";  //io uso openai!
    throw new Error(`Unknown model id: ${model}`);
}

export function resolveModel(id: string | null | undefined, fallback: string): string {
    if (id && ALL_MODELS.has(id)) return id;  
    return fallback;
}  //has() ritorna true/false in base se esiste il l'id (e.g.OPENAI_MID_MODELS) nel Set


