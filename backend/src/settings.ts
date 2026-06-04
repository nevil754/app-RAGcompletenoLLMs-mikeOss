import fs from "fs";
import yaml from "js-yaml";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai"; 

export type AppConfig = {
    llm: {
        provider: "openai";
        model: {
            main: string;
            mid: string;
            low: string;
        };
        default: "main" | "mid" | "low";
    };
};

export function loadConfig(): AppConfig {
    const file = fs.readFileSync("config.yaml", "utf8");
    return yaml.load(file) as AppConfig;
}
//accedi tramite e.g. const config = loadConfig(); const midModel = config.llm.models.mid;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    console.warn("Warning: OPENAI_API_KEY is not set in environment variables.");
}

export async function get_llm() : Promise<BaseChatModel> {
    const config = loadConfig();
    const model = config.llm.model.main;
    return new ChatOpenAI({
        model,
        apiKey: OPENAI_API_KEY!,
        temperature: 0,
    });
}

export function getMainModel(): string {
    return loadConfig().llm.model.main;
}

export function getMidModel(): string {
    return loadConfig().llm.model.mid;
}

export function getLowModel(): string {
    return loadConfig().llm.model.low;
}