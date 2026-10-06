import * as THREE from 'three';
import { STATE } from '../core/state';
import { CrewMember } from '../types/game';
import { calculateCrewBuffs, renderCrewUI } from './crew';
import { updatePartyGrid } from '../ui/party-grid';
import { updateHUDStats, addLogEntry } from '../ui/hud';
import { reapplyAllMutations } from '../ui/deck';
import { clearActiveSystem, spawnPlanetsAndAsteroids } from './universe';

export interface SaveMeta {
    slotId: string;
    name: string;
    timestamp: number;
    dateFormatted: string;
    systemName: string;
    systemId: number;
    crewCount: number;
    maxCrewCapacity: number;
    bioRes: number;
    siliconRes: number;
    primaryParadigm: string;
    activeDoctrine: string;
    health: number;
    playTimeFormatted: string;
    version: number;
    isPreset?: boolean;
}

export interface SerializedGameState {
    version: number;
    timestamp: number;
    meta: SaveMeta;
    vitals: {
        health: number;
        maxHealth: number;
        bioEnergy: number;
        maxBioEnergy: number;
        mentalEnergy: number;
        maxMentalEnergy: number;
        loneliness: number;
        bioRes: number;
        siliconRes: number;
    };
    navigation: {
        currentSystemId: number;
        visitedSystemIds: number[];
        systemsVisited: number;
        playerPosition: { x: number; y: number; z: number };
        playerVelocity: { x: number; y: number; z: number };
        shipHeading: number;
    };
    paradigms: {
        primaryParadigm: string;
        activeSubCodex: string;
        firstContactResolved?: boolean;
        paradigmModifiers?: any;
    };
    mutations: Record<string, { purchased: boolean; bioCost?: number; siliconCost?: number }>;
    maxCrewCapacity: number;
    crew: CrewMember[];
    scannedPlanets: Record<string, any>;
    depletedPlanets: Record<string, boolean>;
    voyager: {
        detected: boolean;
        scanned: boolean;
        dialogSeen: boolean;
    };
    ftue: {
        step: number;
        completed: boolean;
    };
    reputation?: Record<string, number>;
}

const SAVE_STORAGE_PREFIX = 'najmafar_save_';
const SAVE_INDEX_KEY = 'najmafar_saves_index';
let lastAutoSaveTime = 0;
const AUTO_SAVE_THROTTLE_MS = 4000;

