import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  statSync,
  readdirSync,
  mkdirSync,
  existsSync,
  createWriteStream
} from 'node:fs';
import { extname, join, resolve } from 'node:path';
import os from 'node:os';
import { WebSocketServer, WebSocket } from 'ws';

const HOST = process.env.ANDROID_DEV_UI_HOST ?? '127.0.0.1';
const PORT = Number(process.env.ANDROID_DEV_UI_PORT ?? '4242');
const PUBLIC_DIR = join(import.meta.dirname, 'public');
const DATA_DIR = process.env.ANDROID_DEV_UI_STATE ?? join(os.homedir(), '.local', 'share', 'android-dev-ui');
const BUILD_LOG_DIR = join(DATA_DIR, 'build-logs');
const PROJECT_FILE = join(DATA_DIR, 'project.json');

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(BUILD_LOG_DIR, { recursive: true });

function json(res, statusCode, body) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function text(res, statusCode, body) {
  res.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(body);
}

function safeReadFile(path) {
  try {
    const stat = statSync(path);
    if (!stat.isFile()) return null;
    return readFileSync(path);
  } catch {
    return null;
  }
}

function contentTypeFor(path) {
  switch (extname(path)) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    ...opts
  });
  return {
    ok: r.status === 0,
    status: r.status ?? -1,
    stdout: (r.stdout ?? '').trim(),
    stderr: (r.stderr ?? '').trim()
  };
}

const DEFAULT_PROJECT = {
  projectRoot: '/home/squigz/Documents/BreathingApp',
  buildCommand: 'cd android && ./gradlew assembleDebug',
  apkDir: 'android/app/build/outputs/apk/debug',
  packageName: 'com.breathingapp',
  autoLaunch: true
};

function loadProjectConfig() {
  try {
    if (!existsSync(PROJECT_FILE)) return { ...DEFAULT_PROJECT };
    const raw = readFileSync(PROJECT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PROJECT,
      ...(parsed && typeof parsed === 'object' ? parsed : {})
    };
  } catch {
    return { ...DEFAULT_PROJECT };
  }
}

function saveProjectConfig(config) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(PROJECT_FILE, JSON.stringify(config, null, 2), 'utf8');
}

function resolveProjectPath(project, subPath = '') {
  if (!project.projectRoot) return null;
  const root = project.projectRoot;
  const candidate = resolve(root, subPath);
  if (!candidate.startsWith(resolve(root))) return null;
  return candidate;
}

function listApkArtifacts(project) {
  if (!project.projectRoot || !project.apkDir) return [];
  const dirPath = resolveProjectPath(project, project.apkDir);
  if (!dirPath || !existsSync(dirPath)) return [];
  const entries = readdirSync(dirPath);
  const artifacts = [];
  for (const name of entries) {
    if (!name.toLowerCase().endsWith('.apk')) continue;
    const abs = resolve(dirPath, name);
    try {
      const stat = statSync(abs);
      if (!stat.isFile()) continue;
      artifacts.push({
        name,
        path: abs,
        size: stat.size,
        mtimeMs: stat.mtimeMs
      });
    } catch {
      // ignore
    }
  }
  return artifacts.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function readRequestBody(req, limitBytes = 5 * 1024 * 1024) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolvePromise(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

async function parseJsonBody(req) {
  const buf = await readRequestBody(req);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new Error('Invalid JSON');
  }
}

const buildState = {
  status: 'idle',
  id: null,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  logFile: null,
  error: null
};
let buildChild = null;
let buildLogStream = null;
const buildLogClients = new Set();

function broadcastBuildState() {
  for (const client of buildLogClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'state', status: buildState.status }));
    }
  }
}

function broadcastBuildLog(text) {
  for (const client of buildLogClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'log', text }));
    }
  }
}

function resetBuildState() {
  buildState.status = 'idle';
  buildState.id = null;
  buildState.startedAt = null;
  buildState.finishedAt = null;
  buildState.exitCode = null;
  buildState.logFile = null;
  buildState.error = null;
}

