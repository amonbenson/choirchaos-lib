import { readFile, writeFile } from "fs/promises";
import { parseMidi } from "midi-file";

const [midiPath, outputPath] = process.argv.slice(2);

if (!midiPath || !outputPath) {
  console.error("Usage: tsx scripts/midiToJson.ts <midi-file> <output-file>");
  process.exit(1);
}

const midi = parseMidi(await readFile(midiPath));
await writeFile(outputPath, JSON.stringify(midi, undefined, 2));
console.log(`Written to ${outputPath}`);
