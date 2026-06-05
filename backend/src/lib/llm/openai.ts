import * as path from "path";   //x path building
import * as fs from "fs";   //x leggere read filesystem
import type {
    StreamChatParams,
    StreamChatResult,
    NormalizedToolCall,
    NormalizedToolResult,
} from "./types";
import {toOpenAITools} from "./tools";   //ur custom
import { ChatOpenAI } from "@langchain/openai";   //il client di langchain per openai
import { AIMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import { get_llm } from "../../settings";   //ur custom

const MAX_ITER = 10;

function toLangChainMessages(messages: StreamChatParams["messages"]) : BaseMessage[] {  //BaseMessage è il tipo di messaggio generico di langchain
    return messages.map((m)=>{
        if (m.role === "user") return new HumanMessage(m.content);
        return new AIMessage(m.content);
    });
}  //convert messages in mexs x langchain

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
    const lcMessages = toLangChainMessages(inputMessages);  //converted ok
    let fullText = "";
    for (let i = 0; i<maxIterations; i++){
        const res = await llm.invoke([
            ...(systemPrompt ? [{ role: "system", content: systemPrompt } as any] : []),  //se presente aggiunge e.g. { role: "system", content: "sei un'avvocato" }
            ...lcMessages,
        ]);
        const text = res.content?.toString?.() ?? "";
        fullText += text;
        callbacks.onContentDelta?.(text);  //onContentDelta funct interna a 'callback' che chiami
        const toolCalls: NormalizedToolCall[] = [];
        //LangChain tools arrivano in AIMessage.tool_calls (se configurati)
        const anyRes = res as any;
        if (anyRes.tool_calls?.length) {  //check se llm ha chiamato tools
        //tool_calls:[
        //  {
        //    id:"123",
        //    name:"search",
        //    args:{
        //       query:"RAG"
        //    }
        //  },
        //  {...},
        //]
            for (const t of anyRes.tool_calls) {
                toolCalls.push({  //aggiunge all' array, NORMALIZZANDO IL FORMAT
                    id: t.id,
                    name: t.name,
                    input: t.args ?? {},
                });
                callbacks.onToolCallStart?.(toolCalls.at(-1)!);  //prende l'ultimo dall'array, e dice a ts di fidarsi che è sicuramente presente
                    //questa è notifica ui
            }
        }
        if (!toolCalls.length || !runTools) break;
        const toolResults = await runTools(toolCalls);  //runni runTools
        //ora aggiorni la history
        lcMessages.push(
            new AIMessage({content: text,}) as any
        );
        lcMessages.push(
            new HumanMessage({
                content: toolResults.map((r) => ({  //dentro key 'content' metti come value 1 array con X items, 
                    //ogni items è :
                    //{
                    //  type: "tool_result",
                    //  tool_use_id: r.tool_use_id,
                    //  content: r.content,
                    //}
                    type: "tool_result",
                    tool_use_id: r.tool_use_id,
                    content: r.content,
                })),
            }) as any
        );
    }
    return {fullText};
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


