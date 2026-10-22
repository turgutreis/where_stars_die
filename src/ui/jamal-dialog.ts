import { STATE } from '../core/state';
import { 
    playSonarChime, 
    playSynapseEvolveSound, 
    playEmpChargeSound, 
    playCrashSound, 
    playFleetAlarmSound 
} from '../engine/audio';
import { addLogEntry, updateHUDStats } from './hud';
import { advanceFtueStep, renderDirectives } from './directives';
import { DialogueEngine } from '../systems/dialogue';
import { QuestManager } from '../systems/quests';
import { isMainMenuOpen } from './menu-controller';
import dialoguesData from '../data/dialogues.json';
import type { DialogueNode, DialogueOption } from '../types/narrative';

export type { DialogueOption, DialogueNode };

// Export dialogue nodes directly from JSON data
export const DIALOGUE_NODES: Record<string, DialogueNode> = { ...(dialoguesData as Record<string, DialogueNode>) };

export function isJamalDialogOpen(): boolean {
    return DialogueEngine.isDialogOpen();
}

export function getCurrentDialogueNodeId(): string {
    return DialogueEngine.getCurrentNodeId();
}

/**
 * Opens right-docked dialogue card with the given node ID.
 */
export function openNpcDialogue(nodeId: string) {
    return DialogueEngine.openDialogue(nodeId);
}

/**
 * Closes dialogue card and updates HUD.
 */
export function closeNpcDialogue() {
    DialogueEngine.closeDialogue();
}

/**
 * Handles choice selection in dialogue tree.
 */
export function handleDialogueChoice(optionOrTarget: DialogueOption | string) {
    DialogueEngine.handleChoice(optionOrTarget);
}

/**
 * Player attempts to hack or smash the clamp in orbit:
 * Triggers a psionic feedback shock (-25 mental energy), reveals the holographic decoy,
 * alerts the Insan towing drone, and intercepts telemetry pointing to INSAN-Verwahrstelle Zeta-9!
 */
export function triggerDecoyTrap() {
    const penalty = 25;
    STATE.mentalEnergy = Math.max(0, (STATE.mentalEnergy || 50) - penalty);
    STATE.jamalDecoyRevealed = true;
    STATE.jamalMissionDiscovered = true;

    try {
        playCrashSound();
        playEmpChargeSound();
        playFleetAlarmSound();
    } catch (e) {}

    // Hologram decoy revealed
    if (STATE.jamalShip) {
        STATE.jamalShip.name = "Köder-Attrappe [HOLOGRAFIE-ATTROPPE ENTLARVT]";
        STATE.jamalShip.isDecoy = true;
    }

    // Drone becomes furious / hostile
    if (STATE.towingDrone) {
        STATE.towingDrone.name = "KI-Abschleppdrohne TX-9 [AGGRESSIV • VOLLSTRECKUNG]";
        STATE.towingDrone.isHostile = true;
        STATE.towingDrone.status = 'hostile';
    }

    STATE.systemAlertLevel = 'alert';

    QuestManager.advanceQuest('prologue_jamal_ship', 2);
    advanceFtueStep(3);
    updateHUDStats();

    addLogEntry("PSIONIK", "⚡ PSIONISCHE RÜCKKOPPLUNG: -25 Mentalkraft erlitten! Die Falle der Insan-Drohne schnappt zu!");
    addLogEntry("SYSTEM", "🚨 HOLOGRAPHISCHE ATTRAPPE ENTLARVT: Die echte Ar-Riḥla wurde in die INSAN-Verwahrstelle Zeta-9 abgeschleppt (2 Sprünge entfernt)!");

    openNpcDialogue('hologram_trap_revealed');
}

/**
 * Player liberates the real Ar-Riḥla at the INSAN Depot station Pier 4.
 */
export function liberateRealShipAtStation() {
    if (STATE.jamalShipLiberated) return;
    STATE.jamalShipLiberated = true;
    STATE.jamalMissionCompleted = true;

    try {
        playSynapseEvolveSound();
        playSonarChime();
    } catch (e) {}

    if (STATE.jamalShip) {
        if (STATE.jamalShip.setLiberated) STATE.jamalShip.setLiberated(true);
        STATE.jamalShip.name = "Forschungsschiff 'Ar-Riḥla' [GEBORGEN]";
    }

    QuestManager.completeQuest('prologue_jamal_ship');
    grantJamalRewards();

    addLogEntry("BERGUNG", "🎉 ECHTES FORSCHUNGSSCHIFF GEBORGEN: Ar-Riḥla befreit! +50 Melange-Spice, +60 Silizium!");
    addLogEntry("SYSTEM", "📟 QUANTEN-LOGBUCH AKTIVIERT: Ar-Riḥla gekoppelt! Missions-Direktiven und Galaktische Aufträge online.");
    addLogEntry("JAMAL", "„Alle Sensoren online! Jetzt können wir die Verlangsamung und das Jahr 2035 aufklären!“");

    advanceFtueStep(6);
    renderDirectives();

    openNpcDialogue('real_ship_liberated');
}

