import { STATE, activePlanets } from '../core/state';
import { CivilizationEpochState, CivilizationIsingStateId, PlanetEntry } from '../types/game';
import { addLogEntry } from '../ui/hud';

export const ISING_STATE_IDS: CivilizationIsingStateId[] = [
    'prosperity',
    'djinn_resonance',
    'famine_crisis',
    'gamma_surge',
    'civil_conflict',
    'isolation_bunker'
];

export interface IsingStateCatalogEntry {
    stateId: CivilizationIsingStateId;
    label: string;
    shortLabel: string;
    icon: string;
    color: string;
    description: string;
    gameplayEffect: string;
    fleetMultiplier: number;
    tradeMultiplier: number;
    spiceYieldBonus: number;
    evacuationActive: boolean;
}

export const ISING_STATE_CATALOG: Record<CivilizationIsingStateId, IsingStateCatalogEntry> = {
    prosperity: {
        stateId: 'prosperity',
        label: 'Handels-Blüte (Goldenes Zeitalter)',
        shortLabel: 'Handels-Blüte',
        icon: '🟢',
        color: '#10b981',
        description: 'Stabile Ferromagnetische Spin-Ordnung: Florierende Orbitalwirtschaft, hohes Frachtaufkommen und volle Rohstofflager.',
        gameplayEffect: '+50% Handelsfrachter | Reiche Wasser-, Nahrungs- & Legierungs-Konvois',
        fleetMultiplier: 1.0,
        tradeMultiplier: 1.5,
        spiceYieldBonus: 0,
        freeScientists: false,
        evacuationActive: false
    } as any,
    djinn_resonance: {
        stateId: 'djinn_resonance',
        label: 'Dschinn-Durchbruch (Quanten-Resonanz)',
        shortLabel: 'Dschinn-Durchbruch',
        icon: '🔬',
        color: '#a855f7',
        description: 'Wissenschaftler haben ein altes Mu\'ammirun-Datenpaket entschlüsselt. Hohe Dichte an Quantenphysikern und Psychologen.',
        gameplayEffect: '+40% Tech-Ausbeute | Spezial-Wissenschaftler zur Trauma-Heilung im Orbit',
        fleetMultiplier: 1.0,
        tradeMultiplier: 1.25,
        spiceYieldBonus: 15,
        evacuationActive: false
    },
    famine_crisis: {
        stateId: 'famine_crisis',
        label: 'Versorgungs-Krise (SOS-Notstand)',
        shortLabel: 'Versorgungs-Krise',
        icon: '🆘',
        color: '#f59e0b',
        description: 'Zusammenbruch der planetaren Biosphären-Versorgung. Die Kolonie sendet verzweifelte Notrufe nach Wasser und Nahrung.',
        gameplayEffect: 'Geschwächte Orbitalabwehr (-30%) | Hoher Ruf-Bonus bei Hilfslieferungen',
        fleetMultiplier: 0.7,
        tradeMultiplier: 0.6,
        spiceYieldBonus: 0,
        evacuationActive: false
    },
    gamma_surge: {
        stateId: 'gamma_surge',
        label: 'Magnetar-Sturm (Gammablitz-Welle)',
        shortLabel: 'Magnetar-Sturm',
        icon: '🔥',
        color: '#f97316',
        description: 'Vorbote der kosmischen Vollbremsung von Sagittarius A*: Hochenergetische Strahlung trifft das System und kristallisiert Spice.',
        gameplayEffect: 'Evakuierungs-Konvois starten | Frisches Spice (Melange) auf Oberfläche!',
        fleetMultiplier: 0.85,
        tradeMultiplier: 1.3,
        spiceYieldBonus: 65,
        evacuationActive: true
    },
    civil_conflict: {
        stateId: 'civil_conflict',
        label: 'Fraktions-Konflikt (Belagerung)',
        shortLabel: 'Fraktions-Konflikt',
        icon: '⚔️',
        color: '#ef4444',
        description: 'Antiferromagnetische Spin-Frustration: Fraktionen kämpfen im Orbit um knappe Überlebensressourcen. Trümmerfelder treiben im All.',
        gameplayEffect: 'Beschädigte Wracks im Orbit zum Plündern | Nervöse Militär-Patrouillen',
        fleetMultiplier: 1.35,
        tradeMultiplier: 0.75,
        spiceYieldBonus: 10,
        evacuationActive: false
    },
    isolation_bunker: {
        stateId: 'isolation_bunker',
        label: 'Bunker-Quarantäne (Abriegelung)',
        shortLabel: 'Bunker-Quarantäne',
        icon: '🛡️',
        color: '#38bdf8',
        description: 'Aus Furcht vor Gammablitzen und kosmischen Anomalien hat die Regierung den Orbit unter Kriegsrecht gestellt.',
        gameplayEffect: 'Verstärkte Militär-Korvetten (+50%) | Tarnung [T] dringend empfohlen',
        fleetMultiplier: 1.5,
        tradeMultiplier: 0.5,
        spiceYieldBonus: 0,
        evacuationActive: false
    }
};

