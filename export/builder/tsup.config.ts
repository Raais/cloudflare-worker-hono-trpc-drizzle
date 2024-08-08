import { defineConfig } from 'tsup';

const tsupConfig = defineConfig({
  entry: ['export/builder/index.ts'],
  outDir: 'export/dist',
  format: ['esm'],
  clean: true,
  dts: true,
  tsconfig: 'export/builder/tsconfig.tsup.json',
});

// eslint-disable-next-line
export default tsupConfig;