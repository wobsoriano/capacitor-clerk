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
    plugins: [
      typescript({
        tsconfig: 'tsconfig.json',
        useTsconfigDeclarationDir: false,
        clean: true,
        include: ['src/**/*.ts', 'src/**/*.tsx'],
      }),
    ],
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
    plugins: [typescript({ tsconfig: 'tsconfig.json', include: ['src/**/*.ts', 'src/**/*.tsx'] })],
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
    plugins: [typescript({ tsconfig: 'tsconfig.json', include: ['src/**/*.ts', 'src/**/*.tsx'] })],
  },
];
