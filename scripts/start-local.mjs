import { get } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const url = 'http://localhost:4173/';
const running = await new Promise(resolveResult => {
  const request = get(url, response => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { body += chunk; });
    response.on('end', () => resolveResult(body.includes('<title>同盟漫游记') ? 'game' : 'other'));
    response.on('error', () => resolveResult('other'));
  });
  request.setTimeout(2000, () => { request.destroy(); resolveResult('other'); });
  request.on('error', error => resolveResult(error.code === 'ECONNREFUSED' ? 'none' : 'other'));
});
if (running === 'game') {
  console.log(`游戏已经在运行：${url}\n在浏览器中打开或刷新该地址即可，不需要重复启动。`);
} else if (running === 'other') {
  console.error('4173 端口被其他服务使用或暂时无法确认，请在 Codex 中让我检查；不会停止其他程序。');
  process.exitCode = 1;
} else {
  const vite = resolve(root, 'node_modules/vite/bin/vite.js');
  try { await access(vite); }
  catch { console.error('尚未安装依赖。请先在项目目录运行 npm install。'); process.exit(1); }
  console.log(`正在启动同盟漫游记。\n浏览器地址：${url}\n请保持此终端窗口打开；关闭窗口或按 Control+C 会停止本地游戏服务。\n`);
  const server = spawn(process.execPath, [vite, '--host', '0.0.0.0', '--port', '4173', '--strictPort'], { cwd: root, stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
  server.on('error', error => { console.error(`启动失败：${error.message}`); process.exitCode = 1; });
  server.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 0 : 1); });
}
