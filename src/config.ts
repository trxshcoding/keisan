import rawconfig from "../config.json" with {type: "json"};
import {z} from 'zod';
import type {S3Client} from "@aws-sdk/client-s3";
const configT = z.object({
  token: z.string(),
  listenbrainzAccount: z.string(),
  gitapi: z.string(),
  sharkeyInstance:z.string(),
  R2AccountID: z.string(),
  R2AccessKeyId: z.string(),
  R2SecretAccessKey: z.string(),
});
export type RawConfig = z.infer<typeof configT>;
export type Config = RawConfig & {s3: S3Client}
export const config: RawConfig = configT.parse(rawconfig);


