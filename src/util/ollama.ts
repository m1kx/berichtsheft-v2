import { config } from "./config.ts";
import ollama from "npm:ollama";
import OpenAI from "jsr:@openai/openai";

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

const getPrompt = (description: string): string => {
  return config.ai_prompt.replace("{DESCRIPTION}", description);
};

export const ticketDescriptionToActivity = async (
  description: string,
): Promise<string> => {
  if (description === "") {
    return "";
  }
  const prompt = getPrompt(description).replace(/(\r\n|\n|\r)/gm, "")
    .replaceAll('"', "");

  if (config.ai_method === "ollama") {
    console.log("🤖 Using openai llama3.2 to generate description...");
    const response = await ollama.generate({
      model: "llama3.2",
      prompt,
    });
    return response.response;
  } else if (config.ai_method === "gpt") {
    console.log("🤖 Using openai gpt-4o-mini to generate description...");
    const client = new OpenAI({
      apiKey: config.openai_key,
    });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices[0].message.content ?? "no data";
  }

  throw new Error("Please provide 'ai_method' in config");
};
