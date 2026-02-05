import { z } from "zod";
import { PrismaClient } from "./generated/prisma/index.js";
import { readFileSync } from "fs";
import { defu } from "defu";

const fileConfig = JSON.parse(readFileSync("config.json", { encoding: "utf-8" }));
const envOverlay: Record<string, any> = {};

for (const [k, v] of Object.entries(process.env)) {
  if (!k.startsWith("AMYJR_")) continue;
  const pathSegments = k.split("_");
  let cursor: Record<string, any> = envOverlay;
  for (const segment of pathSegments.slice(0, -1)) {
    cursor[segment] ??= {};
    cursor = cursor[segment];
  }
  cursor[pathSegments.at(-1)!] = v;
}

export const rawconfig = defu(envOverlay, fileConfig);

export const NO_EXTRA_CONFIG = z.object({});

const configT = z.object({
  token: z.string(),
  owner: z.string(),
  commandDefaults: z.object({
    nowplaying: z.object({
      lobotomized: z.coerce.boolean().default(true),
      useSonglink: z.coerce.boolean().default(true),
      useItunes: z.coerce.boolean().default(false),
      useLastFM: z.coerce.boolean().default(false),
    }),
    pat: z.object({
      speed: z.coerce.number().default(0),
    }),
    lastlistened: z.object({
      historyAmount: z.coerce.number().default(3),
    }),
  }),
});
type RawConfig = z.infer<typeof configT>;
export type Config = RawConfig & { prisma: PrismaClient };
// should this be replaced by just a dynamic load of the json file? maybe. this is cool tho.
export const config: Config = {
  ...configT.parse(rawconfig),
  prisma: new PrismaClient({
    datasourceUrl: "file:./amyjr.db",
  }),
};