/**
 * Triggers when player encounters the bureaucracy automaton at Schalter 7B or reviews the bypass plan.
 * Advances the quest from locating the administration to liberating the real ship at Pier 4.
 */
export function onInsanBureaucracyEncountered() {
    if (QuestManager.isQuestActive('prologue_jamal_ship')) {
        const currentStage = QuestManager.getCurrentStage('prologue_jamal_ship');
        if (currentStage && currentStage.stage === 3) {
            QuestManager.advanceQuest('prologue_jamal_ship', 4);
            advanceFtueStep(5);
            addLogEntry("JAMAL", "„Alles klar! Fliegen wir rüber zu Pier 4 und überladen die Verankerungsklammern mit einem EMP-Impuls!“");
            renderDirectives();
        }
    }
}

/**
 * Opens interaction with the INSAN administration at Schalter 7B.
 */
export function openInsanAdministrationDialogue() {
    if (!STATE.insanArrivalSeen) {
        STATE.insanArrivalSeen = true;
        openNpcDialogue('insan_depot_arrival');
    } else {
        openNpcDialogue('insan_station_bureaucracy');
    }
}

/**
 * Player liberates the impounded Voyager 2 probe at the INSAN Depot.
 */
export function liberateVoyagerProbe() {
    STATE.voyagerLiberated = true;
    STATE.voyagerScanned = true;
    STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy || 100, (STATE.mentalEnergy || 0) + 30);
    STATE.loneliness = Math.max(0, (STATE.loneliness || 30) - 20);

    if (STATE.voyagerProbe) {
        STATE.voyagerProbe.name = 'Voyager 2 (Archaische Raumsonde) [BEFREIT]';
    }

    try {
        playSonarChime();
        playSynapseEvolveSound();
    } catch (e) {}

    addLogEntry("RELIKT", "🛰️ VOYAGER 2 BEFREIT: Golden Record geborgen! +30 Mentalkraft, Einsamkeit gelindert!");
    updateHUDStats();

    openNpcDialogue('insan_voyager_liberated');
}

// Backwards-compatible aliases
export const executeSmashClamp = triggerDecoyTrap;
export const executeHackDroneDatabase = triggerDecoyTrap;

function grantJamalRewards() {
    STATE.loneliness = Math.max(5, (STATE.loneliness || 30) - 20);
    updateHUDStats();
}

/**
 * Registers actions into DialogueEngine.
 */
DialogueEngine.registerAction('hack_clamp_attempt', () => triggerDecoyTrap());
DialogueEngine.registerAction('smash_clamp_attempt', () => triggerDecoyTrap());
DialogueEngine.registerAction('smash_clamp', () => triggerDecoyTrap());
DialogueEngine.registerAction('hack_drone_database', () => triggerDecoyTrap());
DialogueEngine.registerAction('liberate_real_ship_at_station', () => liberateRealShipAtStation());
DialogueEngine.registerAction('liberate_voyager_probe', () => liberateVoyagerProbe());

DialogueEngine.onNodeOpened((nodeId: string) => {
    if (nodeId === 'insan_station_bureaucracy' || nodeId === 'insan_station_bypass_plan') {
        onInsanBureaucracyEncountered();
    }
});

/**
 * Opens initial telepathic intro brief from Dr. Tariq Jamal in right-docked dialogue panel.
 */
export function openJamalIntroDialog() {
    if (STATE.jamalIntroModalSeen) return;
    STATE.jamalIntroModalSeen = true;
    STATE.jamalMissionActive = true;

    QuestManager.startQuest('prologue_jamal_ship');
    openNpcDialogue('jamal_orbit_intro');
}

/**
 * Triggers when player scans Jamal's ship in orbit!
 */
export function triggerJamalShipScannedDialogue() {
    QuestManager.advanceQuest('prologue_jamal_ship', 1);
    advanceFtueStep(2);
    const hint = document.getElementById('flight-controls-hint');
    if (hint) hint.classList.add('hidden');
    openNpcDialogue('jamal_ship_scanned');
}

// Backward-compatibility wrappers
export function closeJamalDialog() {
    closeNpcDialogue();
}

export function openJamalLiberatedDialog() {
    openNpcDialogue('drone_hacked_result');
}

export function liberateJamalShip() {
    executeHackDroneDatabase();
}

/**
 * Initializes button listeners on modal (close button & keyboard number shortcuts).
 */
export function initJamalDialogListeners() {
    const closeBtn = document.getElementById('close-npc-dialog-btn') || document.getElementById('npc-dialog-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeNpcDialogue();
        });
    }

    // Number key shortcuts (1-9) for choices
    window.addEventListener('keydown', (e) => {
        if (!isJamalDialogOpen() || isMainMenuOpen()) return;

        const key = e.key;
        if (key >= '1' && key <= '9') {
            const idx = parseInt(key, 10) - 1;
            const node = DIALOGUE_NODES[getCurrentDialogueNodeId()];
            if (node && node.options && node.options[idx]) {
                e.preventDefault();
                e.stopPropagation();
                handleDialogueChoice(node.options[idx]);
            }
        }
    });
}
