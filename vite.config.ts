import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: {
      index: 'src/index.ts',
      'react/index': 'src/react/index.ts',
      'native/index': 'src/native/index.ts',
      'apple/index': 'src/apple/index.ts',
      'token-cache/index': 'src/token-cache/index.ts',
    },
    format: ['esm'],
    outDir: 'dist/esm',
    sourcemap: true,
    dts: true,
    clean: true,
    deps: {
      neverBundle: [
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
      ],
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
  staged: {
    '*': 'vp check --fix',
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  fmt: {
    singleQuote: true,
    ignorePatterns: ['example-app'],
  },
});
