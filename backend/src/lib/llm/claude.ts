import Anthropic from "@anthropic-ai/sdk";   //client ufficiale antrophic
import type { Tool } from "@anthropic-ai/sdk/resources/messages/messages";  //tipo ts per descrivere i tools
import * as fs from "fs";  //x leggere read filesystem
import * as path from "path";  //x paths 
import type {
    StreamChatParams,
    StreamChatResult,
    NormalizedToolCall,
    NormalizedToolResult,
} from "./types";
import { toClaudeTools } from "./tools";  

const RAW_STREAM_LOG_PATH = path.resolve(  //resolve() x concatenare
    process.cwd(),  //path di partenza (da parte il comando nodejs)
    "claude-raw-stream.log",
);

type ContentBlock =   //viene usato in row 112, const assistantBlocks = final.content as ContentBlock[];  
     { type: "text"; text: string }  
    | { type: "tool_use"; id: string; name: string; input: unknown }
    | { type: string; [key: string]: unknown };
//e.g.
//{
//   type: "text",
//   text: "hello"
//}

type NativeMessage = {
    role: "user" | "assistant";
    content: string | ContentBlock[];  //testo o blocchi strutturati
};

const MAX_TOKENS = 16384;

function client(override?: string | null): Anthropic {
    const apiKey = override?.trim() || process.env.ANTHROPIC_API_KEY || "";
    return new Anthropic({ apiKey });
}  //crea un client di Anthropic usando la chiave API fornita o quella nelle variabili d'ambiente

function toNativeMessages(
    messages: StreamChatParams["messages"],  //estrai solo i mex in un array
): NativeMessage[] {
    return messages.map((m) => ({ 
        role: m.role, 
        content: m.content 
    }));
}  //convert messaggi interni in formato Anthropic

