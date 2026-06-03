import * as path from "path";
import * as fs from "fs";
import type {
    StreamChatParams,
    StreamChatResult,
    NormalizedToolCall,
    NormalizedToolResult,
} from "./types";
import {toOpenAITools} from "./tools";

const RAW_STREAM_LOG_PATH = path.resolve(
    process.cwd(),
    "openai-raw-stream.log",
);

type ContentBlock =
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: unknown }
    | { type: string; [key: string]: unknown };

type NativeMessage = {
    role : "user" | "assistant";
    content: string | ContentBlock[];
};

const MAX_TOKENS = 16384;

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
export function client(override?: string | null): BaseChatModel {
    const apikey = override?.trim() || process.env.OPENAI_API_KEY || "";
    return new BaseChatModel({apiKey});
};

function toNativeMessages(
    messages: StreamChatParams["messages"],
): NativeMessage[] {
    return messages.map((m) => ({ role:m.role, content:m.content }) );
}


