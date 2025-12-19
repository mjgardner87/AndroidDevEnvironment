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

const profileSelect = qs('profileSelect');
const profileName = qs('profileName');
const profileSave = qs('profileSave');
const profileNew = qs('profileNew');
const profileDelete = qs('profileDelete');
const profileExport = qs('profileExport');
const profileImport = qs('profileImport');

const apkPath = qs('apkPath');
const installApk = qs('installApk');
const pkgName = qs('pkgName');
const launchApp = qs('launchApp');
const clearApp = qs('clearApp');
const deeplinkUrl = qs('deeplinkUrl');
const openDeeplink = qs('openDeeplink');

const wifiOn = qs('wifiOn');
const wifiOff = qs('wifiOff');
const dataOn = qs('dataOn');
const dataOff = qs('dataOff');

const netSpeed = qs('netSpeed');
const netDelay = qs('netDelay');
const applyNet = qs('applyNet');

const geoLat = qs('geoLat');
const geoLon = qs('geoLon');
const applyGeo = qs('applyGeo');

const batteryLevel = qs('batteryLevel');
const batteryLabel = qs('batteryLabel');
const batteryCharging = qs('batteryCharging');
const batteryDischarging = qs('batteryDischarging');
const batteryReset = qs('batteryReset');
let batteryIsCharging = false;

const themeDark = qs('themeDark');
const themeLight = qs('themeLight');
const locale = qs('locale');
const fontScale = qs('fontScale');
const applyDisplay = qs('applyDisplay');

const intervalMs = qs('intervalMs');
const startStream = qs('startStream');
const stopStream = qs('stopStream');
const streamStatus = qs('streamStatus');
const canvasHint = qs('canvasHint');
const screenImg = qs('screen');
const runningDevicesEl = qs('runningDevices');
const navBack = qs('navBack');
const navHome = qs('navHome');
const navOverview = qs('navOverview');
const navVolDown = qs('navVolDown');
const navVolUp = qs('navVolUp');
const navPower = qs('navPower');
const controlRotatePortrait = qs('controlRotatePortrait');
const controlRotateLandscape = qs('controlRotateLandscape');

const projectRootInput = qs('projectRootInput');
const projectBuildCommand = qs('projectBuildCommand');
const projectApkDir = qs('projectApkDir');
const projectPackageName = qs('projectPackageName');
const projectAutoLaunch = qs('projectAutoLaunch');
const projectSave = qs('projectSave');

const buildStatusEl = qs('buildStatus');
const buildRunBtn = qs('buildRun');
const buildInstallBtn = qs('buildInstall');
const installLatestBtn = qs('installLatest');
const refreshArtifactsBtn = qs('refreshArtifacts');
const artifactListEl = qs('artifactList');

const buildLogPre = qs('buildLog');
const buildLogFollowBtn = qs('buildLogFollow');
const buildLogClearBtn = qs('buildLogClear');

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
let buildLogWs = null;
let buildLogFollowEnabled = true;
let buildStatusTimer = null;
let lastBuildStatus = 'idle';
let pendingAutoInstall = false;
let pendingAutoLaunch = false;
let cachedArtifacts = [];
let projectConfig = null;

const STORAGE_KEY = 'android-dev-ui:profiles:v1';
const PROJECT_DEFAULT = {
  projectRoot: '/home/squigz/Documents/BreathingApp',
  buildCommand: 'cd android && ./gradlew assembleDebug',
  apkDir: 'android/app/build/outputs/apk/debug',
  packageName: 'com.breathingapp',
  autoLaunch: true
};

function applyProjectForm(config) {
  projectConfig = { ...PROJECT_DEFAULT, ...(config || {}) };
  if (projectRootInput) projectRootInput.value = projectConfig.projectRoot ?? '';
  if (projectBuildCommand) projectBuildCommand.value = projectConfig.buildCommand ?? '';
  if (projectApkDir) projectApkDir.value = projectConfig.apkDir ?? '';
  if (projectPackageName) projectPackageName.value = projectConfig.packageName ?? '';
  if (projectAutoLaunch) projectAutoLaunch.checked = Boolean(projectConfig.autoLaunch);
}