export async function streamClaude( params: StreamChatParams): Promise<StreamChatResult> {
    const {
        model,
        systemPrompt,
        tools = [],
        callbacks = {},
        //probabilmenete in callbacks ti viene passato qualcosa come 
        //callbacks?: {
        //   onContentDelta?: (text: string) => void;
        //   onReasoningDelta?: (text: string) => void;
        //   ...
        //}
        runTools,
        apiKeys,
        enableThinking,
    } = params;
    const maxIter = params.maxIterations ?? 10;  //di default è 10
    const anthropic = client(apiKeys?.claude);  //get
    const claudeTools = toClaudeTools(tools);  //converti tools in formato Anthropic
    const messages: NativeMessage[] = toNativeMessages(params.messages);  //converti messaggi in formato Anthropic
    let fullText = "";
    for (let iter=0; iter<maxIter; iter++) {  //!!PER EVITARE LOOP INFINITI, e.g. toolA -> toolB -> toolC -> toolB -> toolA -> toolC 
        //crei OBJ CHE EMETTE EVENTI NEL TEMPO 
        const stream = anthropic.messages.stream({  //stream() CHIAMA ANTROPHIC IN STREAMING MODE, PASSANDO QUESTI PARAMETRI
            model,
            system: systemPrompt,
            messages: messages as Anthropic.MessageParam[],
            tools: claudeTools.length
                ? 
                (claudeTools as unknown as Tool[])  //doppia conversione, xk ts non ti lascia direttamente fare claudeTools as Tool[]
                : undefined,
            max_tokens: MAX_TOKENS,
            //Claude 4.x models require `thinking.type: "adaptive"` and
            //drive effort via `output_config.effort` rather than a fixed
            //token budget. We only opt in when the caller requested it.
            ...(enableThinking   //se questo è true, allora attiva (settando sul client Antrophic) thinking & output_config ch
                ? ({
                      thinking: { type: "adaptive" },
                      output_config: { effort: "high" },
                  } as unknown as Record<string, unknown>)  //doppia conversione, xk ts non ti lascia direttamente fare questo oggetto come Record<string, unknown>
                : {}),
            // Extended thinking requires temperature to be default (omitted).
        });
        let sawThinking = false;  
        //stream è quello che hai creato tu here qua sopra, E' UN OBJ CHE EMETTE EVENTI NEL TEMPO
        stream.on("streamEvent", (event) => {   //quando in obj 'stream' arriva evento chiamato 'streamEvent' ALLORA ESEGUI QUESTO: this riceve ogni chunck raw dallo stream e lo salva su file log
            const line = JSON.stringify(event);
            console.log("[claude raw stream]", line);
            fs.appendFile(RAW_STREAM_LOG_PATH, line + "\n", () => {});  //salva log su file
        });
        stream.on("text", (delta) => {  //quando obj 'stream' cattura evento chiamato 'text' allora runna this
            callbacks.onContentDelta?.(delta);  //onContentDelta ur custom funct dentro callbacks
        });
        if(enableThinking) {
            stream.on("thinking", (delta) => {   //quando obj 'stream' cattura evento chiamato 'thinking' allora runna this
                sawThinking = true;   //flag a true, serve in row 102
                callbacks.onReasoningDelta?.(delta);  //onReasoningDelta ur custom funct dentro callbacks
            });
        }
        const final = await stream.finalMessage();   //aspetta risposta finale completa
        //   final = {
        //      stop_reason: "tool_use",
        //      content: [
        //          { type: "text", text: "Ciao!" },
        //          { type: "tool_use", id: "123", name: "search", input: {...} }
        //      ]
        //    }  //final.content è disponibile SOLO a fine streaming
        if (sawThinking) callbacks.onReasoningBlockEnd?.();  //onReasoningBlockEnd ur custom funct dentro callbacks
        const stopReason = final.stop_reason;  //perche Claude ha finito di rispondere? (e.g. ha finito i token, o ha deciso di smettere, o vuole usare uno strumento...)
        const assistantBlocks = final.content as ContentBlock[];  //🔥🔥 final.content è risposta finale strutturata del modello (testo + richieste di tool), non un log delle azioni recenti né una cronologia.
        // Extract text content and tool_use calls from the final assistant
        // message so we can accumulate text and drive the tool-call loop.
        const toolCalls: NormalizedToolCall[] = [];
        for(const block of assistantBlocks) {
            if(block.type === "text") {
                const txt = (block as { text: string }).text;  //get il text all'interno del block
                if (typeof txt === "string") fullText += txt;
            }   //se il blocco è di tipo 'text' allora aggiunge al fullText
            else if (block.type === "tool_use") {
                const tu = block as {
                    id: string;
                    name: string;
                    input: unknown;
                };
                const call: NormalizedToolCall = {
                    id: tu.id,
                    name: tu.name,
                    input: (tu.input as Record<string, unknown>) ?? {},
                };
                callbacks.onToolCallStart?.(call);  //onToolCallStart ur custom funct dentro callbacks
                toolCalls.push(call);   //aggiungilo alla lista
            }  //se il blocco è di tipo 'tool_use' allora lo aggiungo a lista toolCalls
        }
        if (stopReason !== "tool_use" || !toolCalls.length || !runTools) {
            break;
        }
        const results = await runTools(toolCalls);
        //come results è consigliato ottenere qualcosa come 
        //results = [
        //   {
        //     tool_use_id: "abc",
        //     content: "RAG è una tecnica..."
        //   }
        // ]
        //Record the assistant turn (preserving the original content blocks,
        //which Claude requires on the follow-up) and the user turn that
        //carries the tool_result blocks.
        messages.push({ role: "assistant", content: assistantBlocks });  //pushi nei mexs
        messages.push({
            role: "user",
            content: results.map((r) => ({
                type: "tool_result",
                tool_use_id: r.tool_use_id,
                content: r.content,
            })),
        });  //pushi nei mexs, quindi dici qualcosa come “User → ecco i risultati dei tool che mi hai chiesto”
    }
    return { fullText };
}

export async function completeClaudeText(params: {
    model: string;
    systemPrompt?: string;
    user: string;
    maxTokens?: number;
    apiKeys?: { claude?: string | null };
}): Promise<string> {
    const anthropic = client(params.apiKeys?.claude);
    const resp = await anthropic.messages.create({   //risposta UNICA (1 risposta) finale, a differente di .stream() che invece invia risposta pezzo per pezzo
        model: params.model,
        max_tokens: params.maxTokens ?? 512,
        system: params.systemPrompt,
        messages: [{ role: "user", content: params.user }],
    });
    const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")  //tieni solo blocchi di type 'text'
        .map((b) => b.text)
        .join("");
    return text;
}

// Helper re-export for callers wanting to hand normalized results back in.
export type { NormalizedToolResult };


