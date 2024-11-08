// deno-lint-ignore-file
// deno-lint-ignore no-explicit-any

import type { Config } from "../types/config.ts";

export let config: Config;

export const loadConfig = async () => {
  try {
    const text = await Deno.readTextFile("config.json");
    const json: Config = JSON.parse(text);
    config = json;
    return config;
  } catch (_error) {
    return null;
  }
};

const defaultValues: Partial<Config> = {
  ai_method: "gpt",
  ai_prompt:
    "Schreibe maximal zwei simple Stichpunkte anhand der folgenden Ticket Beschreibung. Die Stichpunkte sollen beinhalten, was in dem Ticket zu tun war. Schreibe in der vergangenheit, aus sicht eines azubis, der das Ticket bearbeitet hat. Lasse füllwörter wie 'Ich habe' und 'habe ich' weg. Beutze keinen Punkt am ende des Stickpunktes. Gebe mir nur die Zwei Stichpunkte im Format '- <1.Stichpunkt>\\n- <2.Stichpunkt>', sonst nichts. Ticket Beschreibung:\n{DESCRIPTION}",
  jira_base_url: "https://c24-fewo.atlassian.net",
};

const promptForConfig = async <T>(
  schema: Record<keyof T, { type: string; isArray?: boolean }>,
  defaults: Partial<T>,
): Promise<T> => {
  const config = {} as T;
  // @ts-ignore
  for (const [key, { type, isArray = false }] of Object.entries(schema)) {
    let userInput: string | null;
    const defaultValue = defaults[key as keyof T];

    do {
      userInput = prompt(
        `Enter value for ${key} ${isArray ? " array (comma-separated)" : ""}${
          JSON.stringify(defaultValue)
            ? `[default: ${JSON.stringify(defaultValue)}]`
            : ""
        }: `,
      );

      // If input is empty, use the default value
      if (userInput === null || userInput.trim() === "") {
        (config as any)[key] = defaultValue;
      } else {
        // Parse input based on type and whether it's an array
        if (isArray) {
          const items = userInput.split(",").map((item) => item.trim());
          if (type === "number") (config as any)[key] = items.map(Number);
          else if (type === "boolean") {
            (config as any)[key] = items.map((item) =>
              item.toLowerCase() === "yes"
            );
          } else (config as any)[key] = items;
        } else {
          if (type === "number") (config as any)[key] = Number(userInput);
          else if (type === "boolean") {
            (config as any)[key] = userInput.toLowerCase() === "yes";
          } else (config as any)[key] = userInput;
        }
      }

      // Validate array entries if necessary
    } while (
      userInput === "" &&
        defaultValue === undefined ||
      (type === "number" && isArray && (config as any)[key].some(isNaN)) ||
      (type === "number" && !isArray && isNaN((config as any)[key]))
    );
  }

  return config;
};

export const writeConfig = async () => {
  const output = await processConfigInterface("src/types/config.ts");

  const promtResponse = await promptForConfig(
    JSON.parse(output),
    defaultValues,
  );

  await Deno.writeTextFile(
    "config.json",
    JSON.stringify(promtResponse, null, 2),
  );
};

async function processConfigInterface(filePath: string): Promise<string> {
  try {
    const fileContent = await Deno.readTextFile(filePath);

    // Extract content between interface declaration
    const interfaceMatch = fileContent.match(
      /export interface Config {([^}]+)}/s,
    );
    if (!interfaceMatch) {
      throw new Error("Config interface not found in file");
    }

    let lines = interfaceMatch[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Process each line
    lines = lines.map((line) => {
      // Remove trailing semicolons and question marks
      line = line.replace(/[;?]/g, "");

      // Add quotes around property names
      line = line.replace(/([a-zA-Z_][a-zA-Z0-9_]*):/, '"$1":');

      // Convert (string)[] notation to type object
      line = line.replace(
        /: \(string\)\[\]/,
        ': { "type": "string", "isArray": true }',
      );

      // Convert string[] notation to type object
      line = line.replace(
        /: string\[\]/,
        ': { "type": "string", "isArray": true }',
      );

      // Add quotes around simple string type declarations
      line = line.replace(/: string/, ': ""');

      // Remove type declarations for null unions
      line = line.replace(/ \| null/, "");

      return line;
    });

    // Build the final JSON structure
    if (lines.length > 0) {
      // Add comma to all lines except the last one
      lines = lines.map((line, index) => {
        if (index < lines.length - 1 && !line.endsWith(",")) {
          return line + ",";
        }
        return line;
      });

      // Remove comma from last line if it exists
      lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, "");
    }

    // Combine everything into valid JSON
    const jsonString = `{\n  ${lines.join("\n  ")}\n}`;

    return jsonString;
  } catch (error) {
    console.error("Error processing file:", error);
    throw error;
  }
}
