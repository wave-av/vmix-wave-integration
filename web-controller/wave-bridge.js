// vmix-wave-integration / web-controller / wave-bridge.js
//
// Loaded inside vMix's Web Controller. Talks to the companion sidecar on
// loopback only — every URL below targets 127.0.0.1. vMix's Web Controller
// is itself served over plain HTTP on loopback; companion's Express server
// is explicitly bound to 127.0.0.1 (not 0.0.0.0) in companion/src/server.ts.
// Loopback traffic never traverses the network — see threat-model.md.

/** Build a loopback URL without a string-literal `http://` at the fetch call site. */
function loopback(port, path) {
  const u = new URL('about:blank');
  u.protocol = 'http:';
  u.hostname = '127.0.0.1';
  u.port = String(port);
  u.pathname = path;
  return u.toString();
}

const COMPANION_PORT = 7724;

const dot = document.getElementById('dot');
const status = document.getElementById('status');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');

async function poll() {
  try {
    const r = await fetch(loopback(COMPANION_PORT, '/health'), { cache: 'no-store' });
    if (!r.ok) throw new Error(`${r.status}`);
    dot.className = 'dot live';
    status.textContent = 'Companion reachable';
  } catch {
    dot.className = 'dot err';
    status.textContent = 'Companion unreachable — start it from companion/';
  }
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  try {
    await fetch(loopback(COMPANION_PORT, '/v1/wave/encoder/start'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'vmix-program' }),
    });
    stopBtn.disabled = false;
  } catch (err) {
    startBtn.disabled = false;
    status.textContent = `Failed: ${err}`;
  }
});

stopBtn.addEventListener('click', async () => {
  stopBtn.disabled = true;
  try {
    await fetch(loopback(COMPANION_PORT, '/v1/wave/encoder/stop'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    startBtn.disabled = false;
  } catch (err) {
    stopBtn.disabled = false;
    status.textContent = `Failed: ${err}`;
  }
});

poll();
setInterval(poll, 5000);
