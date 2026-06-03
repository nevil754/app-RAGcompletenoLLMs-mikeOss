import fs from "fs";
import yaml from "js-yaml";

export type AppConfig = any;
export function loadConfig(): AppConfig {
    const file = fs.readFileSync("config.yaml", "utf8");
    return yaml.load(file);
}
//accedi tramite e.g. const config = loadConfig(); const midModel = config.llm.models.mid;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    console.warn("Warning: OPENAI_API_KEY is not set in environment variables.");
}

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
export async function get_llm() : Promise<BaseChatModel> {
    const config = loadConfig();
    const provider = config.llm.provider;
    const model = config.llm.model.main;
    if (provider === "openai"){
        //import {ChatOpenAI} from "@langchain/openai";
        const importedModule = await import ("@langchain/openai");
        const {ChatOpenAI} = importedModule;
        return new ChatOpenAI({
            model: model,
            apiKey: OPENAI_API_KEY,
            temperature: 0,
        });
    }
    else throw new Error(`Unknown LLM provider: ${provider}`);
}