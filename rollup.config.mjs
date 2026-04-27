import typescript from 'rollup-plugin-typescript2';

const external = [
  '@aparajita/capacitor-secure-storage',
  '@capacitor/app',
  '@capacitor/browser',
  '@capacitor/core',
  '@clerk/clerk-js',
  '@clerk/react',
  '@clerk/react/internal',
  '@clerk/react/legacy',
  '@clerk/shared',
  'react',
  'react-dom',
  'react/jsx-runtime',
];

// Declarations are emitted by `tsc` (run before rollup). rollup-plugin-typescript2
// would otherwise re-emit .d.ts files into a parallel tree and clobber tsc's
// correctly-resolved declarations. Turn off declaration emission here.
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

const entry = (input, file) => ({
  input,
  external,
  output: {
    file,
    format: 'esm',
    sourcemap: true,
  },
  plugins: [typescript(tsPluginOptions)],
});

export default [
  entry('src/index.ts', 'dist/esm/index.js'),
  entry('src/react/index.ts', 'dist/esm/react/index.js'),
  entry('src/token-cache/index.ts', 'dist/esm/token-cache/index.js'),
];