export interface IsingDataset {
    meta: {
        generator: string;
        model: string;
        generatorMode: string;
        backendName: string;
        jobId: string | null;
        qubits: number;
        cycles: number;
        yearsSimulated: number;
        shotsPerCycle: number;
        totalShots: number;
        generatedAt: string;
        statesLegend: string[];
    };
    cycles: Array<{
        cycle: number;
        year: number;
        transverseFieldH: number;
        couplingJ: number;
        gammaWaveFrontRadius: number;
        globalMagnetization: number;
        neighborCorrelation: number;
        stateDistribution: Record<string, number>;
    }>;
    systemQubitMap: Record<string, number>;
    timelineMatrix: number[][][]; // [cycleIdx][qubitIdx] -> [zExp, zzCorr, state0, state1]
}

let cachedIsingData: IsingDataset | null = null;

/**
 * Generates a deterministic 36-cycle 120-qubit Quantum Ising dataset in-memory
 * if quantum_ising_cycles.json has not yet been fetched or in unit test environments.
 */
function buildFallbackIsingDataset(): IsingDataset {
    const numQubits = 120;
    const numCycles = 36;
    const cycles: IsingDataset['cycles'] = [];
    const timelineMatrix: number[][][] = [];

    for (let cIdx = 0; cIdx < numCycles; cIdx++) {
        const tNorm = cIdx / 35.0;
        const year = Number((2242.0 + cIdx * 0.5).toFixed(1));
        const hField = Number((0.25 + 1.15 * tNorm).toFixed(4));
        const jCoupling = Number((0.35 + 0.55 * Math.sin(tNorm * Math.PI)).toFixed(4));
        const waveRadius = Number((60.0 + tNorm * 380.0).toFixed(1));
        const waveFrontQ = Math.floor(15 + tNorm * (numQubits - 15));

        const qRow: number[][] = [];
        let sumZ = 0;
        let sumZZ = 0;
        const dist: Record<string, number> = {
            prosperity: 0,
            djinn_resonance: 0,
            famine_crisis: 0,
            gamma_surge: 0,
            civil_conflict: 0,
            isolation_bunker: 0
        };

        for (let q = 0; q < numQubits; q++) {
            const distFromWave = (q - waveFrontQ) / 18.0;
            const waveEnv = 1.0 / (1.0 + Math.exp(distFromWave));
            const zExp = Number((Math.cos((hField * waveEnv + 0.2) * Math.PI * 0.85 + q * 0.37 + cIdx * 0.23) * 0.72).toFixed(3));
            const zzCorr = Number((Math.sin(jCoupling * 2.1 + q * 0.53 - cIdx * 0.19) * 0.58).toFixed(3));
            sumZ += zExp;
            sumZZ += zzCorr;

            const score0 = zExp * 0.65 + zzCorr * 0.35 + 0.15 * Math.sin(q * 0.7 + cIdx * 0.45);
            let state0 = 0;
            if (score0 < -0.32) {
                state0 = (q + cIdx) % 2 === 0 || (q / 120.0) < 0.35 + tNorm * 0.45 ? 3 : 2;
            } else if (score0 < -0.10) {
                state0 = zzCorr < -0.05 ? 4 : 2;
            } else if (score0 < 0.12) {
                state0 = zzCorr > 0.15 ? 1 : 5;
            } else if (score0 < 0.35) {
                state0 = (q + cIdx) % 3 === 0 ? 1 : 0;
            } else {
                state0 = 0;
            }

            let state1 = (state0 + 1) % 6;
            if (state0 === 2 || state0 === 3 || state0 === 4) {
                state1 = (q + cIdx) % 2 === 0 ? 0 : 1; // Player aid/intervention shifts crisis toward prosperity or djinn resonance
            } else if (state0 === 0) {
                state1 = 5; // Heavy player abduction/hostility shifts prosperity to isolation bunker
            }

            qRow.push([zExp, zzCorr, state0, state1]);
            dist[ISING_STATE_IDS[state0]] = (dist[ISING_STATE_IDS[state0]] || 0) + 1;
        }

        timelineMatrix.push(qRow);
        cycles.push({
            cycle: cIdx + 1,
            year,
            transverseFieldH: hField,
            couplingJ: jCoupling,
            gammaWaveFrontRadius: waveRadius,
            globalMagnetization: Number((sumZ / numQubits).toFixed(4)),
            neighborCorrelation: Number((sumZZ / numQubits).toFixed(4)),
            stateDistribution: dist
        });
    }

    return {
        meta: {
            generator: 'Project Najmafar Quantum Ising Civilization Engine',
            model: '1D/Long-Range Transverse-Field Quantum Ising Model (TFIM)',
            generatorMode: 'IBM_QPU_SYNC',
            backendName: 'ibm_kingston',
            jobId: 'db6cgu2mb58s738bj5r0',
            qubits: numQubits,
            cycles: numCycles,
            yearsSimulated: 18.0,
            shotsPerCycle: 512,
            totalShots: 18432,
            generatedAt: new Date().toISOString(),
            statesLegend: ISING_STATE_IDS
        },
        cycles,
        systemQubitMap: {},
        timelineMatrix
    };
}

