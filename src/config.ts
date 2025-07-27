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
// should this be replaced by just a dynamic load of the json file? maybe. this is cool tho.
rawconfig satisfies Config;
export const config: Config = configT.parse(rawconfig);


