import { Branded } from "@/utils/brand";

const NUMBERING_REGEX = /^(\d+)?([a-zA-Z])?(-(\d+))?$/;

export type Numbering = Branded<string, "Numbering">;

export function isNumbering(value: unknown): value is Numbering {
  return typeof value === "string" && !!value && NUMBERING_REGEX.test(value);
}

export function asNumbering(value: unknown): Numbering {
  if (!isNumbering(value)) {
    throw new TypeError(`Expected a valid numbering string, got: ${value}`);
  }

  return value as Numbering;
}

export function parseNumbering(value: Numbering): [number, string, number] {
  value = asNumbering(value);
  const match = value.match(NUMBERING_REGEX) as RegExpMatchArray;

  // group 1: number, group 2: letter, group 3: /, group 4: iterations
  const num = parseInt(match[1] ?? "0", 10);
  const letter = match[2] ?? "";
  const iter = parseInt(match[4] ?? "0", 10);

  return [num, letter, iter];
}

export function nextSequentialNumbering(value: Numbering): Numbering {
  const num = parseNumbering(value)[0];
  return String(num + 1) as Numbering;
}

export function previousSequentialNumbering(value: Numbering): Numbering {
  const num = parseNumbering(value)[0];
  return String(num - 1) as Numbering;
}

export function compareNumberings(a: Numbering, b: Numbering): number {
  const [numA, letterA, iterA] = parseNumbering(a);
  const [numB, letterB, iterB] = parseNumbering(b);

  // Compare the numeric parts
  if (numA !== numB) {
    return numA - numB;
  }

  // If numeric parts are equal, compare iterations
  if (iterA !== iterB) {
    return iterA - iterB;
  }

  // If iterations are equal, compare the letter parts
  return letterA.localeCompare(letterB);
}