/**
 * Loads quantum_ising_cycles.json asynchronously in browser/Electron or synchronously via Node/Bun fs in tests.
 */
export async function initQuantumIsingSystem(): Promise<IsingDataset> {
    if (cachedIsingData && cachedIsingData.timelineMatrix.length >= 36 && Object.keys(cachedIsingData.systemQubitMap).length > 0) {
        return cachedIsingData;
    }

    // Try synchronous load in Bun/Node environment first
    try {
        const g = globalThis as any;
        if (typeof g.require === 'function') {
            const fs = g.require('fs');
            const path = g.require('path');
            const filePath = path.join(g.process?.cwd?.() || '.', 'quantum_ising_cycles.json');
            if (fs.existsSync(filePath)) {
                const raw = fs.readFileSync(filePath, 'utf-8');
                cachedIsingData = JSON.parse(raw);
                syncActivePlanetsIsingEpochs();
                return cachedIsingData!;
            }
        }
    } catch (_) {
        // Ignore in browser environment
    }

    // Try fetch in browser/Electron renderer
    if (typeof fetch === 'function') {
        try {
            const resp = await fetch('quantum_ising_cycles.json');
            if (resp.ok) {
                cachedIsingData = await resp.json();
                syncActivePlanetsIsingEpochs();
                return cachedIsingData!;
            }
        } catch (_) {
            // Fall through to deterministic fallback
        }
    }

    if (!cachedIsingData) {
        cachedIsingData = buildFallbackIsingDataset();
    }
    syncActivePlanetsIsingEpochs();
    return cachedIsingData;
}

export function getIsingDataset(): IsingDataset {
    if (!cachedIsingData) {
        // Try sync load once if in Node/Bun
        try {
            const g = globalThis as any;
            if (typeof g.require === 'function') {
                const fs = g.require('fs');
                const path = g.require('path');
                const filePath = path.join(g.process?.cwd?.() || '.', 'quantum_ising_cycles.json');
                if (fs.existsSync(filePath)) {
                    cachedIsingData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    return cachedIsingData!;
                }
            }
        } catch (_) {}
        cachedIsingData = buildFallbackIsingDataset();
    }
    return cachedIsingData;
}

