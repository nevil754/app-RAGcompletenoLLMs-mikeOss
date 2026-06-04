import * as path from "path";
import * as fs from "fs";
import type {
    StreamChatParams,
    StreamChatResult,
    NormalizedToolCall,
    NormalizedToolResult,
} from "./types";
import {toOpenAITools} from "./tools";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

const RAW_STREAM_LOG_PATH = path.resolve(
    process.cwd(),
    "openai-raw-stream.log",
);
import {get_llm} from "../../settings";

async function fetchLLM() {
    const llm = await get_llm();
    return llm;
}

type ContentBlock =
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: unknown }
    | { type: string; [key: string]: unknown };

type NativeMessage = {
    role : "user" | "assistant";
    content: string | ContentBlock[];
};

const MAX_TOKENS = 16384;

export function client(override?: string | null): BaseChatModel {
    const apikey = override?.trim() || process.env.OPENAI_API_KEY || "";
    return new BaseChatModel({apiKey});
};

function toNativeMessages(
    messages: StreamChatParams["messages"],
): NativeMessage[] {
    return messages.map((m) => ({ role:m.role, content:m.content }) );
}


