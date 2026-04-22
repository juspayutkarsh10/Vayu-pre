import * as readline from "readline";
import { RequiresInput } from "../types";

/**
 * Prompts the user for a single input in the terminal.
 */
export function promptUser(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompts for multiple inputs based on config array.
 */
export async function promptMultipleInputs(
  inputs: RequiresInput[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const input of inputs) {
    result[input.field] = await promptUser(input.prompt);
  }
  return result;
}