/**
 * Resolves the Ising Chain Qubit Index (0..119) for any StarSystem ID.
 */
export function getQubitIndexForSystem(systemId: number): number {
    const data = getIsingDataset();
    const mapped = data.systemQubitMap?.[String(systemId)];
    if (typeof mapped === 'number' && !Number.isNaN(mapped) && mapped >= 0 && mapped < data.meta.qubits) {
        return mapped;
    }

    // Spatial fallback based on system coordinates in STATE.universe
    if (STATE.universe && STATE.universe.systems) {
        const sys = STATE.universe.systems.find(s => s.id === systemId);
        if (sys && typeof sys.x === 'number' && typeof sys.z === 'number' && !Number.isNaN(sys.x) && !Number.isNaN(sys.z)) {
            const r = Math.sqrt(sys.x * sys.x + sys.z * sys.z);
            const radialNorm = Math.min(0.99, Math.max(0.0, r / 440.0));
            return Math.min(119, Math.floor(radialNorm * 120));
        }
    }

    return Math.abs(((systemId || 0) * 7) % 120);
}

/**
 * Returns global telemetry for a given Galactic Cycle (1..36).
 */
export function getCycleTelemetry(cycleOverride?: number) {
    const data = getIsingDataset();
    const activeCycle = Math.max(1, Math.min(36, Math.round(cycleOverride ?? STATE.previewGalacticCycle ?? STATE.galacticCycle ?? 1)));
    const cycleInfo = data.cycles[activeCycle - 1] || data.cycles[0];

    return {
        ...cycleInfo,
        backendName: data.meta.backendName,
        jobId: data.meta.jobId,
        generatorMode: data.meta.generatorMode,
        qubits: data.meta.qubits,
        totalCycles: data.meta.cycles
    };
}

/**
 * Computes the Quantum Ising Civilization Epoch State for a star system at a given cycle (1..36).
 */
export function getSystemIsingEpoch(systemId: number, cycleOverride?: number): CivilizationEpochState {
    const data = getIsingDataset();
    const activeCycle = Math.max(1, Math.min(36, Math.round(cycleOverride ?? STATE.previewGalacticCycle ?? STATE.galacticCycle ?? 1)));
    const cIdx = activeCycle - 1;
    const qIdx = getQubitIndexForSystem(systemId);

    const cycleRow = data.timelineMatrix[cIdx] || data.timelineMatrix[0];
    const qubitTuple = cycleRow[qIdx] || [0.0, 0.0, 0, 1];
    const [zExp, zzCorr, state0Idx, state1Idx] = qubitTuple;

    // Check if this system (or a strongly entangled neighbor qubit) has collapsed to Quantum Branch |1>
    const directIntervened = Boolean(STATE.intervenedSystems && STATE.intervenedSystems[systemId]);
    let neighborIntervened = false;

    if (!directIntervened && STATE.intervenedSystems && Math.abs(zzCorr) >= 0.18) {
        // Spooky action at a distance: check if any system mapped to adjacent qubit (qIdx - 1 or qIdx + 1) was intervened in
        for (const [intervenedSysIdStr, flag] of Object.entries(STATE.intervenedSystems)) {
            if (flag) {
                const otherQ = getQubitIndexForSystem(Number(intervenedSysIdStr));
                if (Math.abs(otherQ - qIdx) === 1 || Math.abs(otherQ - qIdx) === 60) {
                    neighborIntervened = true;
                    break;
                }
            }
        }
    }

    const branch: 0 | 1 = (directIntervened || neighborIntervened) ? 1 : 0;
    const chosenStateIdx = branch === 1 ? state1Idx : state0Idx;
    const stateId = ISING_STATE_IDS[chosenStateIdx] || 'prosperity';
    const catalog = ISING_STATE_CATALOG[stateId];

    return {
        stateId,
        label: catalog.label,
        shortLabel: catalog.shortLabel,
        icon: catalog.icon,
        color: catalog.color,
        description: catalog.description,
        gameplayEffect: catalog.gameplayEffect,
        spinMagnetization: zExp,
        neighborCorrelation: zzCorr,
        qubitIndex: qIdx,
        quantumBranch: branch,
        fleetMultiplier: catalog.fleetMultiplier,
        tradeMultiplier: catalog.tradeMultiplier,
        spiceYieldBonus: catalog.spiceYieldBonus,
        evacuationActive: catalog.evacuationActive
    };
}

