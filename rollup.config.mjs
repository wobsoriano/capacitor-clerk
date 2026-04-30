import typescript from 'rollup-plugin-typescript2';

const external = [
  '@aparajita/capacitor-secure-storage',
  '@capawesome/capacitor-apple-sign-in',
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

export default {
  input: {
    'index':             'src/index.ts',
    'react/index':       'src/react/index.ts',
    'native/index':      'src/native/index.ts',
    'apple/index':       'src/apple/index.ts',
    'token-cache/index': 'src/token-cache/index.ts',
  },
  external,
  output: {
    dir: 'dist/esm',
    format: 'esm',
    sourcemap: true,
    chunkFileNames: '_shared/[name].js',
  },
  plugins: [typescript(tsPluginOptions)],
};
