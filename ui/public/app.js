const qs = (id) => document.getElementById(id);

const refreshBtn = qs('refresh');
const deviceSelect = qs('deviceSelect');
const deviceMeta = qs('deviceMeta');
const pickRunningEmulator = qs('pickRunningEmulator');

const avdSelect = qs('avdSelect');
const startEmu = qs('startEmu');
const killEmu = qs('killEmu');
const coldBoot = qs('coldBoot');
const wipeData = qs('wipeData');

const rotatePortrait = qs('rotatePortrait');
const rotateLandscape = qs('rotateLandscape');

const apkPath = qs('apkPath');
const installApk = qs('installApk');
const pkgName = qs('pkgName');
const launchApp = qs('launchApp');
const clearApp = qs('clearApp');

const intervalMs = qs('intervalMs');
const startStream = qs('startStream');
const stopStream = qs('stopStream');
const streamStatus = qs('streamStatus');
const canvasHint = qs('canvasHint');
const screenImg = qs('screen');

const startLog = qs('startLog');
const stopLog = qs('stopLog');
const logFilter = qs('logFilter');
const clearLog = qs('clearLog');
const logPre = qs('log');

const toast = qs('toast');
const toastInner = toast.querySelector('div');

let logWs = null;
let screenWs = null;
let lastObjectUrl = null;

function showToast(msg) {
  toastInner.textContent = msg;
  toast.classList.remove('hidden');
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => toast.classList.add('hidden'), 2200);
}

async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  return await res.json();
}

function selectedSerial() {
  return deviceSelect.value;
}

function setDevices(devices) {
  const current = selectedSerial();
  deviceSelect.innerHTML = '';

  if (!devices.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No devices detected';
    deviceSelect.appendChild(opt);
    deviceMeta.textContent = '';
    return;
  }

  for (const d of devices) {
    const opt = document.createElement('option');
    opt.value = d.serial;
    opt.textContent = `${d.serial} — ${d.state}`;
    deviceSelect.appendChild(opt);
  }

  if (devices.some((d) => d.serial === current)) deviceSelect.value = current;
  updateDeviceMeta(devices);
}

function updateDeviceMeta(devices) {
  const serial = selectedSerial();
  const d = devices.find((x) => x.serial === serial);
  if (!d) {
    deviceMeta.textContent = '';
    return;
  }
  deviceMeta.textContent = d.extras ? d.extras : '';
}

function setAvds(avds) {
  avdSelect.innerHTML = '';
  if (!avds.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No AVDs detected';
    avdSelect.appendChild(opt);
    return;
  }
  for (const name of avds) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    avdSelect.appendChild(opt);
  }
}

async function refreshAll() {
  const [avds, devices] = await Promise.all([api('/api/avds'), api('/api/devices')]);

  if (!avds.ok) showToast(avds.error || 'Failed to load AVDs');
  if (!devices.ok) showToast(devices.error || 'Failed to load devices');

  setAvds(avds.ok ? avds.avds : []);
  setDevices(devices.ok ? devices.devices : []);
}

refreshBtn.addEventListener('click', refreshAll);

pickRunningEmulator.addEventListener('click', async () => {
  const devices = await api('/api/devices');
  if (!devices.ok) return showToast(devices.error || 'Failed to list devices');
  const emu = devices.devices.find((d) => d.serial.startsWith('emulator-') && d.state === 'device');
  if (!emu) return showToast('No running emulator detected');
  deviceSelect.value = emu.serial;
  updateDeviceMeta(devices.devices);
  showToast(`Selected ${emu.serial}`);
});

deviceSelect.addEventListener('change', async () => {
  const devices = await api('/api/devices');
  if (devices.ok) updateDeviceMeta(devices.devices);
});

startEmu.addEventListener('click', async () => {
  const avd = avdSelect.value;
  if (!avd) return showToast('Pick an AVD first');

  const params = new URLSearchParams();
  params.set('avd', avd);
  if (coldBoot.checked) params.set('cold', '1');
  if (wipeData.checked) params.set('wipe', '1');

  const r = await api(`/api/emulator/start?${params.toString()}`, { method: 'POST' });
  if (!r.ok) return showToast(r.error || 'Failed to start emulator');
  showToast(r.message || 'Starting emulator');

  window.setTimeout(refreshAll, 1200);
});

killEmu.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const r = await api(`/api/emulator/kill?serial=${encodeURIComponent(serial)}`, { method: 'POST' });
  if (!r.ok) return showToast(r.error || 'Failed to kill emulator');
  showToast('Emulator kill requested');
  window.setTimeout(refreshAll, 800);
});

rotatePortrait.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const r = await api(`/api/device/rotate?serial=${encodeURIComponent(serial)}&mode=portrait`, { method: 'POST' });
  if (!r.ok) return showToast(r.error || 'Rotate failed');
  showToast('Portrait');
});

rotateLandscape.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const r = await api(`/api/device/rotate?serial=${encodeURIComponent(serial)}&mode=landscape`, { method: 'POST' });
  if (!r.ok) return showToast(r.error || 'Rotate failed');
  showToast('Landscape');
});

installApk.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');

  const path = apkPath.value.trim();
  if (!path) return showToast('Enter an APK path');

  showToast('Installing…');
  const r = await api(
    `/api/app/install?serial=${encodeURIComponent(serial)}&apk=${encodeURIComponent(path)}`,
    { method: 'POST' }
  );
  if (!r.ok) return showToast(r.error || 'Install failed');
  showToast('Installed');
});

