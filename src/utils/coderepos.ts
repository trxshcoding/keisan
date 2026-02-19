import type { Results } from "linguist-js/dist/types";
import { createCanvas } from "@napi-rs/canvas";
import { httpBuffer, httpJson } from "../lib/http.ts";

export function getTop3Languages(result: Results) {
  let maxBytes = 0;
  Object.keys(result.languages.results).forEach((language) => {
    maxBytes += result.languages.results[language].bytes;
  });
  const newArray = Object.entries(result.languages.results)
    .map(([k, v]) => ({
      ...v,
      language: k,
      percentage: Number(((v.bytes / maxBytes) * 100).toFixed(2)),
    }))
    .filter((lang) => lang.type === "programming");
  newArray.sort((a, b) => b.bytes - a.bytes);
  newArray.length = 3;
  return newArray;
}

export function imageBullshittery(username: string) {
  const p = 2;
  const canvas = createCanvas(p * 7, p * 7);
  const context = canvas.getContext("2d");

  const xorshift32 = (n: number) => {
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    return n;
  };

  const seedSteps = 28;

  let seed = 1;
  for (let i = seedSteps + username.length - 1; i >= seedSteps; i--) {
    seed = xorshift32(seed);
    seed += username.charCodeAt(i - seedSteps);
  }

  context.fillStyle = "#" + ((seed >> 8) & 0xffffff).toString(16).padStart(0, "6");

  for (let i = seedSteps - 1; i > 0; i--) {
    // continue the seed
    seed = xorshift32(seed);

    const X = i & 3;
    const Y = i >> 2;

    if (seed >>> (seedSteps + 1) > (X * X) / 3 + Y / 2) {
      context.fillRect(p * 3 + p * X, p * Y, p, p);
      context.fillRect(p * 3 - p * X, p * Y, p, p);
    }
  }
  return canvas.toBuffer("image/png");
}

export async function getGithubAvatar(name: string, email: string) {
  let username = "";
  const isGithubEmail = email.match(/^(?:\d+\+)(.+?)@users\.noreply\.github\.com$/);
  if (isGithubEmail) username = isGithubEmail[1];
  else {
    const res = await httpJson<{ items?: Array<{ login: string }> }>(
      `https://api.github.com/search/users?q=${encodeURIComponent(name)}`,
    );
    if (res?.items?.[0]) username = res.items[0].login;
    // note: there is a "score" property on the user which im assuming is related to how good of a match it is
    // but i've also never seen it not be 1
  }
  if (username) return await httpBuffer(`https://github.com/${username}.png`);
  else return imageBullshittery(name);
}
