import { parseArgs } from "util";

const path = "./export/builder/switch.ts";

const { values, positionals } = parseArgs({
    args: Bun.argv,
    options: {
      true: {
        type: 'boolean',
      },
    },
    strict: false,
    allowPositionals: true,
});

Bun.write(path, `export type building = ${values.true ? 'true' : 'false'};`);

if (!values.true) {
  const dts = await Bun.file("./export/dist/index.d.mts").text();
  const mjs = await Bun.file("./export/dist/index.mjs").text();

  const write = `
  export const dts = \`${btoa(dts)}\`;
  export const mjs = \`${btoa(mjs)}\`;
  `;

  Bun.write("./export/dist/strings.ts", write);
}

console.clear();