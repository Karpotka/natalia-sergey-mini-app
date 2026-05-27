/**
 * Деплой без интерактива: prod + dev URLs, без test group.
 * Временно дописывает noprompt в vk-hosting-config.json и восстанавливает файл после выхода.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const configPath = path.join(process.cwd(), 'vk-hosting-config.json');
const backup = fs.readFileSync(configPath, 'utf8');
const cfg = JSON.parse(backup);

cfg.noprompt = true;
cfg.update_prod = 1;
cfg.update_dev = 1;
delete cfg.test_group_name;

fs.writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`);

let exitCode = 1;
try {
  const r = spawnSync('node', ['scripts/vk-miniapps-deploy-resilient.mjs'], {
    stdio: 'inherit',
    shell: false,
    env: { ...process.env },
  });
  exitCode = r.status ?? 1;
} finally {
  fs.writeFileSync(configPath, backup);
}

process.exit(exitCode);
