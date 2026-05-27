/**
 * Перед vk-miniapps-deploy: убираем файлы, которые VK хостинг отклоняет как invalid file.
 * - .DS_Store, .gitkeep, ._* , __MACOSX
 * - расширения в верхнем регистре (.PNG → .png)
 * - moon/8k_moon.jpg и любые файлы > 10 МБ
 * - кадры луны: только gray_mb*_normal.png (нижний регистр)
 */
import fs from 'node:fs';
import path from 'node:path';

const dist = path.join(process.cwd(), 'dist');
const moonPhasesOk = /^gray_mb\d+w?_normal\.png$/i;
/** VK CDN часто отклоняет очень крупные файлы в архиве. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function walk(dir, onFile) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === '__MACOSX') {
        fs.rmSync(full, { recursive: true, force: true });
        continue;
      }
      walk(full, onFile);
    } else onFile(full, name, st);
  }
}

if (!fs.existsSync(dist)) {
  console.error('[sanitize-vk-dist] нет папки dist — сначала npm run build:vk');
  process.exit(1);
}

let removed = 0;
let renamed = 0;

const dropMoonHeavy = [
  path.join(dist, 'moon', '8k_moon.jpg'),
  path.join(dist, 'moon', '8K_moon.jpg'),
];
for (const p of dropMoonHeavy) {
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    removed++;
    console.warn('[sanitize-vk-dist] удалён тяжёлый файл:', path.relative(process.cwd(), p));
  }
}

walk(dist, (full, name, st) => {
  if (name === '.DS_Store' || name === '.gitkeep' || name.startsWith('._')) {
    fs.unlinkSync(full);
    removed++;
    return;
  }

  if (st.size > MAX_FILE_BYTES) {
    fs.unlinkSync(full);
    removed++;
    console.warn('[sanitize-vk-dist] удалён файл >10 МБ:', path.relative(process.cwd(), full), st.size);
    return;
  }

  let base = name;
  const ext = path.extname(name);
  if (ext && ext !== ext.toLowerCase()) {
    base = path.basename(name, ext) + ext.toLowerCase();
  }
  if (base.includes('_Normal.')) {
    base = base.replace(/_Normal\./gi, '_normal.');
  }
  if (base !== name) {
    const dirName = path.dirname(full);
    const next = path.join(dirName, base);
    if (next.toLowerCase() === full.toLowerCase()) {
      const tmp = path.join(dirName, `.__vk_san_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);
      fs.renameSync(full, tmp);
      fs.renameSync(tmp, next);
    } else if (fs.existsSync(next)) {
      fs.unlinkSync(next);
      fs.renameSync(full, next);
    } else {
      fs.renameSync(full, next);
    }
    renamed++;
  }
});

const phasesDir = path.join(dist, 'moon', 'phases');
if (fs.existsSync(phasesDir)) {
  for (const name of fs.readdirSync(phasesDir)) {
    const full = path.join(phasesDir, name);
    if (!fs.statSync(full).isFile()) continue;
    if (moonPhasesOk.test(name)) continue;
    fs.unlinkSync(full);
    removed++;
  }
}

console.log(`[sanitize-vk-dist] удалено: ${removed}, переименовано: ${renamed}`);
