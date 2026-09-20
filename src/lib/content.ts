import fs from "node:fs";
import path from "node:path";
import { validateEntry, type Entry } from "./validation";
export { default as site } from "../../content/site.json";
export { default as taxonomy } from "../../content/taxonomy.json";
export function readEntries(): Entry[] {
  const dir = path.resolve("content/entries");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const value = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      validateEntry(value);
      if (f !== `${value.id}.json`) throw new Error(`文件名与 id 不一致: ${f}`);
      return value;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export const entries = readEntries();
export const published = entries.filter((e) => e.status === "published");
