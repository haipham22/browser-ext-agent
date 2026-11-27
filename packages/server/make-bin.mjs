// Bundle self-contained bin/mcp.js (gom cả ws/MCP SDK/zod — npx từ git chạy
// ngay, không cần install deps). Shebang + createRequire banner bắt buộc:
// npm từ git symlink thẳng file, không shebang thì sh nhận soi.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'bin/mcp.js',
  banner: {
    js: [
      '#!/usr/bin/env node',
      "import { createRequire } from 'node:module';",
      'const require = createRequire(import.meta.url);',
    ].join('\n'),
  },
});
process.stdout.write('bin/mcp.js bundled\n');
