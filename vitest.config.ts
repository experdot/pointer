import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { workerFactorySource } from './scripts/worker-build.mjs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'test-node-workers',
      // Node 22 的 prefix-only 内建模块不在 builtinModules 中，jsdom 依赖分析需显式保留。
      enforce: 'pre',
      resolveId(id) {
        if (id === 'node:sqlite') return { id, external: true }
        return null
      },
      async load(id) {
        if (id.endsWith('?nodeWorker'))
          return workerFactorySource(id.slice(0, -'?nodeWorker'.length))
        return null
      }
    }
  ],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    environment: 'node',
    maxWorkers: 4,
    projects: [
      {
        test: {
          name: 'unit',
          include: [
            'src/shared/**/*.test.ts',
            'src/preload/**/*.test.ts',
            'src/main/ipc/**/*.test.ts',
            'src/main/*.test.ts'
          ]
        }
      },
      { test: { name: 'kernel', include: ['src/main/runtime/**/*.test.ts'] } },
      { test: { name: 'renderer', include: ['src/renderer/**/*.test.ts'] } },
      {
        test: {
          name: 'renderer-dom',
          testTimeout: 15000,
          include: ['src/renderer/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['tests/helpers/dom.ts']
        }
      },
      {
        test: {
          name: 'stress',
          include: ['tests/stress/**/*.test.ts'],
          testTimeout: 30000,
          hookTimeout: 30000
        }
      }
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'html', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        statements: 50,
        branches: 43,
        functions: 43,
        lines: 50,
        'src/shared/domain/**': { statements: 90, branches: 78, functions: 94, lines: 93 },
        'src/main/runtime/**': { statements: 82, branches: 69, functions: 85, lines: 85 },
        'src/renderer/src/**': { statements: 30, branches: 24, functions: 26, lines: 31 }
      }
    }
  }
})
