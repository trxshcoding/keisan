import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "pathe";

const rootDir = resolve(dirname(fileURLToPath(new URL("../", import.meta.url))));
const publicDir = join(rootDir, "public");
const srcDir = join(rootDir, "src");

export const paths = {
  rootDir,
  publicDir,
  srcDir,
};

export const fromRoot = (...segments: string[]) => join(rootDir, ...segments);
export const fromPublic = (...segments: string[]) => join(publicDir, ...segments);