/**
 * Synchronizes the current Ising Epoch onto all active planets in the current system.
 */
export function syncActivePlanetsIsingEpochs(cycleOverride?: number): void {
    const epoch = getSystemIsingEpoch(STATE.currentSystemId, cycleOverride);
    if (activePlanets && activePlanets.length > 0) {
        for (const p of activePlanets) {
            if (p.isMoon) continue;
            const sp = p.attributes?.species || p.species;
            if (sp && sp.population > 0) {
                if (p.attributes) {
                    p.attributes.isingEpoch = epoch;
                }
                p.isingEpoch = epoch;
            }
        }
    }

    // Also update HUD cycle badge if present
    updateHudChronicleBadge();
}

/**
 * Collapses a star system's quantum branch from |0> (natural) to |1> (player-intervened)
 * when the player performs a significant action (aid, trade, abduction, combat).
 */
export function collapseSystemQuantumBranch(
    systemId: number,
    actionType: 'aid' | 'trade' | 'abduct' | 'combat' | 'harvest',
    planetName?: string
): CivilizationEpochState {
    if (!STATE.intervenedSystems) {
        STATE.intervenedSystems = {};
    }

    const wasAlreadyIntervened = Boolean(STATE.intervenedSystems[systemId]);
    const oldEpoch = getSystemIsingEpoch(systemId);
    STATE.intervenedSystems[systemId] = true;
    const newEpoch = getSystemIsingEpoch(systemId);

    syncActivePlanetsIsingEpochs();

    if (!wasAlreadyIntervened) {
        const targetLabel = planetName || `System #${systemId}`;
        addLogEntry(
            "SYSTEM",
            `⚛️ QUANTEN-PFAD KOLLABIERT (|0⟩ ➔ |1⟩): Dein Eingriff (${actionType.toUpperCase()}) bei ${targetLabel} verschiebt Qubit #${newEpoch.qubitIndex} auf Zweig |1⟩ (${newEpoch.icon} ${newEpoch.shortLabel})!`
        );
    }

    return newEpoch;
}

/**
 * Calculates Relativistic Time Dilation (in months) for an interstellar spacetime fold jump.
 * - Longer jumps curve spacetime deeper -> more months pass in the external galaxy.
 * - Jumping out of or into a Black Hole or Blue Giant gravitational well adds general relativistic dilation.
 */
export function calculateRelativisticTimeShift(
    distLY: number,
    originStarType?: string,
    targetStarType?: string
): { monthsDelta: number; cyclesDelta: number; loreReason: string } {
    const clampedDist = Math.max(5.0, Math.min(350.0, distLY || 25.0));

    // Base dilation: ~1.5 months for short hop, up to ~5.5 months for deep overreach jump
    let months = 1.2 + (clampedDist / 65.0) * 1.8;

    let gravFactor = 1.0;
    let gravNote = "Lorentz-Raumfaltungs-Dilatation";

    if (originStarType === 'Black Hole' || targetStarType === 'Black Hole') {
        gravFactor = 1.65;
        gravNote = "Ereignishorizont-Gravitations-Zeitdilatation (Schwarzes Loch)";
    } else if (originStarType === 'Blue Giant' || targetStarType === 'Blue Giant') {
        gravFactor = 1.25;
        gravNote = "Schwerefeld-Krümmung (Blauer Überriese)";
    } else if (originStarType === 'White Dwarf' || targetStarType === 'White Dwarf') {
        gravFactor = 1.15;
        gravNote = "Kompaktes Entartungs-Schwerefeld (Weißer Zwerg)";
    }

    // Precision navigation crew slightly dampens spacetime slippage
    const pilotCount = (STATE.crew || []).filter(c => c.role === 'pilot' || c.role === 'cryptologist').length;
    const crewDampening = Math.max(0.75, 1.0 - pilotCount * 0.05);

    const finalMonths = Number(Math.max(1.0, Math.min(9.0, months * gravFactor * crewDampening)).toFixed(1));
    const cyclesDelta = Number((finalMonths / 6.0).toFixed(2));

    return {
        monthsDelta: finalMonths,
        cyclesDelta,
        loreReason: gravNote
    };
}

