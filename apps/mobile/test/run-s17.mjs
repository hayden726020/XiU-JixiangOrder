import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const suites = [
  's17-shop-auth-logic-check.mjs',
  's17-cancel-logic-check.mjs',
  's17-stay-timer-check.mjs',
];
const expectedChecks = 59;

let passed = 0;
let failedSuites = 0;

for (const suite of suites) {
  const result = spawnSync(process.execPath, [join(scriptDir, 's17', suite)], {
    encoding: 'utf8',
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  passed += (result.stdout ?? '').match(/^PASS /gm)?.length ?? 0;
  if (result.status !== 0) {
    failedSuites += 1;
  }
}

const ok = failedSuites === 0 && passed === expectedChecks;
console.log(
  `S17 逻辑检查：${passed}/${expectedChecks} 项通过，失败套件 ${failedSuites} 个`,
);
process.exit(ok ? 0 : 1);