function formatTimestamp(ts: number): string {
    const d = new Date(ts);
    return `${d.toLocaleDateString('de-DE')} ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
}

function getSystemName(sysId: number): string {
    if (STATE.universe && STATE.universe.systems) {
        const s = STATE.universe.systems.find((sys: any) => sys.id === sysId);
        if (s) return s.name;
    }
    return sysId === 1 ? 'Sol Invictus' : `Sektor ${sysId}`;
}

export function serializeCurrentState(slotId: string, customName?: string): SerializedGameState {
    const now = Date.now();
    const sysName = getSystemName(STATE.currentSystemId);
    const paradigm = STATE.primaryParadigm || 'neutral';
    const doctrine = STATE.activeSubCodex || 'none';

    // Clone mutations map safely
    const serializedMutations: Record<string, { purchased: boolean; bioCost?: number; siliconCost?: number }> = {};
    if (STATE.mutations) {
        Object.keys(STATE.mutations).forEach(k => {
            const m = (STATE.mutations as any)[k];
            if (m) {
                serializedMutations[k] = {
                    purchased: Boolean(m.purchased),
                    bioCost: m.bioCost,
                    siliconCost: m.siliconCost
                };
            }
        });
    }

    const meta: SaveMeta = {
        slotId,
        name: customName || (slotId === 'autosave' ? `Auto-Save: ${sysName}` : `Spielstand (${sysName})`),
        timestamp: now,
        dateFormatted: formatTimestamp(now),
        systemName: sysName,
        systemId: STATE.currentSystemId,
        crewCount: STATE.crew ? STATE.crew.length : 0,
        maxCrewCapacity: STATE.maxCrewCapacity || 4,
        bioRes: Math.floor(STATE.bioRes || 0),
        siliconRes: Math.floor(STATE.siliconRes || 0),
        primaryParadigm: paradigm,
        activeDoctrine: doctrine,
        health: Math.round(STATE.health || 100),
        playTimeFormatted: '00:00',
        version: 1
    };

    return {
        version: 1,
        timestamp: now,
        meta,
        vitals: {
            health: STATE.health,
            maxHealth: STATE.maxHealth,
            bioEnergy: STATE.bioEnergy,
            maxBioEnergy: STATE.maxBioEnergy,
            mentalEnergy: STATE.mentalEnergy,
            maxMentalEnergy: STATE.maxMentalEnergy,
            loneliness: STATE.loneliness,
            bioRes: STATE.bioRes,
            siliconRes: STATE.siliconRes
        },
        navigation: {
            currentSystemId: STATE.currentSystemId,
            visitedSystemIds: STATE.visitedSystemIds ? [...STATE.visitedSystemIds] : [STATE.currentSystemId],
            systemsVisited: STATE.systemsVisited || 1,
            playerPosition: {
                x: STATE.playerPosition ? STATE.playerPosition.x : 0,
                y: STATE.playerPosition ? STATE.playerPosition.y : 0,
                z: STATE.playerPosition ? STATE.playerPosition.z : 95
            },
            playerVelocity: {
                x: STATE.playerVelocity ? STATE.playerVelocity.x : 0,
                y: STATE.playerVelocity ? STATE.playerVelocity.y : 0,
                z: STATE.playerVelocity ? STATE.playerVelocity.z : 0
            },
            shipHeading: STATE.shipHeading || 0
        },
        paradigms: {
            primaryParadigm: paradigm,
            activeSubCodex: doctrine,
            firstContactResolved: (STATE as any).firstContactResolved || false,
            paradigmModifiers: STATE.paradigmModifiers ? { ...STATE.paradigmModifiers } : {}
        },
        mutations: serializedMutations,
        maxCrewCapacity: STATE.maxCrewCapacity || 4,
        crew: STATE.crew ? JSON.parse(JSON.stringify(STATE.crew)) : [],
        scannedPlanets: STATE.scannedPlanets ? JSON.parse(JSON.stringify(STATE.scannedPlanets)) : {},
        depletedPlanets: STATE.depletedPlanets ? JSON.parse(JSON.stringify(STATE.depletedPlanets)) : {},
        voyager: {
            detected: Boolean(STATE.voyagerSignalDetected),
            scanned: Boolean(STATE.voyagerScanned),
            dialogSeen: Boolean(STATE.voyagerDialogSeen)
        },
        ftue: {
            step: STATE.ftueStep || 0,
            completed: Boolean(STATE.ftueCompleted)
        },
        reputation: STATE.reputation ? { ...STATE.reputation } : {}
    };
}

export async function saveToSlot(slotId: string, customName?: string): Promise<{ success: boolean; meta?: SaveMeta; error?: string }> {
    try {
        const data = serializeCurrentState(slotId, customName);
        const jsonStr = JSON.stringify(data);

        // 1. Electron File-System Save via window.api
        const api = (window as any).api;
        if (api && typeof api.saveGame === 'function') {
            await api.saveGame(slotId, jsonStr);
        }

        // 2. Browser Storage Backup & Indexing
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(SAVE_STORAGE_PREFIX + slotId, jsonStr);
            updateLocalSaveIndex(data.meta);
        }

        showSaveToast(`💾 Spielstand gesichert: ${data.meta.name}`);
        return { success: true, meta: data.meta };
    } catch (e: any) {
        console.error("Save error:", e);
        return { success: false, error: e.message || String(e) };
    }
}

export async function loadFromSlot(slotId: string): Promise<{ success: boolean; error?: string }> {
    try {
        let jsonStr: string | null = null;

        // 1. Try Electron File System
        const api = (window as any).api;
        if (api && typeof api.loadGame === 'function') {
            const res = await api.loadGame(slotId);
            if (res && res.success && res.data) {
                jsonStr = res.data;
            }
        }

        // 2. Fallback to LocalStorage
        if (!jsonStr && typeof localStorage !== 'undefined') {
            jsonStr = localStorage.getItem(SAVE_STORAGE_PREFIX + slotId);
        }

        if (!jsonStr) {
            return { success: false, error: `Speicher-Slot "${slotId}" nicht gefunden.` };
        }

        const data: SerializedGameState = JSON.parse(jsonStr);
        await applyLoadedState(data);
        showSaveToast(`🧬 Spielstand geladen: ${data.meta?.name || slotId}`);
        return { success: true };
    } catch (e: any) {
        console.error("Load error:", e);
        return { success: false, error: e.message || String(e) };
    }
}

export async function applyLoadedState(data: SerializedGameState): Promise<void> {
    if (!data || !data.vitals) {
        throw new Error("Ungültiges Speicherdaten-Format.");
    }

    // 1. Vitals
    STATE.health = data.vitals.health;
    STATE.maxHealth = data.vitals.maxHealth || 100;
    STATE.bioEnergy = data.vitals.bioEnergy;
    STATE.maxBioEnergy = data.vitals.maxBioEnergy || 100;
    STATE.mentalEnergy = data.vitals.mentalEnergy;
    STATE.maxMentalEnergy = data.vitals.maxMentalEnergy || 100;
    STATE.loneliness = data.vitals.loneliness;
    STATE.bioRes = data.vitals.bioRes;
    STATE.siliconRes = data.vitals.siliconRes;

    // 2. Mutations
    if (data.mutations) {
        Object.keys(data.mutations).forEach(k => {
            if ((STATE.mutations as any)[k]) {
                (STATE.mutations as any)[k].purchased = data.mutations[k].purchased;
            }
        });
    }

    // 3. Crew & Capacity
    STATE.maxCrewCapacity = data.maxCrewCapacity || 4;
    STATE.crew = Array.isArray(data.crew) ? data.crew : [];
    calculateCrewBuffs();

    // 4. Paradigms & Triad Doctrines
    if (data.paradigms) {
        STATE.primaryParadigm = (data.paradigms.primaryParadigm as any) || 'neutral';
        STATE.activeSubCodex = (data.paradigms.activeSubCodex as any) || 'none';
        if (data.paradigms.firstContactResolved !== undefined) {
            (STATE as any).firstContactResolved = data.paradigms.firstContactResolved;
        }
        if (data.paradigms.paradigmModifiers) {
            STATE.paradigmModifiers = { ...data.paradigms.paradigmModifiers };
        }
    }

    // 5. Exploration & Planetary Records
    if (data.scannedPlanets) STATE.scannedPlanets = data.scannedPlanets;
    if (data.depletedPlanets) STATE.depletedPlanets = data.depletedPlanets;
    if (data.voyager) {
        STATE.voyagerSignalDetected = data.voyager.detected;
        STATE.voyagerScanned = data.voyager.scanned;
        STATE.voyagerDialogSeen = data.voyager.dialogSeen;
    }
    if (data.ftue) {
        STATE.ftueStep = data.ftue.step;
        STATE.ftueCompleted = data.ftue.completed;
    }
    if (data.reputation) {
        STATE.reputation = { ...data.reputation } as any;
    }

    // 6. Navigation & Celestial System
    const targetSysId = data.navigation ? data.navigation.currentSystemId : 1;
    STATE.visitedSystemIds = data.navigation && data.navigation.visitedSystemIds ? data.navigation.visitedSystemIds : [targetSysId];
    STATE.systemsVisited = data.navigation ? data.navigation.systemsVisited : 1;

    // Reposition Player
    if (data.navigation && data.navigation.playerPosition) {
        STATE.playerPosition.set(
            data.navigation.playerPosition.x,
            data.navigation.playerPosition.y,
            data.navigation.playerPosition.z
        );
    }
    if (data.navigation && data.navigation.playerVelocity) {
        STATE.playerVelocity.set(
            data.navigation.playerVelocity.x,
            data.navigation.playerVelocity.y,
            data.navigation.playerVelocity.z
        );
    }
    STATE.shipHeading = data.navigation ? (data.navigation.shipHeading || 0) : 0;
    if (STATE.playerGroup) {
        STATE.playerGroup.position.copy(STATE.playerPosition);
        STATE.playerGroup.rotation.y = STATE.shipHeading;
    }

    // System change if necessary
    if (STATE.currentSystemId !== targetSysId) {
        STATE.currentSystemId = targetSysId;
        clearActiveSystem();
        spawnPlanetsAndAsteroids();
    }

    // Reapply passive mutation perks
    reapplyAllMutations();

    // 7. Refresh UI
    updatePartyGrid();
    renderCrewUI(true);
    updateHUDStats();

    addLogEntry("SYSTEM", `Reise fortgesetzt: ${data.meta?.name || 'Spielstand geladen'}`);
}

export async function listAllSaves(): Promise<SaveMeta[]> {
    const savesMap: Map<string, SaveMeta> = new Map();

    // 1. Electron Saves
    const api = (window as any).api;
    if (api && typeof api.listSaves === 'function') {
        try {
            const res = await api.listSaves();
            if (res && res.success && Array.isArray(res.saves)) {
                res.saves.forEach((s: any) => {
                    if (s.meta && s.slotId) {
                        savesMap.set(s.slotId, {
                            ...s.meta,
                            slotId: s.slotId
                        });
                    }
                });
            }
        } catch (e) {
            console.warn("Electron listSaves failed, falling back to localStorage", e);
        }
    }

    // 2. LocalStorage Saves
    if (typeof localStorage !== 'undefined') {
        try {
            const rawIdx = localStorage.getItem(SAVE_INDEX_KEY);
            if (rawIdx) {
                const list: SaveMeta[] = JSON.parse(rawIdx);
                list.forEach(item => {
                    if (item.slotId && !savesMap.has(item.slotId)) {
                        savesMap.set(item.slotId, item);
                    }
                });
            }
        } catch (err) {}
    }

    const result = Array.from(savesMap.values());
    // Sort newest first
    result.sort((a, b) => b.timestamp - a.timestamp);
    return result;
}

export async function getLatestSave(): Promise<SaveMeta | null> {
    const all = await listAllSaves();
    return all.length > 0 ? all[0] : null;
}

export async function deleteSaveSlot(slotId: string): Promise<boolean> {
    const api = (window as any).api;
    if (api && typeof api.deleteSave === 'function') {
        await api.deleteSave(slotId);
    }
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SAVE_STORAGE_PREFIX + slotId);
        removeLocalSaveIndex(slotId);
    }
    return true;
}

function updateLocalSaveIndex(meta: SaveMeta) {
    if (typeof localStorage === 'undefined') return;
    try {
        let index: SaveMeta[] = [];
        const raw = localStorage.getItem(SAVE_INDEX_KEY);
        if (raw) index = JSON.parse(raw);
        index = index.filter(m => m.slotId !== meta.slotId);
        index.unshift(meta);
        localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
    } catch (e) {}
}

function removeLocalSaveIndex(slotId: string) {
    if (typeof localStorage === 'undefined') return;
    try {
        const raw = localStorage.getItem(SAVE_INDEX_KEY);
        if (raw) {
            const index: SaveMeta[] = JSON.parse(raw).filter((m: SaveMeta) => m.slotId !== slotId);
            localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
        }
    } catch (e) {}
}

export async function triggerAutoSave(reason: string = 'Hyperraum-Transit'): Promise<void> {
    const now = Date.now();
    if (now - lastAutoSaveTime < AUTO_SAVE_THROTTLE_MS) return;
    lastAutoSaveTime = now;

    await saveToSlot('autosave', `Auto-Save: ${reason}`);
}

function showSaveToast(text: string) {
    const container = document.getElementById('crew-death-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'save-toast';
    toast.innerHTML = `
        <span class="save-toast-icon">💾</span>
        <div class="save-toast-info">
            <div class="save-toast-title">SYNAPSE GESICHERT</div>
            <div class="save-toast-desc">${text}</div>
        </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 400);
    }, 2800);
}

