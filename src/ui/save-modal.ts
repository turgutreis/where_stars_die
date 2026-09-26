import { STATE } from '../core/state';
import { 
    listAllSaves, 
    getLatestSave, 
    saveToSlot, 
    loadFromSlot, 
    deleteSaveSlot, 
    PLAYTEST_PRESETS, 
    loadPlaytestPreset,
    SaveMeta 
} from '../systems/save-manager';
import { addLogEntry } from './hud';

let isSaveModalOpen = false;

export function initSaveModal(onStartGameCallback?: () => void) {
    const continueBtn = document.getElementById('continue-game-btn');
    const saveProfilesBtn = document.getElementById('save-profiles-btn');
    const closeBtn = document.getElementById('close-save-modal-btn');
    const tabSlotsBtn = document.getElementById('save-tab-slots-btn');
    const tabPresetsBtn = document.getElementById('save-tab-presets-btn');

    // In-Game Options quick save / open buttons
    const optQuickSaveBtn = document.getElementById('opt-quick-save-btn');
    const optOpenSavesBtn = document.getElementById('opt-open-saves-btn');

    if (continueBtn) {
        continueBtn.addEventListener('click', async () => {
            const latest = await getLatestSave();
            if (latest) {
                const res = await loadFromSlot(latest.slotId);
                if (res.success) {
                    const mainMenu = document.getElementById('main-menu');
                    if (mainMenu) mainMenu.style.display = 'none';
                    STATE.gameStarted = true;
                    if (onStartGameCallback) onStartGameCallback();
                }
            }
        });
    }

    if (saveProfilesBtn) {
        saveProfilesBtn.addEventListener('click', () => {
            openSaveModal('slots');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeSaveModal();
        });
    }

    if (tabSlotsBtn && tabPresetsBtn) {
        tabSlotsBtn.addEventListener('click', () => {
            switchSaveTab('slots');
        });
        tabPresetsBtn.addEventListener('click', () => {
            switchSaveTab('presets');
        });
    }

    if (optQuickSaveBtn) {
        optQuickSaveBtn.addEventListener('click', async () => {
            await saveToSlot('slot_1', `Schnellspeicherstand (${STATE.currentSystemId === 1 ? 'Sol Invictus' : 'Sektor ' + STATE.currentSystemId})`);
            checkAndUpdateContinueButton();
            renderSaveSlotsUI();
        });
    }

    if (optOpenSavesBtn) {
        optOpenSavesBtn.addEventListener('click', () => {
            const optModal = document.getElementById('options-modal');
            if (optModal) optModal.style.display = 'none';
            openSaveModal('slots');
        });
    }

    // Initial check for existing saves to configure the Continue button
    checkAndUpdateContinueButton();
}

export async function checkAndUpdateContinueButton() {
    const continueBtn = document.getElementById('continue-game-btn');
    const continueText = document.getElementById('continue-game-text');
    if (!continueBtn) return;

    try {
        const latest = await getLatestSave();
        if (latest) {
            continueBtn.style.display = 'flex';
            if (continueText) {
                continueText.innerHTML = `✨ <strong>Reise fortsetzen</strong> <span class="continue-meta">(${latest.systemName} • ${latest.crewCount}/${latest.maxCrewCapacity} Besatzung)</span>`;
            }
        } else {
            continueBtn.style.display = 'none';
        }
    } catch (e) {
        continueBtn.style.display = 'none';
    }
}

export function openSaveModal(initialTab: 'slots' | 'presets' = 'slots') {
    const modal = document.getElementById('save-load-modal');
    if (!modal) return;

    isSaveModalOpen = true;
    modal.style.display = 'flex';
    switchSaveTab(initialTab);
    renderSaveSlotsUI();
    renderPresetsUI();
}

export function closeSaveModal() {
    const modal = document.getElementById('save-load-modal');
    if (!modal) return;
    isSaveModalOpen = false;
    modal.style.display = 'none';
}

function switchSaveTab(tab: 'slots' | 'presets') {
    const tabSlotsBtn = document.getElementById('save-tab-slots-btn');
    const tabPresetsBtn = document.getElementById('save-tab-presets-btn');
    const contentSlots = document.getElementById('save-tab-slots-content');
    const contentPresets = document.getElementById('save-tab-presets-content');

    if (tabSlotsBtn) tabSlotsBtn.classList.toggle('active', tab === 'slots');
    if (tabPresetsBtn) tabPresetsBtn.classList.toggle('active', tab === 'presets');
    if (contentSlots) contentSlots.classList.toggle('active', tab === 'slots');
    if (contentPresets) contentPresets.classList.toggle('active', tab === 'presets');
}

