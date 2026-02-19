import { type CanvasRenderingContext2D } from "@napi-rs/canvas";

export function calculateTextHeight(text: string, ctx: CanvasRenderingContext2D): number {
  const size = ctx.measureText(text);
  return size.actualBoundingBoxAscent + size.actualBoundingBoxDescent;
}

export function wrapText(
  text: string,
  maxWidth: number,
  ctx: CanvasRenderingContext2D,
  maxLines?: 1,
): string;
export function wrapText(
  text: string,
  maxWidth: number,
  ctx: CanvasRenderingContext2D,
  maxLines: number,
): string[];
export function wrapText(
  text: string,
  maxWidth: number,
  ctx: CanvasRenderingContext2D,
  maxLines = 1,
): string | string[] {
  const ellipsisWidth = ctx.measureText("...").width;

  if (maxLines === 1) {
    let width = ctx.measureText(text).width;
    if (width <= maxWidth) {
      return text;
    }
    let truncatedText = text;
    let i = text.length;
    while (width >= maxWidth - ellipsisWidth && i > 0) {
      truncatedText = text.substring(0, i);
      width = ctx.measureText(truncatedText).width;
      i--;
    }
    return truncatedText + "...";
  }

  const lines: string[] = [];
  let remainingText = text;
  const minLineWidth = maxWidth * 0.5;

  for (let lineNum = 0; lineNum < maxLines && remainingText.length > 0; lineNum++) {
    const remainingWidth = ctx.measureText(remainingText).width;
    if (remainingWidth <= maxWidth) {
      lines.push(remainingText);
      remainingText = "";
      break;
    }

    const avgCharWidth = remainingWidth / remainingText.length;
    let guessIndex = Math.max(
      1,
      Math.min(Math.floor(maxWidth / avgCharWidth), remainingText.length),
    );

    let charBoundary = guessIndex;
    let charBoundaryText = remainingText.substring(0, charBoundary);
    let charBoundaryWidth = ctx.measureText(charBoundaryText).width;

    while (charBoundaryWidth > maxWidth && charBoundary > 1) {
      charBoundary--;
      charBoundaryText = remainingText.substring(0, charBoundary);
      charBoundaryWidth = ctx.measureText(charBoundaryText).width;
    }
    while (charBoundary < remainingText.length) {
      const nextText = remainingText.substring(0, charBoundary + 1);
      const nextWidth = ctx.measureText(nextText).width;
      if (nextWidth <= maxWidth) {
        charBoundary++;
        charBoundaryText = nextText;
        charBoundaryWidth = nextWidth;
      } else {
        break;
      }
    }

    let wordBoundary = charBoundary;
    while (wordBoundary > 0) {
      const char = remainingText[wordBoundary];
      const prevChar = wordBoundary > 0 ? remainingText[wordBoundary - 1] : "";

      if (char === " " || prevChar === " ") {
        const wordBoundaryText = remainingText.substring(0, wordBoundary).trimEnd();
        if (ctx.measureText(wordBoundaryText).width >= minLineWidth) {
          charBoundary = wordBoundary;
          charBoundaryText = wordBoundaryText;
          break;
        }
      }
      wordBoundary--;
    }

    let lineText = charBoundaryText.trimEnd();
    if (lineNum === maxLines - 1 && charBoundary < remainingText.length) {
      while (ctx.measureText(lineText + "...").width > maxWidth && lineText.length > 0) {
        lineText = lineText.substring(0, lineText.length - 1).trimEnd();
      }
      lines.push(lineText + "...");
      break;
    } else {
      lines.push(lineText);
    }

    remainingText = remainingText.substring(charBoundary).trimStart();
  }

  return lines;
}
