import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'apps/tiza-web/vitest.config.ts',
      'apps/relevo-web/vitest.config.ts',
      'packages/ui/vitest.config.ts',
    ],
  },
});