// ==========================================
// PLAYTEST PRESETS (Test-Profile für Ali)
// ==========================================

export interface PlaytestPreset {
    id: string;
    name: string;
    badge: string;
    description: string;
    targetCrew: number;
    capacity: number;
    resources: { bio: number; silicon: number };
    paradigm: string;
    subCodex: string;
    mutations: string[];
}

export const PLAYTEST_PRESETS: Record<string, PlaytestPreset> = {
    starter: {
        id: 'starter',
        name: '🌱 Neugeborener Organismus',
        badge: 'FRÜHPHASE (2 CREW)',
        description: 'Startzustand in Sol Invictus. Basiskokon mit 2 Entführten, minimale Ressourcen zum Ausprobieren der Grundlagen.',
        targetCrew: 2,
        capacity: 4,
        resources: { bio: 120, silicon: 80 },
        paradigm: 'neutral',
        subCodex: 'none',
        mutations: ['nucleus', 'cocoon']
    },
    collective: {
        id: 'collective',
        name: '🧬 Schwarm-Verbund',
        badge: 'MITTELPHASE (10 CREW)',
        description: 'Neuronale Waben-Kammer mit 10 Spezialisten verteilt auf alle 4 Stationen. Symbiose-Doktrin & Chitin-Strahlenschutz.',
        targetCrew: 10,
        capacity: 10,
        resources: { bio: 750, silicon: 480 },
        paradigm: 'symbiosis',
        subCodex: 'none',
        mutations: ['nucleus', 'organic_siphon', 'chitin_armor', 'cocoon', 'hivemind', 'neural_cluster', 'telepathic_focus']
    },
    leviathan: {
        id: 'leviathan',
        name: '🌌 Kosmisches Leviathan',
        badge: 'ENDPHASE (30 CREW • MAX MUTATIONEN)',
        description: 'Voll besetztes Schwarm-Zerebrum mit 30 Crew-Mitgliedern, allen Mutationen (Klingen-Panzer, Resonanz-Schrei, Augen des Ibad) und reichhaltigen Ressourcen.',
        targetCrew: 30,
        capacity: 30,
        resources: { bio: 2500, silicon: 1800 },
        paradigm: 'domination',
        subCodex: 'none',
        mutations: [
            'nucleus', 'organic_siphon', 'chitin_armor', 'vector_tentacles', 'blade_armor',
            'cocoon', 'hivemind', 'neural_cluster', 'cryo_matrix', 'hive_cerebrum',
            'telepathic_focus', 'psionic_pulse', 'chimera_veil', 'resonance_screech', 'ibad'
        ]
    }
};

