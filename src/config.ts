import rawconfig from "../config.json" with {type: "json"};
import { z } from 'zod';
import { PrismaClient } from "./generated/prisma/index.js";

const configFallback = {
  commandDefaults: {
    nowplaying: {
      lobotomized: false,
      useSonglink: false,
      useItunes: false,
      useLastFM: false,
    },
    pat: {
      speed: 0,
    },
    lastlistened: {
      historyAmount: 0,
    },
  },
};


const configT = z.object({
  token: z.string(),
  listenbrainzAccount: z.string().optional(),
  lastFMApiKey: z.string().optional(),
  gitapi: z.string().optional(),
  sharkeyInstance: z.string().optional(),
  radioURL: z.string().optional(),
  radioName: z.string().optional(),
  owner: z.string(),
  commandDefaults: z.object({
    nowplaying: z.object({
      lobotomized: z.boolean().default(configFallback.commandDefaults.nowplaying.lobotomized),
      useSonglink: z.boolean().default(configFallback.commandDefaults.nowplaying.useSonglink),
      useItunes: z.boolean().default(configFallback.commandDefaults.nowplaying.useItunes),
      useLastFM: z.boolean().default(configFallback.commandDefaults.nowplaying.useLastFM)
    }),
    pat: z.object({
      speed: z.number().default(configFallback.commandDefaults.pat.speed),
    }),
    lastlistened: z.object({
      historyAmount: z.number().default(configFallback.commandDefaults.lastlistened.historyAmount),
    })
  })
});
type RawConfig = z.infer<typeof configT>;
export type Config = RawConfig & { prisma: PrismaClient };
// should this be replaced by just a dynamic load of the json file? maybe. this is cool tho.
rawconfig satisfies RawConfig;
export const config: Config = {
  ...configT.parse(rawconfig),
  prisma: new PrismaClient({
    datasourceUrl: 'file:./amyjr.db',
  })
};


