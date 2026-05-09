const { execSync } = require('child_process');

const PORTS = [3000, 5173, 6379]; // backend, vite, redis

const portNames = { 3000: 'backend (NestJS)', 5173: 'frontend (Vite)', 6379: 'redis' };

console.log('🔍 Scanning ports:', PORTS.join(', '), '\n');

let killed = 0;

for (const port of PORTS) {
  try {
    const stdout = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' }).trim();
    if (!stdout) {
      console.log(`✅ Port ${port} (${portNames[port]}) — already free`);
      continue;
    }

    const pids = stdout.split('\n').filter(Boolean);
    for (const pid of pids) {
      try {
        const pname = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf-8' }).trim();
        process.kill(Number(pid), 'SIGKILL');
        console.log(`💀 Killed port ${port} — PID ${pid} (${pname})`);
        killed++;
      } catch {
        console.log(`⚠️  Port ${port} — PID ${pid} not found (already gone)`);
      }
    }
  } catch {
    console.log(`✅ Port ${port} (${portNames[port]}) — already free`);
  }
}

console.log(`\n✨ Done. Killed ${killed} process${killed !== 1 ? 'es' : ''}.`);