function snapshotProjectForm() {
  return {
    projectRoot: projectRootInput?.value.trim() ?? '',
    buildCommand: projectBuildCommand?.value.trim() ?? '',
    apkDir: projectApkDir?.value.trim() ?? '',
    packageName: projectPackageName?.value.trim() ?? '',
    autoLaunch: Boolean(projectAutoLaunch?.checked)
  };
}

async function fetchProjectConfig() {
  try {
    const res = await api('/api/project');
    if (res.ok && res.project) {
      applyProjectForm(res.project);
    }
  } catch {
    // ignore fetch errors
  }
}

async function saveProjectToServer() {
  const payload = snapshotProjectForm();
  try {
    const res = await fetch('/api/project', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => r.json());
    if (!res.ok) {
      showToast(res.error || 'Failed to save project');
      return;
    }
    applyProjectForm(res.project);
    showToast('Project saved');
  } catch {
    showToast('Failed to save project');
  }
}

function currentPackageName() {
  return projectPackageName?.value.trim() || projectConfig?.packageName || '';
}

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

function newId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p && typeof p === 'object' && typeof p.id === 'string');
  } catch {
    return [];
  }
}

function saveProfiles(profiles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function currentProfileId() {
  return profileSelect?.value || '';
}

function renderProfiles(profiles) {
  if (!profileSelect) return;
  const cur = currentProfileId();
  profileSelect.innerHTML = '';

  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '— Select profile —';
  profileSelect.appendChild(empty);

  for (const p of profiles) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name || '(unnamed)';
    profileSelect.appendChild(opt);
  }

  if (profiles.some((p) => p.id === cur)) profileSelect.value = cur;
}

function applyProfile(p) {
  if (!p) return;
  profileName.value = p.name ?? '';
  apkPath.value = p.apkPath ?? '';
  pkgName.value = p.pkgName ?? '';
  deeplinkUrl.value = (p.deeplinks?.[0] ?? '') || '';
}

function snapshotProfileForm() {
  return {
    name: profileName.value.trim(),
    apkPath: apkPath.value.trim(),
    pkgName: pkgName.value.trim(),
    deeplinks: deeplinkUrl.value.trim() ? [deeplinkUrl.value.trim()] : []
  };
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
    renderRunningDevices([]);
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
  renderRunningDevices(devices);
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

function updateBuildStatusLabel(statusText, extra) {
  if (!buildStatusEl) return;
  buildStatusEl.textContent = statusText ?? 'Idle';
  buildStatusEl.classList.remove('text-cyan-400', 'text-yellow-400', 'text-red-400', 'text-slate-100');
  if (statusText === 'running') buildStatusEl.classList.add('text-cyan-400');
  else if (statusText === 'failed') buildStatusEl.classList.add('text-red-400');
  else if (statusText === 'success') buildStatusEl.classList.add('text-cyan-400');
  else if (statusText === 'cancelled') buildStatusEl.classList.add('text-yellow-400');
  else buildStatusEl.classList.add('text-slate-100');
  if (extra?.error && statusText === 'failed') {
    buildStatusEl.title = extra.error;
  } else {
    buildStatusEl.removeAttribute('title');
  }
}

async function refreshBuildStatus() {
  try {
    const res = await api('/api/build/status');
    if (!res.ok) return;
    const status = res.status?.status ?? 'idle';
    updateBuildStatusLabel(status, res.status);
    if (status !== lastBuildStatus && lastBuildStatus === 'running') {
      if (status === 'success' && pendingAutoInstall) {
        pendingAutoInstall = false;
        await installLatestArtifact({ launch: pendingAutoLaunch && Boolean(currentPackageName()) });
      } else {
        pendingAutoInstall = false;
        pendingAutoLaunch = false;
      }
    }
    lastBuildStatus = status;
  } catch {
    // ignore
  }
}

function ensureBuildStatusPolling() {
  if (!buildStatusTimer) {
    buildStatusTimer = window.setInterval(refreshBuildStatus, 2000);
  }
}

function appendBuildLog(text) {
  if (!buildLogPre || !text) return;
  buildLogPre.textContent += text;
  if (buildLogFollowEnabled) {
    buildLogPre.scrollTop = buildLogPre.scrollHeight;
  }
}

function openBuildLogStream() {
  if (buildLogWs || !buildLogPre) return;
  buildLogWs = new WebSocket(`ws://${location.host}/ws/build-log`);
  buildLogWs.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'log') appendBuildLog(msg.text);
      if (msg.type === 'state') updateBuildStatusLabel(msg.status);
    } catch {
      // ignore
    }
  };
  buildLogWs.onclose = () => {
    buildLogWs = null;
    setTimeout(openBuildLogStream, 1200);
  };
}

