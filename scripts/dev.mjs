// starts the sync server and the expo dev server together, so setup is one command.
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const server = spawn(npm, ['run', '--silent', 'server'], { stdio: ['ignore', 'pipe', 'pipe'] });
for (const stream of [server.stdout, server.stderr]) {
  stream.on('data', (chunk) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) console.log(`\x1b[36m[server]\x1b[0m ${line}`);
    }
  });
}

const app = spawn(npm, ['run', '--silent', 'app', '--', ...process.argv.slice(2)], {
  stdio: 'inherit',
});

function shutdown(code = 0) {
  server.kill();
  app.kill();
  process.exit(code);
}

app.on('exit', (code) => shutdown(code ?? 0));
server.on('exit', (code) => {
  console.error(
    `\x1b[31m[server] stopped (exit code ${code}). Restart with "npm run server".\x1b[0m`,
  );
});
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
