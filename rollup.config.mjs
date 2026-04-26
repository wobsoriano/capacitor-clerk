import typescript from 'rollup-plugin-typescript2';

const external = [
  '@capacitor/core',
  '@clerk/clerk-js',
  '@clerk/react',
  '@clerk/react/internal',
  '@clerk/shared',
  'react',
  'react-dom',
  'react/jsx-runtime',
];

const baseConfig = {
  external,
};

// Declarations are emitted by `tsc` (run before rollup). rollup-plugin-typescript2
// would otherwise re-emit .d.ts files into a parallel tree (dist/react/, etc.) and
// clobber tsc's correctly-resolved declarations under dist/esm/. We turn off
// declaration emission here to keep the two passes isolated.
const tsPluginOptions = {
  tsconfig: 'tsconfig.json',
  include: ['src/**/*.ts', 'src/**/*.tsx'],
  tsconfigOverride: {
    compilerOptions: {
      declaration: false,
      declarationMap: false,
    },
  },
};

export default [
  // Main entry
  {
    ...baseConfig,
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/plugin.js',
        format: 'iife',
        name: 'capacitorClerkPlugin',
        globals: { '@capacitor/core': 'capacitorExports' },
        sourcemap: true,
        inlineDynamicImports: true,
      },
      {
        file: 'dist/plugin.cjs.js',
        format: 'cjs',
        sourcemap: true,
        inlineDynamicImports: true,
      },
    ],
    plugins: [typescript({ ...tsPluginOptions, clean: true })],
  },
  // React subpath
  {
    ...baseConfig,
    input: 'src/react/index.ts',
    output: {
      file: 'dist/esm/react/index.js',
      format: 'esm',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [typescript(tsPluginOptions)],
  },
  // Token cache subpath
  {
    ...baseConfig,
    input: 'src/token-cache/index.ts',
    output: {
      file: 'dist/esm/token-cache/index.js',
      format: 'esm',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [typescript(tsPluginOptions)],
  },
];
