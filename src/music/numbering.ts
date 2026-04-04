import { type Branded } from "@/utils/brand";

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

export function parseNumbering<T extends Numbering>(value: T): [number, string, number] {
  const numbering = asNumbering(value);
  const match = numbering.match(NUMBERING_REGEX) as RegExpMatchArray;

  // Group 1: number, group 2: letter, group 3: /, group 4: iterations
  const num = parseInt(match[1] ?? "0", 10);
  const letter = match[2] ?? "";
  const iter = parseInt(match[4] ?? "0", 10);

  return [num, letter, iter];
}

export function nextSequentialNumbering<T extends Numbering>(value: T): T {
  const num = parseNumbering(value)[0];
  return String(num + 1) as T;
}

export function previousSequentialNumbering<T extends Numbering>(value: T): T {
  const num = parseNumbering(value)[0];
  return String(num - 1) as T;
}

export function compareNumberings<T extends Numbering>(a: T, b: T): number {
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
