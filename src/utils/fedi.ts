import { httpJson } from "../lib/http.ts";

export async function getSharkeyEmojis(config: { sharkeyInstance: string }) {
  const base = config.sharkeyInstance.startsWith("http")
    ? config.sharkeyInstance
    : `https://${config.sharkeyInstance}`;
  const emojis = await httpJson<{ emojis: Array<{ name: string; url: string }> }>(
    new URL("/api/emojis", base).toString(),
  );
  const typedEmojis: Array<{ name: string; url: string }> = emojis.emojis;
  return typedEmojis;
}
