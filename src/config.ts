import { z } from 'zod';
import { PrismaClient } from "./generated/prisma/index.js";
import { readFileSync } from 'fs';

export const rawconfig = JSON.parse(readFileSync("config.json", { encoding: 'utf-8' }))
for (const [k, v] of Object.entries(process.env)) {
  if (!k.startsWith("AMYJR_"))
    continue
  function assertIsObj(t: any) {
    if (typeof t !== 'object')
      throw new Error("Could not merge environment variable " + k + " into " + JSON.stringify(rawconfig));

  }
  let p = rawconfig
  const path = k.split("_")
  for (const pathSegment of path.slice(0, -1)) {
    assertIsObj(p)
    p[pathSegment] = p[pathSegment] || {}
    assertIsObj(p = p[pathSegment])
  }
  p[path[path.length - 1]] = v;
}

export const NO_EXTRA_CONFIG = z.object({})

const configT = z.object({
  token: z.string(),
  owner: z.string(),
  commandDefaults: z.object({
    nowplaying: z.object({
      lobotomized: z.coerce.boolean().default(true),
      useSonglink: z.coerce.boolean().default(true),
      useItunes: z.coerce.boolean().default(false),
      useLastFM: z.coerce.boolean().default(false)
    }),
    pat: z.object({
      speed: z.coerce.number().default(0),
    }),
    lastlistened: z.object({
      historyAmount: z.coerce.number().default(3),
    })
  })
});
type RawConfig = z.infer<typeof configT>;
export type Config = RawConfig & { prisma: PrismaClient };
// should this be replaced by just a dynamic load of the json file? maybe. this is cool tho.
export const config: Config = {
  ...configT.parse(rawconfig),
  prisma: new PrismaClient({
    datasourceUrl: 'file:./amyjr.db',
  })
};


