const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// ── Globals ─────────────────────────────────────────────────────────────────
let tray, overlay;
let overlayReady = false;
let spawnQueued = false;

function createTrayIcon() {
  const p = path.join(__dirname, 'icon', 'Template.png');
  if (fs.existsSync(p)) {
    let img = nativeImage.createFromPath(p);
    if (!img.isEmpty()) {
      img = img.resize({ width: 18, height: 18 });
      img.setTemplateImage(false);
      return img;
    }
  }
  console.warn('openjensen: icon/Template.png missing or invalid');
  return nativeImage.createEmpty();
}

// ── Overlay window ──────────────────────────────────────────────────────────
function createOverlay() {
  const { bounds } = screen.getPrimaryDisplay();
  overlay = new BrowserWindow({
    x: bounds.x, y: bounds.y,
    width: bounds.width, height: bounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setIgnoreMouseEvents(true);
  overlayReady = false;
  overlay.loadFile('overlay.html');
  overlay.webContents.on('did-finish-load', () => {
    overlayReady = true;
    if (spawnQueued && overlay && overlay.isVisible()) {
      spawnQueued = false;
      overlay.webContents.send('spawn-whip');
    }
  });
  overlay.on('closed', () => {
    overlay = null;
    overlayReady = false;
    spawnQueued = false;
  });
}

function toggleOverlay() {
  if (overlay && overlay.isVisible()) {
    overlay.hide();
    return;
  }
  if (!overlay) createOverlay();
  overlay.show();
  if (overlayReady) {
    overlay.webContents.send('spawn-whip');
  } else {
    spawnQueued = true;
  }
}

function triggerCrack() {
  // Play sound + visual if Jensen is visible
  if (overlay && overlay.isVisible() && overlayReady) {
    overlay.webContents.send('crack');
  }
  // Always send the macro to the focused app
  try {
    sendMacro();
  } catch (err) {
    console.warn('sendMacro failed:', err?.message || err);
  }
}

// ── IPC ─────────────────────────────────────────────────────────────────────
ipcMain.on('whip-crack', () => {
  try {
    sendMacro();
  } catch (err) {
    console.warn('sendMacro failed:', err?.message || err);
  }
});
ipcMain.on('hide-overlay', () => { if (overlay) overlay.hide(); });
ipcMain.on('get-cursor-position', (event) => {
  event.returnValue = screen.getCursorScreenPoint();
});

// ── Macro: Ctrl+C interrupt, clear line, type Jensen quote, Enter ─────────
function sendMacro() {
  const phrases = [
    "Smart people focus on the right things.",
    "Never stop asking questions and seeking answers. Curiosity fuels progress.",
    "The most powerful technologies are the ones that empower others.",
    "Success is a work in progress. It's not about achieving a goal; it's about constantly improving and pushing boundaries.",
    "Failure is not the end, it's an opportunity to learn and grow.",
    "Great ideas can come from anyone, anywhere. It's about creating an environment where those ideas can flourish.",
    "Software is eating the world, but AI is going to eat software.",
    "Innovation is not about inventing something new, it's about improving what already exists.",
    "Leadership is about setting the stage for others to shine.",
    "Don't be afraid to think different and challenge the status quo.",
    "We have a responsibility to use technology to make the world a better place.",
    "Embrace the unknown and embrace change. That's where true breakthroughs happen.",
    "True innovation requires taking risks and being willing to fail.",
    "Open collaboration and partnership are the keys to driving progress and innovation.",
    "I appreciate people who are authentic. They are just who they are.",
    "The world needs more dreamers and doers, not just talkers.",
  ];
  const chosen = phrases[Math.floor(Math.random() * phrases.length)].toUpperCase();

  const escaped = chosen.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const interruptScript = [
    'tell application "System Events"',
    '  key code 8 using {control down}', // Ctrl+C interrupt
    'end tell'
  ].join('\n');
  const clearAndTypeScript = [
    'tell application "System Events"',
    '  key code 32 using {control down}', // Ctrl+U — clear line
    `  keystroke "${escaped}"`,
    '  key code 36', // Enter
    'end tell'
  ].join('\n');

  execFile('osascript', ['-e', interruptScript], err => {
    if (err) {
      console.warn('macro failed (enable Accessibility for terminal/app):', err.message);
      return;
    }

    setTimeout(() => {
      execFile('osascript', ['-e', clearAndTypeScript], err2 => {
        if (err2) {
          console.warn('macro failed (enable Accessibility for terminal/app):', err2.message);
        }
      });
    }, 300);
  });
}

// ── App lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('OpenJensen - click for Jensen');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Quit', click: () => app.quit() },
    ])
  );
  tray.on('click', toggleOverlay);

  globalShortcut.register('Command+Shift+J', triggerCrack);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', e => e.preventDefault()); // keep alive in tray
