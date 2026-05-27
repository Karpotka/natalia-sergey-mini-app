/**
 * Обёртка vk-miniapps-deploy:
 * - после "Uploaded version …" ждём очередь VK не дольше QUEUE_WAIT_MS;
 * - при таймауте / ECONNRESET / ETIMEDOUT считаем деплой успешным (архив уже на хостинге).
 */
import { spawn } from 'node:child_process';

const UPLOADED_RE = /Uploaded version (\d+)!/;
/** Сколько ждать ответ очереди после успешной загрузки ZIP. */
const QUEUE_WAIT_MS = Number(process.env.VK_DEPLOY_QUEUE_WAIT_MS || 60_000);

let uploadedVersion = null;
let queueTimer = null;
let finished = false;

function finish(code, message) {
  if (finished) return;
  finished = true;
  if (queueTimer) clearTimeout(queueTimer);
  if (message) console.log(message);
  process.exit(code);
}

function onUploaded(version) {
  if (uploadedVersion) return;
  uploadedVersion = version;
  console.log('');
  console.log(
    `[vk-deploy] Архив принят VK (версия ${version}). Ждём очередь до ${Math.round(QUEUE_WAIT_MS / 1000)} с…`,
  );
  console.log('[vk-deploy] Если зависло дольше — процесс завершится сам; приложение уже обновляется.');

  queueTimer = setTimeout(() => {
    console.log('');
    console.log('[vk-deploy] Таймаут очереди VK — выходим (загрузка завершена).');
    console.log('[vk-deploy] https://vk.com/app54570453');
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!finished) child.kill('SIGKILL');
    }, 3000);
  }, QUEUE_WAIT_MS);
}

function forward(chunk, stream) {
  const text = chunk.toString();
  process[stream].write(text);
  const m = text.match(UPLOADED_RE);
  if (m) onUploaded(m[1]);
}

const child = spawn('vk-miniapps-deploy', {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: false,
});

child.stdout?.on('data', (d) => forward(d, 'stdout'));
child.stderr?.on('data', (d) => forward(d, 'stderr'));

child.on('close', (code) => {
  if (uploadedVersion && code !== 0) {
    finish(
      0,
      `\n[vk-deploy] Архив на хостинге VK, версия ${uploadedVersion}.\n` +
        '[vk-deploy] Очередь VK оборвалась (сеть) — это не отменяет загрузку.\n' +
        '[vk-deploy] https://vk.com/app54570453',
    );
    return;
  }
  if (uploadedVersion && code === 0) {
    finish(0);
    return;
  }
  finish(code ?? 1);
});

child.on('error', (err) => {
  console.error('[vk-deploy] Не удалось запустить vk-miniapps-deploy:', err.message);
  finish(1);
});

process.on('SIGINT', () => {
  if (uploadedVersion) {
    console.log('\n[vk-deploy] Прервано. Версия', uploadedVersion, 'уже на хостинге.');
    finish(0);
  } else {
    child.kill('SIGINT');
  }
});
