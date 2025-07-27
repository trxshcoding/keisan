import rawconfig from "../config.json" with {type: "json"};
import { z } from 'zod';
import { PrismaClient } from "./generated/prisma/index.js";
const configT = z.object({
  token: z.string(),
  listenbrainzAccount: z.string(),
  gitapi: z.string(),
  sharkeyInstance: z.string(),
  radioURL: z.string(),
  radioName: z.string()
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


