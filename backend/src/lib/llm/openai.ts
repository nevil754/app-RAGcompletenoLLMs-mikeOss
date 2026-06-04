import * as path from "path";
import * as fs from "fs";
import type {
    StreamChatParams,
    StreamChatResult,
    NormalizedToolCall,
    NormalizedToolResult,
} from "./types";
import {toOpenAITools} from "./tools";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import { get_llm } from "../../settings";

const MAX_ITER = 10;

function toLangChainMessages(messages: StreamChatParams["messages"]) : BaseMessage[] {
    return messages.map((m)=>{
        if (m.role === "user") return new HumanMessage(m.content);
        return new AIMessage(m.content);
    });
}

export async function streamOpenAI(params: StreamChatParams) : Promise<StreamChatResult> {
    const {
        messages: inputMessages,
        systemPrompt,
        tools = [],
        callbacks = {},
        runTools,
        maxIterations = MAX_ITER,
    } = params;

    const llmBase = await get_llm();
    const llm = new ChatOpenAI;
    const lcMessages = toLangChainMessages(inputMessages);
    let fullText = "";
    for (let i = 0; i<maxIterations; i++){
        


    }


};


//INVECE ORA  con langchain&langgraph è piu easy con best performances (e.g.streaming meno 'granulare')
//OLD, ispirato a clade.ts, ma il fatto è che con claude devi gestire: content=blocchi strutturati, tool_use esplicito, stream event-driven.
// const RAW_STREAM_LOG_PATH = path.resolve(
//     process.cwd(),
//     "openai-raw-stream.log",
// );
// type ContentBlock =
//     | { type: "text"; text: string }
//     | { type: "tool_use"; id: string; name: string; input: unknown }
//     | { type: string; [key: string]: unknown };
// type NativeMessage = {
//     role : "user" | "assistant";
//     content: string | ContentBlock[];
// };
// const MAX_TOKENS = 16384;
// export function client(override?: string | null): BaseChatModel {
//     const apikey = override?.trim() || process.env.OPENAI_API_KEY || "";
//     return new BaseChatModel({apiKey});
// };
// function toNativeMessages(
//     messages: StreamChatParams["messages"],
// ): NativeMessage[] {
//     return messages.map((m) => ({ role:m.role, content:m.content }) );
// }