launchApp.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');

  const pkg = pkgName.value.trim();
  if (!pkg) return showToast('Enter a package name');

  const r = await api(`/api/app/launch?serial=${encodeURIComponent(serial)}&pkg=${encodeURIComponent(pkg)}`, {
    method: 'POST'
  });
  if (!r.ok) return showToast(r.error || 'Launch failed');
  showToast('Launched');
});

clearApp.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');

  const pkg = pkgName.value.trim();
  if (!pkg) return showToast('Enter a package name');

  const r = await api(`/api/app/clear?serial=${encodeURIComponent(serial)}&pkg=${encodeURIComponent(pkg)}`, {
    method: 'POST'
  });
  if (!r.ok) return showToast(r.error || 'Clear failed');
  showToast('Cleared');
});

function clearLogView() {
  logPre.textContent = '';
}

clearLog.addEventListener('click', clearLogView);

startLog.addEventListener('click', () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');

  stopLog.click();

  logWs = new WebSocket(`ws://${location.host}/ws/logcat?serial=${encodeURIComponent(serial)}`);
  logWs.onopen = () => showToast('Logcat connected');
  logWs.onclose = () => {};
  logWs.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'log') {
        const filter = logFilter.value.trim().toLowerCase();
        if (filter && !msg.text.toLowerCase().includes(filter)) return;
        logPre.textContent += msg.text;
        logPre.scrollTop = logPre.scrollHeight;
      }
      if (msg.error) showToast(msg.error);
    } catch {
      // ignore
    }
  };
});

stopLog.addEventListener('click', () => {
  if (logWs) {
    logWs.close();
    logWs = null;
    showToast('Logcat stopped');
  }
});

function setStreamState(stateText) {
  streamStatus.textContent = stateText;
}

function stopScreenStream() {
  if (screenWs) {
    screenWs.close();
    screenWs = null;
  }
  canvasHint.classList.remove('hidden');
  setStreamState('Idle');
}

stopStream.addEventListener('click', stopScreenStream);

startStream.addEventListener('click', () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');

  stopScreenStream();

  const ms = Math.max(100, Math.min(2000, Number(intervalMs.value || 250)));

  setStreamState('Connecting…');
  screenWs = new WebSocket(
    `ws://${location.host}/ws/screen?serial=${encodeURIComponent(serial)}&intervalMs=${encodeURIComponent(ms)}`
  );
  screenWs.binaryType = 'arraybuffer';

  screenWs.onopen = () => {
    canvasHint.classList.add('hidden');
    setStreamState('Streaming');
  };

  screenWs.onclose = () => {
    setStreamState('Idle');
  };

  screenWs.onmessage = (ev) => {
    if (typeof ev.data === 'string') {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'error') showToast(msg.error);
      } catch {
        // ignore
      }
      return;
    }

    const buf = new Uint8Array(ev.data);
    if (buf.length < 2) return;

    // 0x01: frame png
    if (buf[0] !== 0x01) return;

    const png = buf.slice(1);
    const blob = new Blob([png], { type: 'image/png' });

    if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
    lastObjectUrl = URL.createObjectURL(blob);
    screenImg.src = lastObjectUrl;
  };
});

function getImageToDeviceCoords(clientX, clientY) {
  // Map pointer position in the displayed <img> to device pixel coordinates.
  const rect = screenImg.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const imgW = screenImg.naturalWidth;
  const imgH = screenImg.naturalHeight;
  if (!imgW || !imgH) return null;

  // object-contain: determine letterboxed region
  const rectRatio = rect.width / rect.height;
  const imgRatio = imgW / imgH;

  let drawW, drawH, offsetX, offsetY;
  if (imgRatio > rectRatio) {
    drawW = rect.width;
    drawH = rect.width / imgRatio;
    offsetX = 0;
    offsetY = (rect.height - drawH) / 2;
  } else {
    drawH = rect.height;
    drawW = rect.height * imgRatio;
    offsetY = 0;
    offsetX = (rect.width - drawW) / 2;
  }

  const nx = (x - offsetX) / drawW;
  const ny = (y - offsetY) / drawH;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;

  return { x: Math.round(nx * imgW), y: Math.round(ny * imgH) };
}

let dragStart = null;
let dragMoved = false;

screenImg.addEventListener('pointerdown', (ev) => {
  if (!screenWs || screenWs.readyState !== WebSocket.OPEN) return;
  const p = getImageToDeviceCoords(ev.clientX, ev.clientY);
  if (!p) return;
  dragStart = { ...p, t: performance.now() };
  dragMoved = false;
  screenImg.setPointerCapture(ev.pointerId);
});

screenImg.addEventListener('pointermove', (ev) => {
  if (!dragStart) return;
  const p = getImageToDeviceCoords(ev.clientX, ev.clientY);
  if (!p) return;
  const dx = Math.abs(p.x - dragStart.x);
  const dy = Math.abs(p.y - dragStart.y);
  if (dx + dy > 12) dragMoved = true;
});

screenImg.addEventListener('pointerup', (ev) => {
  if (!screenWs || screenWs.readyState !== WebSocket.OPEN) {
    dragStart = null;
    return;
  }

  const end = getImageToDeviceCoords(ev.clientX, ev.clientY);
  if (!dragStart || !end) {
    dragStart = null;
    return;
  }

  const dt = Math.max(1, Math.min(1000, Math.round(performance.now() - dragStart.t)));

  if (!dragMoved) {
    screenWs.send(JSON.stringify({ type: 'tap', x: end.x, y: end.y }));
  } else {
    screenWs.send(JSON.stringify({ type: 'swipe', x1: dragStart.x, y1: dragStart.y, x2: end.x, y2: end.y, ms: dt }));
  }

  dragStart = null;
});

window.addEventListener('beforeunload', () => {
  stopScreenStream();
  stopLog.click();
});

refreshAll();
