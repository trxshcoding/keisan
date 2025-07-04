import rawconfig from "../config.json" with {type: "json"};
import {z} from 'zod';
const configT = z.object({
  token: z.string(),
  listenbrainzAccount: z.string(),
  gitapi: z.string(),
  sharkeyInstance:z.string(),
  radioURL: z.string(),
  radioName: z.string()
});
export type Config = z.infer<typeof configT>;
export const config: Config = configT.parse(rawconfig);