export async function loadPlaytestPreset(presetId: string): Promise<boolean> {
    const preset = PLAYTEST_PRESETS[presetId];
    if (!preset) return false;

    // Reset mutations
    if (STATE.mutations) {
        Object.keys(STATE.mutations).forEach(k => {
            (STATE.mutations as any)[k].purchased = preset.mutations.includes(k);
        });
    }

    // Set Resources & Stats
    STATE.bioRes = preset.resources.bio;
    STATE.siliconRes = preset.resources.silicon;
    STATE.maxCrewCapacity = preset.capacity;
    STATE.health = 100;
    STATE.maxHealth = 100;
    STATE.bioEnergy = 100;
    STATE.mentalEnergy = 100;
    STATE.loneliness = preset.targetCrew > 5 ? 20 : 75;

    // Set Paradigm
    STATE.primaryParadigm = (preset.paradigm as any);
    STATE.activeSubCodex = (preset.subCodex as any);
    (STATE as any).firstContactResolved = preset.targetCrew > 2;

    // Generate balanced crew for the preset
    const roles: ('pilot' | 'engineer' | 'biologist' | 'psychologist' | 'cryptologist')[] = [
        'pilot', 'engineer', 'biologist', 'psychologist', 'cryptologist'
    ];
    const stations: ('flight_synapse' | 'chitin_gland' | 'bio_incubator' | 'dream_core')[] = [
        'flight_synapse', 'chitin_gland', 'bio_incubator', 'dream_core'
    ];
    const speciesNames = ['Sol-Terrestrer', 'Aethelgardianer', 'Olyndar-Psioniker', 'Vulkanier', 'Zerg-Larve'];

    const mockCrew: CrewMember[] = [];
    for (let i = 0; i < preset.targetCrew; i++) {
        const role = roles[i % roles.length];
        const station = stations[i % stations.length];
        const species = speciesNames[i % speciesNames.length];
        const id = `preset_${preset.id}_c${i + 1}`;

        mockCrew.push({
            id,
            name: `${species} #${i + 1}`,
            species,
            role,
            roleName: role.toUpperCase(),
            station,
            status: 'nominal',
            age: 25 + (i * 2),
            lifespan: 90,
            stress: 15,
            synergyLevel: 1 + (i % 3),
            efficiency: 1.0 + (i * 0.05),
            traits: ['resilient'],
            isSpecialist: i % 2 === 0
        } as any);
    }

    STATE.crew = mockCrew;
    reapplyAllMutations();
    calculateCrewBuffs();
    updatePartyGrid();
    renderCrewUI(true);
    updateHUDStats();

    addLogEntry("SYSTEM", `Test-Profil aktiviert: ${preset.name} (${preset.targetCrew} Besatzung)`);
    showSaveToast(`🧪 Test-Profil aktiv: ${preset.name}`);
    return true;
}
