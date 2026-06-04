import { streamClaude, completeClaudeText } from "./claude";  //ur custom here accanto
import { streamGemini, completeGeminiText } from "./gemini";  //ur custom here accanto
import {streamOpenAI, completeOpenAIText} from "./openai";
import { providerForModel } from "./models";   //ur custom here accanto
import type { StreamChatParams, StreamChatResult, UserApiKeys } from "./types";  //ur custom here accanto

export * from "./types";
export * from "./models";  //da cambiare con get_llm() il mio in settings.ts

export async function streamChatWithTools(
    params: StreamChatParams,
): Promise<StreamChatResult> {
    const provider = providerForModel(params.model);
    if (provider === "claude") return streamClaude(params)
    else if (provider === "openai") return 
    return streamGemini(params);
}

export async function completeText(params: {
    model: string;
    systemPrompt?: string;
    user: string;
    maxTokens?: number;
    apiKeys?: UserApiKeys;
}): Promise<string> {
    const provider = providerForModel(params.model);
    if (provider === "claude") return completeClaudeText(params);
    return completeGeminiText(params);
    //penso che sia meglio lo switch qua!
}


