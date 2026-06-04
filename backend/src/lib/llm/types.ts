// Shared types for the LLM provider adapter.
// Callers always speak OpenAI-style tools + { role, content } messages; each
// provider translates internally.

export type Provider = "openai" | "claude" | "gemini" ;  //permette solo questi 2, magari pero pero io uso Openai api!!

export type OpenAIToolSchema = {
    type: "function";  //stesso stile di openai moderno
    function: {  //definizione della function
        name: string;
        description: string;
        parameters: Record<string, unknown>;  //la key deve essere str, mentre il value è unknwon
    };
};

export type LlmMessage = {
    role: "user" | "assistant";  //permette solo questi 2
    content: string;
};

export type NormalizedToolCall = {
    id: string;
    name: string;
    input: Record<string, unknown>;  //la key deve essere str, mentre il value è unknwon
};

export type NormalizedToolResult = {
    tool_use_id: string;
    content: string;
};

export type StreamCallbacks = {
    onReasoningDelta?: (text: string) => void;
    onReasoningBlockEnd?: () => void;
    onContentDelta?: (text: string) => void;
    onToolCallStart?: (call: NormalizedToolCall) => void;  //call chiamato quando AI vuole usarla
};

export type UserApiKeys = {
    openai?: string | null;  //io uso openai!
    claude?: string | null;
    gemini?: string | null;
};

export type StreamChatParams = {
    model: string;
    systemPrompt: string;
    messages: LlmMessage[];
    tools?: OpenAIToolSchema[];
    maxIterations?: number;
    callbacks?: StreamCallbacks;
    runTools?: (calls: NormalizedToolCall[]) => Promise<NormalizedToolResult[]>;
    apiKeys?: UserApiKeys;
    /**
     * Enable provider-side reasoning/thinking. Off by default — should only
     * be turned on for interactive chat surfaces where the user actually
     * benefits from seeing the thought stream. Bulk extraction jobs and
     * one-shot completions should leave this off to save tokens and latency.
     */
    enableThinking?: boolean;
};

export type StreamChatResult = {
    fullText: string;
};