function latestBuildLogFile() {
  try {
    const files = readdirSync(BUILD_LOG_DIR).filter((f) => f.endsWith('.log'));
    if (!files.length) return null;
    files.sort();
    return join(BUILD_LOG_DIR, files[files.length - 1]);
  } catch {
    return null;
  }
}

function getActiveBuildLogFile() {
  if (buildState.logFile && existsSync(buildState.logFile)) return buildState.logFile;
  return latestBuildLogFile();
}

function parseAdbDevices(textOut) {
  const lines = textOut.split('\n').map((l) => l.trim()).filter(Boolean);
  const devices = [];
  for (const line of lines) {
    if (line.startsWith('List of devices attached')) continue;
    const parts = line.split(/\s+/);
    const serial = parts[0];
    const state = parts[1] ?? 'unknown';
    const extras = parts.slice(2).join(' ');
    devices.push({ serial, state, extras });
  }
  return devices;
}

function listAvds() {
  const r = run('avdmanager', ['list', 'avd']);
  if (!r.ok) return { ok: false, error: r.stderr || r.stdout || 'Failed to list AVDs' };

  const names = [];
  const combined = [r.stdout, r.stderr].filter(Boolean).join('\n');
  for (const line of combined.split('\n')) {
    const m = line.match(/^\s*Name:\s*(.+)$/);
    if (m?.[1]) names.push(m[1].trim());
  }

  return { ok: true, avds: names };
}

function adb(args, opts = {}) {
  return run('adb', args, opts);
}

function requireQuerySerial(url) {
  const serial = url.searchParams.get('serial');
  if (!serial) return { ok: false, error: 'Missing ?serial=' };
  return { ok: true, serial };
}

function requireQueryParam(url, name) {
  const value = url.searchParams.get(name);
  if (!value) return { ok: false, error: `Missing ?${name}=` };
  return { ok: true, value };
}

