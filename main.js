const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "Najmafar: Pillars of The Void",
        backgroundColor: '#030712',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile('index.html');
    win.setMenuBarVisibility(false);

    win.webContents.on('console-message', (event, level, message) => {
        console.log(`[Renderer] ${message}`);
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handler for Quantum Universe Generation
ipcMain.handle('generate-universe', async (event, apiKey, useQpu) => {
    return new Promise((resolve) => {
        // Build terminal command
        // We use python3 (macOS standard)
        let cmd = `python3 generate_universe.py`;
        if (apiKey) {
            // Escape double quotes to prevent shell injection
            const cleanKey = apiKey.replace(/"/g, '\\"');
            cmd += ` --api-key "${cleanKey}"`;
        }
        if (useQpu) {
            cmd += ` --qpu`;
        }

        console.log("Najmafar: Running command:", cmd);

        exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
            if (error) {
                console.error("Najmafar: Generation error:", error);
                resolve({ success: false, error: stderr || error.message });
            } else {
                console.log("Najmafar: Generation success:\n", stdout);
                resolve({ success: true, log: stdout });
            }
        });
    });
});

// IPC Handler to Load Universe Data reliably from disk
ipcMain.handle('load-universe-data', async () => {
    try {
        const filePath = path.join(__dirname, 'universe_data.json');
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf-8');
            return { success: true, data: JSON.parse(raw) };
        }
        return { success: false, error: 'universe_data.json not found on disk' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Saves directory helper
function getSavesDir() {
    const savesDir = path.join(app.getPath('userData'), 'saves');
    if (!fs.existsSync(savesDir)) {
        fs.mkdirSync(savesDir, { recursive: true });
    }
    return savesDir;
}

// IPC Handler to Save Game Slot
ipcMain.handle('save-game', async (event, slotId, dataString) => {
    try {
        const savesDir = getSavesDir();
        const safeSlot = slotId.replace(/[^a-zA-Z0-9_-]/g, '');
        const filePath = path.join(savesDir, `${safeSlot}.json`);
        fs.writeFileSync(filePath, dataString, 'utf-8');
        return { success: true, slotId: safeSlot };
    } catch (e) {
        console.error("Save game error:", e);
        return { success: false, error: e.message };
    }
});

// IPC Handler to Load Game Slot
ipcMain.handle('load-game', async (event, slotId) => {
    try {
        const savesDir = getSavesDir();
        const safeSlot = slotId.replace(/[^a-zA-Z0-9_-]/g, '');
        const filePath = path.join(savesDir, `${safeSlot}.json`);
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf-8');
            return { success: true, data: raw };
        }
        return { success: false, error: `Save slot ${slotId} not found` };
    } catch (e) {
        console.error("Load game error:", e);
        return { success: false, error: e.message };
    }
});

// IPC Handler to List All Saves
ipcMain.handle('list-saves', async () => {
    try {
        const savesDir = getSavesDir();
        const files = fs.readdirSync(savesDir).filter(f => f.endsWith('.json'));
        const saves = [];
        for (const f of files) {
            try {
                const raw = fs.readFileSync(path.join(savesDir, f), 'utf-8');
                const parsed = JSON.parse(raw);
                saves.push({
                    slotId: f.replace('.json', ''),
                    meta: parsed.meta || {},
                    timestamp: parsed.timestamp || 0
                });
            } catch (err) {
                // skip corrupted
            }
        }
        return { success: true, saves };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// IPC Handler to Delete Save Slot
ipcMain.handle('delete-save', async (event, slotId) => {
    try {
        const savesDir = getSavesDir();
        const safeSlot = slotId.replace(/[^a-zA-Z0-9_-]/g, '');
        const filePath = path.join(savesDir, `${safeSlot}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return { success: true };
        }
        return { success: false, error: 'File not found' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// IPC Listener to Close App
ipcMain.on('close-app', () => {
    app.quit();
});

