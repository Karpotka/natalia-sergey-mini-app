/**
 * Перед деплоем на VK: в public/moon/phases оставляем только кадры gray_mb…
 * (как в moonPhases.ts). Остальные имена VK часто отклоняет как invalid file.
 *
 * Восстановить полный дамп каталога можно, скопировав папку phases из deluxe-moon-twa.
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'public', 'moon', 'phases');
const ok = /^gray_mb\d+w?_Normal\.png$/;

if (!fs.existsSync(dir)) {
  console.warn('[keep-only-gray-moon] нет папки', dir);
  process.exit(0);
}

const names = fs.readdirSync(dir);
let removed = 0;
for (const name of names) {
  if (name === '.gitkeep') continue;
  if (ok.test(name)) continue;
  fs.unlinkSync(path.join(dir, name));
  removed++;
}
console.log(`[keep-only-gray-moon] удалено лишних файлов: ${removed}, оставлено gray_mb*: ${names.length - removed}`);