const server = createServer((req, res) => {
  Promise.resolve()
    .then(async () => {
      if (!req.url) return text(res, 400, 'Bad request');

      const url = new URL(req.url, `http://${req.headers.host}`);

      if (url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'POST') {
          return json(res, 405, { ok: false, error: 'Method not allowed' });
        }

      if (url.pathname === '/api/project' && req.method === 'GET') {
        return json(res, 200, { ok: true, project: loadProjectConfig() });
      }

      if (url.pathname === '/api/project' && req.method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          const next = { ...loadProjectConfig() };
          if (typeof body.projectRoot === 'string') next.projectRoot = body.projectRoot.trim();
          if (typeof body.buildCommand === 'string') next.buildCommand = body.buildCommand.trim();
          if (typeof body.apkDir === 'string') next.apkDir = body.apkDir.trim();
          if (typeof body.packageName === 'string') next.packageName = body.packageName.trim();
          if (typeof body.autoLaunch === 'boolean') next.autoLaunch = body.autoLaunch;
          saveProjectConfig(next);
          return json(res, 200, { ok: true, project: next });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Invalid request';
          return json(res, 400, { ok: false, error: message });
        }
      }

      if (url.pathname === '/api/build/status') {
        return json(res, 200, { ok: true, status: buildState });
      }

      if (url.pathname === '/api/build/log') {
        const file = getActiveBuildLogFile();
        if (!file || !existsSync(file)) {
          return json(res, 200, { ok: true, log: '' });
        }
        try {
          const content = readFileSync(file, 'utf8');
          return json(res, 200, { ok: true, log: content });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to read log';
          return json(res, 500, { ok: false, error: message });
        }
      }

      if (url.pathname === '/api/build/cancel' && req.method === 'POST') {
        if (buildState.status !== 'running' || !buildChild) {
          return json(res, 200, { ok: true, status: buildState.status });
        }
        buildState.status = 'cancelling';
        buildState.error = 'Cancelled by user';
        try {
          buildChild.kill('SIGINT');
        } catch {
          // ignore
        }
        return json(res, 200, { ok: true });
      }

      if (url.pathname === '/api/build/start' && req.method === 'POST') {
        if (buildState.status === 'running') {
          return json(res, 409, { ok: false, error: 'Build already running' });
        }
        const project = loadProjectConfig();
        if (!project.projectRoot || !project.buildCommand) {
          return json(res, 400, { ok: false, error: 'Configure project root and build command first' });
        }
        mkdirSync(BUILD_LOG_DIR, { recursive: true });
        const buildId = `${Date.now()}`;
        const logFile = join(BUILD_LOG_DIR, `build-${buildId}.log`);
        buildState.status = 'running';
        buildState.id = buildId;
        buildState.startedAt = Date.now();
        buildState.finishedAt = null;
        buildState.exitCode = null;
        buildState.logFile = logFile;
        buildState.error = null;
        broadcastBuildState();

        try {
          buildLogStream = createWriteStream(logFile, { flags: 'a' });
        } catch (err) {
          resetBuildState();
          const message = err instanceof Error ? err.message : 'Failed to open log file';
          return json(res, 500, { ok: false, error: message });
        }

        const child = spawn(project.buildCommand, {
          cwd: project.projectRoot,
          shell: true,
          env: {
            ...process.env
          }
        });
        buildChild = child;

        const handleChunk = (chunk) => {
          const text = chunk.toString('utf8');
          if (buildLogStream) buildLogStream.write(text);
          broadcastBuildLog(text);
        };

        child.stdout.on('data', handleChunk);
        child.stderr.on('data', handleChunk);

        child.on('error', (err) => {
          buildState.status = 'failed';
          buildState.error = err instanceof Error ? err.message : 'Build process error';
          buildState.finishedAt = Date.now();
          buildChild = null;
          if (buildLogStream) {
            buildLogStream.end();
            buildLogStream = null;
          }
          broadcastBuildState();
        });

        child.on('close', (code, signal) => {
          if (buildState.status === 'running' || buildState.status === 'cancelling') {
            if (signal) {
              buildState.status = 'cancelled';
              buildState.error = 'Cancelled';
            } else {
              buildState.status = code === 0 ? 'success' : 'failed';
              buildState.error = code === 0 ? null : `Exited with code ${code}`;
            }
          }
          buildState.exitCode = code;
          buildState.finishedAt = Date.now();
          buildChild = null;
          if (buildLogStream) {
            buildLogStream.end();
            buildLogStream = null;
          }
          broadcastBuildState();
        });

        return json(res, 200, { ok: true, buildId });
      }

      if (url.pathname === '/api/build/artifacts') {
        const project = loadProjectConfig();
        const artifacts = listApkArtifacts(project).map((artifact) => ({
          name: artifact.name,
          size: artifact.size,
          mtimeMs: artifact.mtimeMs
        }));
        return json(res, 200, { ok: true, artifacts });
      }

      if (url.pathname === '/api/health') {
        const adbVersion = adb(['version']);
        return json(res, 200, { ok: true, adb: adbVersion.ok ? adbVersion.stdout : adbVersion.stderr });
      }

      if (url.pathname === '/api/avds') {
        return json(res, 200, listAvds());
      }

      if (url.pathname === '/api/devices') {
        const r = adb(['devices', '-l']);
        if (!r.ok) return json(res, 500, { ok: false, error: r.stderr || r.stdout || 'adb devices failed' });
        return json(res, 200, { ok: true, devices: parseAdbDevices(r.stdout) });
      }

      if (url.pathname === '/api/emulator/start' && req.method === 'POST') {
        const avd = url.searchParams.get('avd');
        if (!avd) return json(res, 400, { ok: false, error: 'Missing ?avd=' });

        const cold = url.searchParams.get('cold') === '1';
        const wipe = url.searchParams.get('wipe') === '1';

        const args = ['-avd', avd, '-gpu', 'host'];
        if (cold) args.push('-no-snapshot-load');
        if (wipe) args.push('-wipe-data');
        // Faster boot for dev/testing loops.
        args.push('-no-boot-anim');

        const child = spawn('emulator', args, { stdio: 'ignore', detached: true });
        child.unref();

        return json(res, 200, { ok: true, message: `Starting emulator ${avd}` });
      }

      if (url.pathname === '/api/emulator/kill' && req.method === 'POST') {
        const q = requireQuerySerial(url);
        if (!q.ok) return json(res, 400, q);

        const r = adb(['-s', q.serial, 'emu', 'kill']);
        if (!r.ok) return json(res, 500, { ok: false, error: r.stderr || r.stdout || 'Failed to kill emulator' });
        return json(res, 200, { ok: true });
      }

      if (url.pathname === '/api/app/install' && req.method === 'POST') {
        const q = requireQuerySerial(url);
        if (!q.ok) return json(res, 400, q);

        let apkPath = url.searchParams.get('apk');
        const artifactName = url.searchParams.get('artifact');

        if (artifactName) {
          const project = loadProjectConfig();
          if (!project.projectRoot || !project.apkDir) {
            return json(res, 400, { ok: false, error: 'Configure APK directory first' });
          }
          const resolved = resolveProjectPath(project, join(project.apkDir, artifactName));
          if (!resolved || !existsSync(resolved)) {
            return json(res, 404, { ok: false, error: 'Artifact not found' });
          }
          apkPath = resolved;
        }

        if (!apkPath) return json(res, 400, { ok: false, error: 'Missing ?apk=/path/to.apk' });

        const r = adb(['-s', q.serial, 'install', '-r', apkPath]);
        if (!r.ok) return json(res, 500, { ok: false, error: r.stderr || r.stdout || 'Install failed' });
        return json(res, 200, { ok: true, output: r.stdout });
      }

      if (url.pathname === '/api/app/launch' && req.method === 'POST') {
        const q = requireQuerySerial(url);
        if (!q.ok) return json(res, 400, q);

        const pkg = url.searchParams.get('pkg');
        if (!pkg) return json(res, 400, { ok: false, error: 'Missing ?pkg=com.example.app' });

        // 'monkey' is the most portable launcher.
        const r = adb(['-s', q.serial, 'shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1']);
        if (!r.ok) return json(res, 500, { ok: false, error: r.stderr || r.stdout || 'Launch failed' });
        return json(res, 200, { ok: true, output: r.stdout });
      }

      if (url.pathname === '/api/app/clear' && req.method === 'POST') {
        const q = requireQuerySerial(url);
        if (!q.ok) return json(res, 400, q);

        const pkg = url.searchParams.get('pkg');
        if (!pkg) return json(res, 400, { ok: false, error: 'Missing ?pkg=com.example.app' });

        const r = adb(['-s', q.serial, 'shell', 'pm', 'clear', pkg]);
        if (!r.ok) return json(res, 500, { ok: false, error: r.stderr || r.stdout || 'Clear failed' });
        return json(res, 200, { ok: true, output: r.stdout });
      }

      if (url.pathname === '/api/app/deeplink' && req.method === 'POST') {
        const q = requireQuerySerial(url);
        if (!q.ok) return json(res, 400, q);

        const u = requireQueryParam(url, 'url');
        if (!u.ok) return json(res, 400, u);

        const r = adb([
          '-s',
          q.serial,
          'shell',
          'am',
          'start',
          '-a',
          'android.intent.action.VIEW',
          '-d',
          u.value
        ]);
        if (!r.ok) return json(res, 500, { ok: false, error: r.stderr || r.stdout || 'Deep link failed' });
        return json(res, 200, { ok: true, output: r.stdout });
      }

      if (url.pathname === '/api/device/keyevent' && req.method === 'POST') {
        const q = requireQuerySerial(url);
        if (!q.ok) return json(res, 400, q);

        const action = url.searchParams.get('action');
        const allowed = new Map([
          ['back', 'KEYCODE_BACK'],
          ['home', 'KEYCODE_HOME'],
          ['overview', 'KEYCODE_APP_SWITCH'],
          ['power', 'KEYCODE_POWER'],
          ['vol_up', 'KEYCODE_VOLUME_UP'],
          ['vol_down', 'KEYCODE_VOLUME_DOWN']
        ]);

        const keyCode = action ? allowed.get(action) : null;
        if (!keyCode) return json(res, 400, { ok: false, error: 'Invalid action' });

        const r = adb(['-s', q.serial, 'shell', 'input', 'keyevent', keyCode]);
        if (!r.ok) return json(res, 500, { ok: false, error: r.stderr || r.stdout || 'Key event failed' });
        return json(res, 200, { ok: true });
      }

      if (url.pathname === '/api/device/rotate' && req.method === 'POST') {
        const q = requireQuerySerial(url);
        if (!q.ok) return json(res, 400, q);

        const mode = url.searchParams.get('mode') ?? 'portrait';
        const rotation = mode === 'landscape' ? '1' : '0';

        const r1 = adb(['-s', q.serial, 'shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0']);
        const r2 = adb(['-s', q.serial, 'shell', 'settings', 'put', 'system', 'user_rotation', rotation]);
        if (!r1.ok || !r2.ok) {
          return json(res, 500, { ok: false, error: (r1.stderr || r2.stderr || 'Rotate failed').trim() });
        }
        return json(res, 200, { ok: true });
      }

      if (url.pathname === '/api/device/wifi' && req.method === 'POST') {
        const q = requireQuerySerial(url);
        if (!q.ok) return json(res, 400, q);
        const enabled = url.searchParams.get('enabled');
        if (enabled !== '1' && enabled !== '0') {
          return json(res, 400, { ok: false, error: 'Missing ?enabled=1|0' });
        }

        const r = adb(['-s', q.serial, 'shell', 'svc', 'wifi', enabled === '1' ? 'enable' : 'disable']);
        if (!r.ok) return json(res, 500, { ok: false, error: r.stderr || r.stdout || 'Wi‑Fi toggle failed' });
        return json(res, 200, { ok: true });
      }

      if (url.pathname === '/api/device/data' && req.method === 'POST') {
        const q = requireQuerySerial(url);
        if (!q.ok) return json(res, 400, q);
        const enabled = url.searchParams.get('enabled');
        if (enabled !== '1' && enabled !== '0') {
          return json(res, 400, { ok: false, error: 'Missing ?enabled=1|0' });
        }

        const r = adb(['-s', q.serial, 'shell', 'svc', 'data', enabled === '1' ? 'enable' : 'disable']);
        if (!r.ok) return json(res, 500, { ok: false, error: r.stderr || r.stdout || 'Mobile data toggle failed' });
        return json(res, 200, { ok: true });
      }

      if (url.pathname === '/api/emulator/net' && req.method === 'POST') {
        const q = requireQuerySerial(url);
        if (!q.ok) return json(res, 400, q);

        const speed = url.searchParams.get('speed') ?? 'full';
        const delay = url.searchParams.get('delay') ?? 'none';

        const r1 = adb(['-s', q.serial, 'emu', 'network', 'speed', speed]);
        const r2 = adb(['-s', q.serial, 'emu', 'network', 'delay', delay]);
        if (!r1.ok || !r2.ok) {
          return json(res, 500, { ok: false, error: (r1.stderr || r2.stderr || 'Network profile failed').trim() });
        }
        return json(res, 200, { ok: true });
      }

      if (url.pathname === '/api/device/geo' && req.method === 'POST') {
        const q = requireQuerySerial(url);
        if (!q.ok) return json(res, 400, q);

        const lat = Number(url.searchParams.get('lat'));
        const lon = Number(url.searchParams.get('lon'));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return json(res, 400, { ok: false, error: 'Missing ?lat=<number>&lon=<number>' });
        }

        // Emulator geo fix uses: geo fix <longitude> <latitude>
        const r = adb(['-s', q.serial, 'emu', 'geo', 'fix', String(lon), String(lat)]);
        if (!r.ok) return json(res, 500, { ok: false, error: r.stderr || r.stdout || 'Geo set failed' });
        return json(res, 200, { ok: true });
      }

      if (url.pathname === '/api/device/battery' && req.method === 'POST') {
        const q = requireQuerySerial(url);
        if (!q.ok) return json(res, 400, q);

        const mode = url.searchParams.get('mode') ?? 'set';
        if (mode === 'reset') {
          const r = adb(['-s', q.serial, 'shell', 'dumpsys', 'battery', 'reset']);
          if (!r.ok) return json(res, 500, { ok: false, error: r.stderr || r.stdout || 'Battery reset failed' });
          return json(res, 200, { ok: true });
        }

        const level = Number(url.searchParams.get('level'));
        if (!Number.isFinite(level) || level < 0 || level > 100) {
          return json(res, 400, { ok: false, error: 'Missing ?level=0..100 (or ?mode=reset)' });
        }

        const charging = url.searchParams.get('charging') === '1';
        const status = charging ? '2' : '3'; // 2=charging, 3=discharging

        const r1 = adb(['-s', q.serial, 'shell', 'dumpsys', 'battery', 'set', 'level', String(Math.round(level))]);
        const r2 = adb(['-s', q.serial, 'shell', 'dumpsys', 'battery', 'set', 'status', status]);
        if (!r1.ok || !r2.ok) {
          return json(res, 500, { ok: false, error: (r1.stderr || r2.stderr || 'Battery set failed').trim() });
        }
        return json(res, 200, { ok: true });
      }

      if (url.pathname === '/api/device/theme' && req.method === 'POST') {
        const q = requireQuerySerial(url);
        if (!q.ok) return json(res, 400, q);

        const mode = url.searchParams.get('mode') ?? 'dark';
        const arg = mode === 'light' ? 'no' : 'yes';

        const r = adb(['-s', q.serial, 'shell', 'cmd', 'uimode', 'night', arg]);
        if (!r.ok) return json(res, 500, { ok: false, error: r.stderr || r.stdout || 'Theme set failed' });
        return json(res, 200, { ok: true });
      }

      if (url.pathname === '/api/device/locale' && req.method === 'POST') {
        const q = requireQuerySerial(url);
        if (!q.ok) return json(res, 400, q);

        const loc = requireQueryParam(url, 'locale');
        if (!loc.ok) return json(res, 400, loc);

        const r = adb(['-s', q.serial, 'shell', 'cmd', 'locale', 'set', loc.value]);
        if (!r.ok) return json(res, 500, { ok: false, error: r.stderr || r.stdout || 'Locale set failed' });
        return json(res, 200, { ok: true });
      }

      if (url.pathname === '/api/device/font-scale' && req.method === 'POST') {
        const q = requireQuerySerial(url);
        if (!q.ok) return json(res, 400, q);

        const scale = Number(url.searchParams.get('scale'));
        if (!Number.isFinite(scale) || scale < 0.75 || scale > 2.0) {
          return json(res, 400, { ok: false, error: 'Missing ?scale=0.75..2.0' });
        }

        const r = adb(['-s', q.serial, 'shell', 'settings', 'put', 'system', 'font_scale', String(scale)]);
        if (!r.ok) return json(res, 500, { ok: false, error: r.stderr || r.stdout || 'Font scale failed' });
        return json(res, 200, { ok: true });
      }

        return json(res, 404, { ok: false, error: 'Unknown endpoint' });
      }

      // Static files
      const filePath = url.pathname === '/' ? join(PUBLIC_DIR, 'index.html') : join(PUBLIC_DIR, url.pathname);
      const data = safeReadFile(filePath);
      if (!data) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      res.writeHead(200, {
        'content-type': contentTypeFor(filePath),
        'cache-control': 'no-store'
      });
      res.end(data);
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      json(res, 500, { ok: false, error: msg });
    });
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    if (!url.pathname.startsWith('/ws/')) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, url);
    });
  } catch {
    socket.destroy();
  }
});