function renderRunningDevices(devices) {
  if (!runningDevicesEl) return;
  runningDevicesEl.innerHTML = '';

  if (!devices.length) {
    const empty = document.createElement('div');
    empty.className = 'text-slate-500';
    empty.textContent = 'No running emulators detected.';
    runningDevicesEl.appendChild(empty);
    return;
  }

  for (const device of devices) {
    const card = document.createElement('div');
    card.className = 'rounded-xl border border-border bg-slate-900/40 p-3 space-y-1';

    const title = document.createElement('div');
    title.className = 'text-xs font-semibold text-slate-200';
    title.textContent = device.serial;
    card.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'text-[11px] text-slate-400';
    meta.textContent = device.extras || device.state;
    card.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'flex gap-2 pt-1';

    const selectBtn = document.createElement('button');
    selectBtn.className = 'flex-1 px-2 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px]';
    selectBtn.textContent = 'Select';
    selectBtn.addEventListener('click', () => {
      deviceSelect.value = device.serial;
      updateDeviceMeta(devices);
      showToast(`Selected ${device.serial}`);
    });

    const killBtn = document.createElement('button');
    killBtn.className = 'px-2 py-1.5 rounded-md bg-red-900/70 hover:bg-red-800 text-[11px]';
    killBtn.textContent = 'Kill';
    killBtn.addEventListener('click', async () => {
      const resp = await api(
        `/api/emulator/kill?serial=${encodeURIComponent(device.serial)}`,
        { method: 'POST' }
      );
      if (!resp.ok) {
        showToast(resp.error || 'Failed to kill emulator');
        return;
      }
      showToast(`Kill requested for ${device.serial}`);
      window.setTimeout(refreshAll, 800);
    });

    actions.appendChild(selectBtn);
    actions.appendChild(killBtn);
    card.appendChild(actions);

    runningDevicesEl.appendChild(card);
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderArtifactList(artifacts) {
  if (!artifactListEl) return;
  artifactListEl.innerHTML = '';
  if (!artifacts.length) {
    const empty = document.createElement('div');
    empty.className = 'text-slate-500';
    empty.textContent = 'No builds detected.';
    artifactListEl.appendChild(empty);
    return;
  }

  for (const artifact of artifacts) {
    const row = document.createElement('div');
    row.className = 'rounded-lg border border-border bg-slate-900/40 p-2 flex items-center justify-between gap-2';

    const info = document.createElement('div');
    info.className = 'text-[11px] text-slate-300 flex-1';
    const date = artifact.mtimeMs ? new Date(artifact.mtimeMs).toLocaleString() : '';
    info.innerHTML = `<div class="font-semibold text-slate-100">${artifact.name}</div><div class="text-slate-400">${date} · ${formatBytes(artifact.size)}</div>`;

    const installBtn = document.createElement('button');
    installBtn.className = 'px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold';
    installBtn.textContent = 'Install';
    installBtn.addEventListener('click', () => {
      installArtifact(artifact.name, { launch: projectAutoLaunch?.checked });
    });

    row.appendChild(info);
    row.appendChild(installBtn);
    artifactListEl.appendChild(row);
  }
}

async function refreshArtifactsList() {
  try {
    const res = await api('/api/build/artifacts');
    if (!res.ok) {
      showToast(res.error || 'Failed to list artifacts');
      return [];
    }
    cachedArtifacts = res.artifacts ?? [];
    renderArtifactList(cachedArtifacts);
    return cachedArtifacts;
  } catch {
    showToast('Failed to list artifacts');
    return [];
  }
}

async function installArtifact(artifactName, opts = {}) {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  if (!artifactName) return showToast('No artifact selected');

  showToast('Installing APK…');
  const r = await api(
    `/api/app/install?serial=${encodeURIComponent(serial)}&artifact=${encodeURIComponent(artifactName)}`,
    { method: 'POST' }
  );
  if (!r.ok) return showToast(r.error || 'Install failed');
  showToast('Install complete');

  if (opts.launch && currentPackageName()) {
    const launchRes = await api(
      `/api/app/launch?serial=${encodeURIComponent(serial)}&pkg=${encodeURIComponent(currentPackageName())}`,
      { method: 'POST' }
    );
    if (!launchRes.ok) return showToast(launchRes.error || 'Launch failed');
    showToast('Launched');
  }
}

async function installLatestArtifact(opts = {}) {
  const artifacts = cachedArtifacts.length ? cachedArtifacts : await refreshArtifactsList();
  if (!artifacts.length) return showToast('No APKs available');
  await installArtifact(artifacts[0].name, opts);
  pendingAutoLaunch = false;
}

async function startBuild(autoInstall) {
  const form = snapshotProjectForm();
  if (!form.projectRoot || !form.buildCommand) {
    return showToast('Set project root and build command first');
  }
  pendingAutoInstall = Boolean(autoInstall);
  pendingAutoLaunch = Boolean(autoInstall && form.autoLaunch && currentPackageName());
  try {
    const res = await api('/api/build/start', { method: 'POST' });
    if (!res.ok) {
      pendingAutoInstall = false;
      return showToast(res.error || 'Build failed to start');
    }
    showToast(autoInstall ? 'Build & install started' : 'Build started');
    lastBuildStatus = 'running';
    updateBuildStatusLabel('running');
    openBuildLogStream();
    ensureBuildStatusPolling();
    await refreshBuildStatus();
  } catch {
    pendingAutoInstall = false;
    showToast('Build failed to start');
  }
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

profileSelect?.addEventListener('change', () => {
  const profiles = loadProfiles();
  const id = currentProfileId();
  const p = profiles.find((x) => x.id === id);
  if (!p) return;
  applyProfile(p);
  showToast(`Loaded profile: ${p.name || '(unnamed)'}`);
});

profileNew?.addEventListener('click', () => {
  profileSelect.value = '';
  profileName.value = '';
  apkPath.value = '';
  pkgName.value = '';
  deeplinkUrl.value = '';
  showToast('New profile');
});

profileSave?.addEventListener('click', () => {
  const form = snapshotProfileForm();
  if (!form.name) return showToast('Give the profile a name');

  const profiles = loadProfiles();
  const id = currentProfileId();
  const existingIdx = profiles.findIndex((p) => p.id === id);

  if (existingIdx >= 0) {
    profiles[existingIdx] = { ...profiles[existingIdx], ...form };
    saveProfiles(profiles);
    renderProfiles(profiles);
    showToast('Profile saved');
    return;
  }

  const next = { id: newId(), ...form };
  profiles.unshift(next);
  saveProfiles(profiles);
  renderProfiles(profiles);
  profileSelect.value = next.id;
  showToast('Profile created');
});

profileDelete?.addEventListener('click', () => {
  const id = currentProfileId();
  if (!id) return showToast('Select a profile first');
  const profiles = loadProfiles().filter((p) => p.id !== id);
  saveProfiles(profiles);
  renderProfiles(profiles);
  profileSelect.value = '';
  showToast('Profile deleted');
});

profileExport?.addEventListener('click', () => {
  const profiles = loadProfiles();
  const blob = new Blob([JSON.stringify(profiles, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'android-test-console-profiles.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported profiles');
});

profileImport?.addEventListener('change', async () => {
  const file = profileImport.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('Invalid JSON format');
    const incoming = parsed
      .filter((p) => p && typeof p === 'object')
      .map((p) => ({ id: typeof p.id === 'string' ? p.id : newId(), ...p }));
    saveProfiles(incoming);
    renderProfiles(incoming);
    showToast('Imported profiles');
  } catch (e) {
    showToast(e instanceof Error ? e.message : 'Import failed');
  } finally {
    profileImport.value = '';
  }
});

projectSave?.addEventListener('click', saveProjectToServer);
projectAutoLaunch?.addEventListener('change', () => {
  if (!projectConfig) return;
  projectConfig.autoLaunch = Boolean(projectAutoLaunch?.checked);
});

buildRunBtn?.addEventListener('click', () => startBuild(false));
buildInstallBtn?.addEventListener('click', () => startBuild(true));
installLatestBtn?.addEventListener('click', () => installLatestArtifact({ launch: projectAutoLaunch?.checked }));
refreshArtifactsBtn?.addEventListener('click', refreshArtifactsList);

buildLogClearBtn?.addEventListener('click', () => {
  if (buildLogPre) buildLogPre.textContent = '';
});

function updateBuildLogFollowButton() {
  if (!buildLogFollowBtn) return;
  buildLogFollowBtn.textContent = buildLogFollowEnabled ? 'Follow: on' : 'Follow: off';
}
updateBuildLogFollowButton();

buildLogFollowBtn?.addEventListener('click', () => {
  buildLogFollowEnabled = !buildLogFollowEnabled;
  updateBuildLogFollowButton();
  if (buildLogFollowEnabled && buildLogPre) {
    buildLogPre.scrollTop = buildLogPre.scrollHeight;
  }
  if (!buildLogWs) openBuildLogStream();
});

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

openDeeplink.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const url = deeplinkUrl.value.trim();
  if (!url) return showToast('Enter a deep link URL');
  const r = await api(`/api/app/deeplink?serial=${encodeURIComponent(serial)}&url=${encodeURIComponent(url)}`, {
    method: 'POST'
  });
  if (!r.ok) return showToast(r.error || 'Deep link failed');
  showToast('Opened');
});

wifiOn.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const r = await api(`/api/device/wifi?serial=${encodeURIComponent(serial)}&enabled=1`, { method: 'POST' });
  if (!r.ok) return showToast(r.error || 'Wi‑Fi on failed');
  showToast('Wi‑Fi on');
});

