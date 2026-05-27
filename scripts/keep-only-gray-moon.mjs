/**
 * Перед деплоем на VK: в public/moon/phases оставляем только кадры gray_mb…
 * (как в moonPhases.ts). Имена: gray_mb0_normal.png (нижний регистр для VK CDN).
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'public', 'moon', 'phases');
const ok = /^gray_mb\d+w?_normal\.png$/i;

if (!fs.existsSync(dir)) {
  console.warn('[keep-only-gray-moon] нет папки', dir);
  process.exit(0);
}

const junk = new Set(['.gitkeep', '.DS_Store']);

function pathsEqualCaseInsensitive(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

/** Безопасное переименование на macOS (регистронезависимый диск). */
function safeRenameFile(dir, fromName, toName) {
  if (fromName === toName) return false;
  const from = path.join(dir, fromName);
  const to = path.join(dir, toName);
  if (!fs.existsSync(from)) return false;
  if (pathsEqualCaseInsensitive(from, to)) {
    const tmp = path.join(dir, `.__vk_rename_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);
    fs.renameSync(from, tmp);
    fs.renameSync(tmp, to);
    return true;
  }
  if (fs.existsSync(to)) fs.unlinkSync(to);
  fs.renameSync(from, to);
  return true;
}

const names = fs.readdirSync(dir);
let removed = 0;
let renamed = 0;
let kept = 0;

for (const name of names) {
  if (junk.has(name) || name.startsWith('._')) {
    fs.unlinkSync(path.join(dir, name));
    removed++;
    continue;
  }

  let target = name;
  const ext = path.extname(name);
  if (ext && ext !== ext.toLowerCase()) {
    target = path.basename(name, ext) + ext.toLowerCase();
  }
  if (/_Normal\./i.test(target)) {
    target = target.replace(/_Normal\./gi, '_normal.');
  }

  if (target !== name && safeRenameFile(dir, name, target)) {
    renamed++;
  }

  if (!ok.test(target)) {
    const toDrop = path.join(dir, target);
    if (fs.existsSync(toDrop)) fs.unlinkSync(toDrop);
    removed++;
    continue;
  }
  kept++;
}

console.log(
  `[keep-only-gray-moon] удалено: ${removed}, переименовано: ${renamed}, оставлено gray_mb*: ${kept}`,
);