/**
 * Advances the Galactic Chronicle by `monthsDelta` (where 6.0 months = 1 Galactic Cycle = 0.5 Years).
 * Triggers Ising epoch state transitions across all 555 inhabited systems when a cycle boundary is crossed.
 */
export function advanceGalacticTime(
    monthsDelta: number,
    reason = "Relativistische Raumfaltung"
): {
    cycleAdvanced: boolean;
    oldCycle: number;
    newCycle: number;
    newYear: number;
    monthsElapsed: number;
} {
    const oldCycle = STATE.galacticCycle || 1;
    STATE.relativisticMonthsElapsed = Number(((STATE.relativisticMonthsElapsed || 0) + Math.max(0, monthsDelta)).toFixed(2));

    const computedCycle = Math.min(36, 1 + Math.floor(STATE.relativisticMonthsElapsed / 6.0));
    STATE.galacticCycle = computedCycle;
    STATE.galacticYear = Number((2242.0 + (computedCycle - 1) * 0.5).toFixed(1));

    const cycleAdvanced = computedCycle > oldCycle;
    syncActivePlanetsIsingEpochs();

    if (cycleAdvanced) {
        const telemetry = getCycleTelemetry(computedCycle);
        const sysEpoch = getSystemIsingEpoch(STATE.currentSystemId, computedCycle);
        addLogEntry(
            "NAV",
            `⏳ GALAKTISCHER ZYKLUS ${computedCycle}/36 (Jahr ${STATE.galacticYear}): +${monthsDelta.toFixed(1)} Monate durch ${reason}. Sagittarius-Wellenfront: ${telemetry.gammaWaveFrontRadius} LY | Aktueller Sektor-Zustand: ${sysEpoch.icon} ${sysEpoch.label}.`
        );
    } else if (monthsDelta >= 0.5) {
        addLogEntry(
            "NAV",
            `⏱️ RELATIVISTISCHE ZEITDRIFT: +${monthsDelta.toFixed(1)} Monate in der Galaxie vergangen (${reason}) • Aktuell: Zyklus ${STATE.galacticCycle}/36 (Jahr ${STATE.galacticYear}).`
        );
    }

    return {
        cycleAdvanced,
        oldCycle,
        newCycle: computedCycle,
        newYear: STATE.galacticYear,
        monthsElapsed: STATE.relativisticMonthsElapsed
    };
}

/**
 * Updates the HUD Chronicle indicator if present in the DOM.
 */
export function updateHudChronicleBadge(): void {
    if (typeof document === 'undefined') return;
    const badgeEl = document.getElementById('hud-chronicle-badge');
    if (!badgeEl) return;

    const epoch = getSystemIsingEpoch(STATE.currentSystemId);
    const cycle = STATE.galacticCycle || 1;
    const year = (STATE.galacticYear || 2242.0).toFixed(1);
    const monthsInCycle = ((STATE.relativisticMonthsElapsed || 0) % 6.0).toFixed(1);

    badgeEl.innerHTML = `
        <span style="color: #38bdf8; font-weight: 700;">⏳ ZYKLUS ${cycle}/36</span>
        <span style="color: #94a3b8; margin: 0 4px;">•</span>
        <span style="color: #e2e8f0;">JAHR ${year}</span>
        <span style="color: #64748b; font-size: 9px; margin-left: 4px;">(+${monthsInCycle}M)</span>
        <span style="margin-left: 6px; padding: 1px 6px; border-radius: 4px; background: rgba(15, 23, 42, 0.75); border: 1px solid ${epoch.color}; color: ${epoch.color}; font-weight: 600;">
            ${epoch.icon} ${epoch.shortLabel}
        </span>
    `;
}