wifiOff.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const r = await api(`/api/device/wifi?serial=${encodeURIComponent(serial)}&enabled=0`, { method: 'POST' });
  if (!r.ok) return showToast(r.error || 'Wi‑Fi off failed');
  showToast('Wi‑Fi off');
});

dataOn.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const r = await api(`/api/device/data?serial=${encodeURIComponent(serial)}&enabled=1`, { method: 'POST' });
  if (!r.ok) return showToast(r.error || 'Data on failed');
  showToast('Data on');
});

dataOff.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const r = await api(`/api/device/data?serial=${encodeURIComponent(serial)}&enabled=0`, { method: 'POST' });
  if (!r.ok) return showToast(r.error || 'Data off failed');
  showToast('Data off');
});

applyNet.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const speed = netSpeed.value;
  const delay = netDelay.value;
  const r = await api(
    `/api/emulator/net?serial=${encodeURIComponent(serial)}&speed=${encodeURIComponent(speed)}&delay=${encodeURIComponent(delay)}`,
    { method: 'POST' }
  );
  if (!r.ok) return showToast(r.error || 'Network profile failed');
  showToast('Network applied');
});

applyGeo.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const lat = Number(geoLat.value);
  const lon = Number(geoLon.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return showToast('Enter lat/lon');
  const r = await api(`/api/device/geo?serial=${encodeURIComponent(serial)}&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, {
    method: 'POST'
  });
  if (!r.ok) return showToast(r.error || 'Location failed');
  showToast('Location set');
});

function syncBatteryLabel() {
  batteryLabel.textContent = `${batteryLevel.value}%`;
}
syncBatteryLabel();
batteryLevel.addEventListener('input', syncBatteryLabel);

async function applyBattery() {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const lvl = Number(batteryLevel.value);
  const charging = batteryIsCharging ? 1 : 0;
  const r = await api(
    `/api/device/battery?serial=${encodeURIComponent(serial)}&level=${encodeURIComponent(lvl)}&charging=${charging}`,
    { method: 'POST' }
  );
  if (!r.ok) return showToast(r.error || 'Battery failed');
  showToast('Battery set');
}

batteryCharging.addEventListener('click', () => {
  batteryIsCharging = true;
  showToast('Charging mode');
  applyBattery();
});

batteryDischarging.addEventListener('click', () => {
  batteryIsCharging = false;
  showToast('Discharging mode');
  applyBattery();
});

batteryReset.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const r = await api(`/api/device/battery?serial=${encodeURIComponent(serial)}&mode=reset`, { method: 'POST' });
  if (!r.ok) return showToast(r.error || 'Battery reset failed');
  showToast('Battery reset');
});

themeDark.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const r = await api(`/api/device/theme?serial=${encodeURIComponent(serial)}&mode=dark`, { method: 'POST' });
  if (!r.ok) return showToast(r.error || 'Theme failed');
  showToast('Dark mode');
});

themeLight.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const r = await api(`/api/device/theme?serial=${encodeURIComponent(serial)}&mode=light`, { method: 'POST' });
  if (!r.ok) return showToast(r.error || 'Theme failed');
  showToast('Light mode');
});

applyDisplay.addEventListener('click', async () => {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const loc = locale.value;
  const scale = Number(fontScale.value);
  if (!Number.isFinite(scale)) return showToast('Enter a font scale');

  const r1 = await api(`/api/device/locale?serial=${encodeURIComponent(serial)}&locale=${encodeURIComponent(loc)}`, { method: 'POST' });
  if (!r1.ok) return showToast(r1.error || 'Locale failed');
  const r2 = await api(`/api/device/font-scale?serial=${encodeURIComponent(serial)}&scale=${encodeURIComponent(scale)}`, { method: 'POST' });
  if (!r2.ok) return showToast(r2.error || 'Font scale failed');
  showToast('Display applied');
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

  const ms = Math.max(80, Math.min(2000, Number(intervalMs.value || 180)));

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

async function sendKeyAction(action, label) {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const r = await api(
    `/api/device/keyevent?serial=${encodeURIComponent(serial)}&action=${encodeURIComponent(action)}`,
    {
      method: 'POST'
    }
  );
  if (!r.ok) return showToast(r.error || 'Key event failed');
  showToast(label);
}

[
  [navBack, 'back', 'Back'],
  [navHome, 'home', 'Home'],
  [navOverview, 'overview', 'Overview'],
  [navVolDown, 'vol_down', 'Volume down'],
  [navVolUp, 'vol_up', 'Volume up'],
  [navPower, 'power', 'Power']
].forEach(([btn, action, label]) => {
  if (!btn) return;
  btn.addEventListener('click', () => {
    sendKeyAction(action, label);
  });
});

async function rotateDevice(mode, label) {
  const serial = selectedSerial();
  if (!serial) return showToast('Pick a device first');
  const r = await api(
    `/api/device/rotate?serial=${encodeURIComponent(serial)}&mode=${encodeURIComponent(mode)}`,
    { method: 'POST' }
  );
  if (!r.ok) return showToast(r.error || 'Rotate failed');
  showToast(label);
}

if (controlRotatePortrait) {
  controlRotatePortrait.addEventListener('click', () => rotateDevice('portrait', 'Portrait'));
}
if (controlRotateLandscape) {
  controlRotateLandscape.addEventListener('click', () => rotateDevice('landscape', 'Landscape'));
}

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
  if (buildLogWs) {
    buildLogWs.close();
    buildLogWs = null;
  }
});

renderProfiles(loadProfiles());
fetchProjectConfig();
refreshArtifactsList();
openBuildLogStream();
refreshBuildStatus();
ensureBuildStatusPolling();
refreshAll();

// Keep the target list current without manual refresh.
window.setInterval(refreshAll, 3000);


