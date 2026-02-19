import { createHash } from "crypto";

export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const b: T[][] = [];
  array.forEach((element) =>
    b && b[b.length - 1] && b[b.length - 1].length < chunkSize
      ? b[b.length - 1].push(element)
      : b.push([element]),
  );
  return b;
}

export function trimWhitespace(input: string): string;
export function trimWhitespace(input: string[]): string[];

export function trimWhitespace(input: string | string[]) {
  return Array.isArray(input) ? input.map((s) => s.trim()) : input.trim();
}

export function escapeMarkdown(content: string) {
  return content.replace(/([#*_~`|])/g, "\\$1");
}

function getRandomArrayMember(arr: any[]) {
  if (arr.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * arr.length);

  return arr[randomIndex];
}

export function createRandomBullshit(length: number) {
  let bullshit = "";
  const bullshitChars = "qwertyuiopasdfghjklzxcvbnm1234567890".split("");
  for (let i = 0; i <= length; i++) {
    let temp = getRandomArrayMember(bullshitChars);
    if (Math.random() > 0.5) {
      bullshit += temp.toUpperCase();
    } else {
      bullshit += temp;
    }
  }
  return bullshit;
}

function xoshiro128ss(a: number, b: number, c: number, d: number) {
  return function () {
    let t = b << 9,
      r = b * 5;
    r = ((r << 7) | (r >>> 25)) * 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = (d << 11) | (d >>> 21);
    return (r >>> 0) / 4294967296;
  };
}

// keeping the name's legacy
export function numberFaggtory(str: string) {
  const hash = createHash("md5").update(str).digest();
  const seeds = [] as number[];
  for (let i = 0; i < 4; i++) {
    seeds.push(hash.readUInt32BE(i * 4));
  }

  return xoshiro128ss(seeds[0], seeds[1], seeds[2], seeds[3]);
}
