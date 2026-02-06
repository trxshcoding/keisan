import { S3Client } from "@aws-sdk/client-s3";
import { config, type Config } from "../config.ts";
import { http, type HttpClient } from "../lib/http.ts";

export type AppContext = {
  config: Config;
  http: HttpClient;
  s3: S3Client | null;
};

export const appContext: AppContext = {
  config,
  http,
  s3: null,
};
