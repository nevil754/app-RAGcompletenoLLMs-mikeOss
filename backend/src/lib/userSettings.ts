import { createServerSupabase } from "./supabase";   //ur custom
import {
    resolveModel,           //proviene da models.ts TODO FIX BC usero il mio settings.ts
    DEFAULT_TITLE_MODEL,    //proviene da models.ts TODO FIX BC usero il mio settings.ts
    DEFAULT_TABULAR_MODEL,  //proviene da models.ts TODO FIX BC usero il mio settings.ts
    type UserApiKeys,  //proviene da types.ts
} from "./llm";

export type UserModelSettings = {
    title_model: string;
    tabular_model: string;
    api_keys: UserApiKeys;
};

// Title generation is a lightweight task — always routed to the cheapest model
// of whichever provider the user has keys for: Gemini Flash Lite if Gemini is
// available, otherwise Claude Haiku. With no user keys set, defaults to Gemini
// (the dev-mode env fallback).
function resolveTitleModel(apiKeys: UserApiKeys): string {
    if (apiKeys.openai?.trim()) return DEFAULT_TITLE_MODEL;  //io uso openai!
    if (apiKeys.gemini?.trim()) return DEFAULT_TITLE_MODEL;
    if (apiKeys.claude?.trim()) return "claude-haiku-4-5";
    return DEFAULT_TITLE_MODEL;
}

export async function getUserModelSettings(
    userId: string,
    db?: ReturnType<typeof createServerSupabase>,
): Promise<UserModelSettings> {
    const client = db ?? createServerSupabase();
    const { data } = await client
        .from("user_profiles")
        .select("tabular_model, claude_api_key, gemini_api_key, openai_api_key")
        .eq("user_id", userId)
        .single();
    const api_keys: UserApiKeys = {
        openai: data?.openai_api_key ?? null, //io uso openai!
        claude: data?.claude_api_key ?? null,
        gemini: data?.gemini_api_key ?? null,
    };
    return {
        title_model: resolveTitleModel(api_keys),
        tabular_model: resolveModel(data?.tabular_model, DEFAULT_TABULAR_MODEL),
        api_keys,
    };
}

export async function getUserApiKeys(
    userId: string,
    db?: ReturnType<typeof createServerSupabase>,
): Promise<UserApiKeys> {
    const client = db ?? createServerSupabase();
    const { data } = await client
        .from("user_profiles")
        .select("claude_api_key, gemini_api_key, openai_api_key")
        .eq("user_id", userId)
        .single();
    return {
        openai: data?.openai_api_key ?? null,  //io uso openai!
        claude: data?.claude_api_key ?? null,
        gemini: data?.gemini_api_key ?? null,
    };
}