export async function renderSaveSlotsUI() {
    const container = document.getElementById('save-slots-container');
    if (!container) return;

    const allSaves = await listAllSaves();
    const savesBySlot: Record<string, SaveMeta> = {};
    allSaves.forEach(s => {
        savesBySlot[s.slotId] = s;
    });

    const slotConfigs = [
        { id: 'autosave', title: '⚡ Automatischer Speicherstand', desc: 'Sichert automatisch bei Hyperraum-Sprung & Evolutionen' },
        { id: 'slot_1', title: '💾 Speicherstand Slot 1', desc: 'Manueller Speicherplatz' },
        { id: 'slot_2', title: '💾 Speicherstand Slot 2', desc: 'Manueller Speicherplatz' },
        { id: 'slot_3', title: '💾 Speicherstand Slot 3', desc: 'Manueller Speicherplatz' }
    ];

    container.innerHTML = '';

    slotConfigs.forEach(slot => {
        const save = savesBySlot[slot.id];
        const card = document.createElement('div');
        card.className = `save-slot-card ${save ? 'has-data' : 'empty'}`;

        if (save) {
            const doctrineLabel = save.primaryParadigm === 'symbiosis' ? '🌱 Symbiose' 
                : (save.primaryParadigm === 'domination' ? '⚡ Herrschaft' 
                : (save.primaryParadigm === 'deception' ? '🔮 Täuschung' : '💫 Neutral'));

            card.innerHTML = `
                <div class="save-slot-main">
                    <div class="slot-header-row">
                        <span class="slot-title">${slot.title}</span>
                        <span class="slot-date">📅 ${save.dateFormatted}</span>
                    </div>
                    <div class="slot-name-highlight">${save.name}</div>
                    <div class="slot-stats-row">
                        <span class="slot-stat-chip">🪐 ${save.systemName}</span>
                        <span class="slot-stat-chip">👥 ${save.crewCount}/${save.maxCrewCapacity} Besatzung</span>
                        <span class="slot-stat-chip">🧬 ${save.bioRes} Bio &bull; 💎 ${save.siliconRes} Sil</span>
                        <span class="slot-stat-chip doctrine">${doctrineLabel}</span>
                        <span class="slot-stat-chip health">❤️ ${save.health}% HP</span>
                    </div>
                </div>
                <div class="save-slot-actions">
                    <button class="slot-action-btn load-btn" data-slot="${slot.id}">
                        <span>▶</span> Laden
                    </button>
                    ${STATE.gameStarted ? `
                    <button class="slot-action-btn overwrite-btn" data-slot="${slot.id}">
                        <span>💾</span> Überschreiben
                    </button>` : ''}
                    <button class="slot-action-btn delete-btn" data-slot="${slot.id}" title="Löschen">
                        ✕
                    </button>
                </div>
            `;
        } else {
            card.innerHTML = `
                <div class="save-slot-main">
                    <div class="slot-header-row">
                        <span class="slot-title">${slot.title}</span>
                        <span class="slot-empty-badge">LEER</span>
                    </div>
                    <div class="slot-desc-sub">${slot.desc}</div>
                </div>
                <div class="save-slot-actions">
                    ${STATE.gameStarted ? `
                    <button class="slot-action-btn save-btn" data-slot="${slot.id}">
                        <span>💾</span> Jetzt Speichern
                    </button>` : `
                    <span class="slot-hint-text">Im Spiel speicherbar</span>`}
                </div>
            `;
        }

        container.appendChild(card);
    });

    // Attach Event Listeners to dynamic action buttons
    container.querySelectorAll('.load-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const slotId = (e.currentTarget as HTMLElement).getAttribute('data-slot');
            if (slotId) {
                const res = await loadFromSlot(slotId);
                if (res.success) {
                    closeSaveModal();
                    const mainMenu = document.getElementById('main-menu');
                    if (mainMenu) mainMenu.style.display = 'none';
                    STATE.gameStarted = true;
                }
            }
        });
    });

    container.querySelectorAll('.save-btn, .overwrite-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const slotId = (e.currentTarget as HTMLElement).getAttribute('data-slot');
            if (slotId) {
                await saveToSlot(slotId);
                checkAndUpdateContinueButton();
                renderSaveSlotsUI();
            }
        });
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const slotId = (e.currentTarget as HTMLElement).getAttribute('data-slot');
            if (slotId) {
                await deleteSaveSlot(slotId);
                checkAndUpdateContinueButton();
                renderSaveSlotsUI();
            }
        });
    });
}

export function renderPresetsUI() {
    const container = document.getElementById('presets-container');
    if (!container) return;

    container.innerHTML = '';

    Object.keys(PLAYTEST_PRESETS).forEach(key => {
        const preset = PLAYTEST_PRESETS[key];
        const card = document.createElement('div');
        card.className = `preset-card preset-${preset.id}`;

        card.innerHTML = `
            <div class="preset-card-top">
                <div class="preset-badge">${preset.badge}</div>
                <h3 class="preset-title">${preset.name}</h3>
                <p class="preset-desc">${preset.description}</p>
            </div>

            <div class="preset-specs-list">
                <div class="preset-spec-item">
                    <span class="spec-label">👥 Besatzungs-Größe:</span>
                    <span class="spec-val highlight">${preset.targetCrew} / ${preset.capacity} Individuen</span>
                </div>
                <div class="preset-spec-item">
                    <span class="spec-label">🧪 Ressourcen-Vorrat:</span>
                    <span class="spec-val">${preset.resources.bio} Bio &bull; ${preset.resources.silicon} Silizium</span>
                </div>
                <div class="preset-spec-item">
                    <span class="spec-label">🧬 Mutationen freigeschaltet:</span>
                    <span class="spec-val">${preset.mutations.length} Synapsen-Knoten</span>
                </div>
                <div class="preset-spec-item">
                    <span class="spec-label">⚡ Paradigma:</span>
                    <span class="spec-val">${preset.paradigm.toUpperCase()}</span>
                </div>
            </div>

            <button class="preset-launch-btn" data-preset="${preset.id}">
                <span>🚀</span> Profil laden &amp; starten
            </button>
        `;

        container.appendChild(card);
    });

    container.querySelectorAll('.preset-launch-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const presetId = (e.currentTarget as HTMLElement).getAttribute('data-preset');
            if (presetId) {
                const ok = await loadPlaytestPreset(presetId);
                if (ok) {
                    closeSaveModal();
                    const mainMenu = document.getElementById('main-menu');
                    if (mainMenu) mainMenu.style.display = 'none';
                    STATE.gameStarted = true;
                    addLogEntry("SYSTEM", `Playtest-Preset "${presetId}" initialisiert. Flugbereit!`);
                }
            }
        });
    });
}