wss.on('connection', (ws, url) => {
  if (url.pathname === '/ws/build-log') {
    buildLogClients.add(ws);
    const logFile = getActiveBuildLogFile();
    if (logFile && existsSync(logFile)) {
      try {
        const content = readFileSync(logFile, 'utf8');
        if (content) ws.send(JSON.stringify({ type: 'log', text: content }));
      } catch {
        // ignore
      }
    }
    ws.send(JSON.stringify({ type: 'state', status: buildState.status }));
    ws.on('close', () => {
      buildLogClients.delete(ws);
    });
    return;
  }

  if (url.pathname === '/ws/logcat') {
    const q = requireQuerySerial(url);
    if (!q.ok) {
      ws.send(JSON.stringify(q));
      ws.close();
      return;
    }

    const child = spawn('adb', ['-s', q.serial, 'logcat'], { stdio: ['ignore', 'pipe', 'pipe'] });

    const sendLine = (chunk) => {
      const text = chunk.toString('utf8');
      ws.send(JSON.stringify({ type: 'log', text }));
    };

    child.stdout.on('data', sendLine);
    child.stderr.on('data', sendLine);

    ws.on('close', () => {
      child.kill('SIGTERM');
    });

    return;
  }

  if (url.pathname === '/ws/screen') {
    const q = requireQuerySerial(url);
    if (!q.ok) {
      ws.send(JSON.stringify(q));
      ws.close();
      return;
    }

    let intervalMs = Number(url.searchParams.get('intervalMs') ?? '180');
    if (!Number.isFinite(intervalMs) || intervalMs < 80) intervalMs = 80;
    if (intervalMs > 2000) intervalMs = 2000;

    let stopped = false;
    let timer = null;

    function sendFrame(pngBuffer) {
      const out = Buffer.concat([Buffer.from([0x01]), pngBuffer]);
      ws.send(out);
    }

    function schedule(nextDelay) {
      if (stopped) return;
      timer = setTimeout(tick, Math.max(0, nextDelay));
    }

    function tick() {
      if (stopped) return;
      const started = Date.now();
      const r = spawnSync('adb', ['-s', q.serial, 'exec-out', 'screencap', '-p'], { encoding: null, maxBuffer: 15 * 1024 * 1024 });
      const elapsed = Date.now() - started;

      if (stopped) return;

      if (r.status !== 0 || !r.stdout) {
        const err = (r.stderr ? r.stderr.toString('utf8') : '') || `screencap failed (exit ${r.status ?? -1})`;
        ws.send(JSON.stringify({ type: 'error', error: err.trim() }));
        schedule(intervalMs);
        return;
      }

      sendFrame(Buffer.from(r.stdout));
      const nextDelay = Math.max(20, intervalMs - elapsed);
      schedule(nextDelay);
    }

    schedule(0);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString('utf8'));
        if (msg?.type === 'tap') {
          const x = Math.max(0, Math.floor(Number(msg.x ?? 0)));
          const y = Math.max(0, Math.floor(Number(msg.y ?? 0)));
          adb(['-s', q.serial, 'shell', 'input', 'tap', String(x), String(y)]);
        }
        if (msg?.type === 'swipe') {
          const x1 = Math.max(0, Math.floor(Number(msg.x1 ?? 0)));
          const y1 = Math.max(0, Math.floor(Number(msg.y1 ?? 0)));
          const x2 = Math.max(0, Math.floor(Number(msg.x2 ?? 0)));
          const y2 = Math.max(0, Math.floor(Number(msg.y2 ?? 0)));
          const ms = Math.max(1, Math.floor(Number(msg.ms ?? 250)));
          adb(['-s', q.serial, 'shell', 'input', 'swipe', String(x1), String(y1), String(x2), String(y2), String(ms)]);
        }
      } catch {
        // Ignore bad input
      }
    });

    ws.on('close', () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    });

    return;
  }

  ws.send(JSON.stringify({ ok: false, error: 'Unknown websocket path' }));
  ws.close();
});

server.listen(PORT, HOST, () => {
  console.log(`Android Dev UI running at http://${HOST}:${PORT}`);
});


