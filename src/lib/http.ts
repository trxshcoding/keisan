import { ofetch } from "ofetch";

/**
 * Shared HTTP client.
 * Centralizes timeouts, retries and default headers for all outbound calls.
 */
export const http = ofetch.create({
  timeout: 10_000,
  retry: 2,
  headers: {
    "User-Agent": "keisan/1.0 (+https://codeberg.org/amyulated/amyjr)",
  },
});

export type HttpClient = typeof http;

export const httpJson = async <T = any>(url: string, init?: any) =>
  http<T>(url, { ...init, responseType: "json" } as any);

export const httpBuffer = async (url: string, init?: any) =>
  Buffer.from(await http<ArrayBuffer>(url, { ...init, responseType: "arrayBuffer" } as any));

export const httpText = async (url: string, init?: any) =>
  http<string>(url, { ...init, responseType: "text" } as any);
