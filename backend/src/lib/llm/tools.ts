import type { OpenAIToolSchema } from "./types";

// Tool-schema adapters
// Callers hand us OpenAI-style tool definitions! here convert into provide style of Gemini and Claude

//Schema normalization
//The OpenAI tool schemas in the codebase already use plain JSON-Schema-lite shape. 
//Both Claude and Gemini accept that shape. We only sanitise a couple
//of edge cases: `integer` is accepted by both, but we make sure arrays have
//`items` and objects have `properties` so Gemini doesn't error.
function normalizeSchema(schema: unknown): Record<string, unknown> {
    if (!schema || typeof schema !== "object") {
        return { type: "object", properties: {} };
    }
    const s = schema as Record<string, unknown>;
    const type = s.type;
    const out: Record<string, unknown> = { ...s };   //={...s} è l'operatore di spread, copia tutte le proprietà di s in out
    if(type === "object") {
        const props = (s.properties as Record<string, unknown>) ?? {};
        const normProps: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(props)) {  //itera per key-value di props
            normProps[k] = normalizeSchema(v);
        }
        out.properties = normProps;
    }
    if (type === "array" && s.items) {
        out.items = normalizeSchema(s.items);
    }
    return out;
}

//--openai, io uso openai!
export type OpenAITool = {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
}

export function toOpenAITools(tools: OpenAIToolSchema[]): OpenAITool[] {
    return tools.map((t) => ({
        name: t.function.name, 
        description: t.function.description,
        parameters: normalizeSchema(t.function.parameters),
    }))
}


//--claude
export type ClaudeTool = {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;  //la key deve essere str, mentre il value è unknwon
};

export function toClaudeTools(tools: OpenAIToolSchema[]): ClaudeTool[] {   //prende in input un'array di type OpenAIToolSchema
    return tools.map((t) => ({  //per ciascun elemento dell'array...
        name: t.function.name,
        description: t.function.description,
        input_schema: normalizeSchema(t.function.parameters),  //🔥🔥NORMALIZZA SCHEMA PRIMA DI INVIARLO
    }));
}  //converte gli strumenti in formato OpenAI in strumenti in formato Claude, normalizzando lo schema dei parametri per evitare errori di Gemini!

//--gemini
export type GeminiFunctionDeclaration = {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;  //la key deve essere str, mentre il value è unknwon
};

export function toGeminiTools(tools: OpenAIToolSchema[]): GeminiFunctionDeclaration[] {
    return tools.map((t) => {
        const params = normalizeSchema(t.function.parameters);  //🔥🔥NORMALIZZA SCHEMA PRIMA DI INVIARLO
        //remmeber Gemini rejects `{ type: "object", properties: {} }` with no fields
        //present; omit the parameters key entirely when empty!
        const hasProps =
            params &&
            typeof params === "object" &&
            Object.keys((params as { properties?: Record<string, unknown> }).properties ?? {}).length > 0;
            //se params è un oggetto e ha una proprietà "properties" che è un oggetto con almeno una chiave, allora hasProps è true; altrimenti è false
        return {
            name: t.function.name,
            description: t.function.description,
            ...(hasProps ? { parameters: params } : {}),  
            //... è l'operatore di spread, che permette di includere le proprietà di un oggetto in un altro oggetto
            //se hasProps è true, allora include parameters:params nell'oggetto restituito; altrimenti sara {}
        };
    });
}

