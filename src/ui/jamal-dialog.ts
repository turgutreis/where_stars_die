import { STATE } from '../core/state';
import { 
    playSonarChime, 
    playSynapseEvolveSound, 
    playEmpChargeSound, 
    playCrashSound, 
    playFleetAlarmSound 
} from '../engine/audio';
import { addLogEntry, updateHUDStats } from './hud';
import { advanceFtueStep } from './directives';
import { DialogueEngine } from '../systems/dialogue';
import { QuestManager } from '../systems/quests';
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
 * Player chooses to destroy the clamp violently:
 * Ship freed, rewards granted, BUT drone becomes hostile and attacks!
 */
export function executeSmashClamp() {
    if (STATE.jamalShipLiberated) return;
    STATE.jamalShipLiberated = true;
    STATE.jamalMissionCompleted = true;

    try {
        playCrashSound();
        playEmpChargeSound();
        playFleetAlarmSound();
    } catch (e) {}

    // Overload clamp & free ship
    if (STATE.jamalShip) {
        if (STATE.jamalShip.setLiberated) STATE.jamalShip.setLiberated(true);
        STATE.jamalShip.name = "Forschungsschiff 'ISS Ibn Battuta' [GEBORGEN]";
    }

    // Drone becomes furious / hostile!
    if (STATE.towingDrone) {
        STATE.towingDrone.name = "KI-Abschleppdrohne TX-9 [AGGRESSIV • VOLLSTRECKUNG]";
        STATE.towingDrone.isHostile = true;
        STATE.towingDrone.status = 'hostile';
    }

    STATE.systemAlertLevel = 'alert';

    QuestManager.completeQuest('prologue_jamal_ship');
    grantJamalRewards();

    addLogEntry("PARK-KI", "🚨 [INSAN-VOLLZUG]: ALARM! Sachbeschädigung an orbitaler Parkkralle! Eliminierungsprotokoll aktiviert!");
    addLogEntry("SYSTEM", "💥 GEWALTIGE BEFREIUNG: Die Kralle wurde zerschlagen. Die Drohnen sind stinksauer und eröffnen das Feuer!");

    openNpcDialogue('clamp_smashed_result');
    advanceFtueStep(2);
}

/**
 * Player chooses to hack the drone's memory bank:
 * Unlocks the Insan Verwahrstelle coordinates and releases clamp via admin override peacefully!
 */
export function executeHackDroneDatabase() {
    if (STATE.jamalShipLiberated) return;
    STATE.jamalShipLiberated = true;
    STATE.jamalMissionCompleted = true;

    try {
        playSynapseEvolveSound();
        playSonarChime();
    } catch (e) {}

    // Peaceful bypass
    if (STATE.jamalShip) {
        if (STATE.jamalShip.setLiberated) STATE.jamalShip.setLiberated(true);
        STATE.jamalShip.name = "Forschungsschiff 'ISS Ibn Battuta' [GEBORGEN]";
    }

    if (STATE.towingDrone) {
        STATE.towingDrone.name = "KI-Abschleppdrohne TX-9 [ADMIN-BYPASS • HARMLOS]";
        STATE.towingDrone.status = 'neutral';
        STATE.towingDrone.isHostile = false;
        if (STATE.towingDrone.triggerOverload) STATE.towingDrone.triggerOverload();
    }

    QuestManager.completeQuest('prologue_jamal_ship');
    grantJamalRewards();

    addLogEntry("PARK-KI", "🤖 [INSAN-SYSTEM]: Administrator-Code (OVERRIDE_ADMIN_0000) verifiziert. Parkkralle ordnungsgemäß entriegelt.");
    addLogEntry("NAV", "🛰️ DATENBANK-HACK: Koordinaten der Insan-Verwahrstelle (Sektor-Schrottwerft) in Sternenkarte gespeichert!");
    addLogEntry("SYSTEM", "✨ ELEGANTER BYPASS: Forschungsschiff friedlich befreit ohne Drohnen-Alarm!");

    openNpcDialogue('drone_hacked_result');
    advanceFtueStep(2);
}

function grantJamalRewards() {
    STATE.loneliness = Math.max(5, (STATE.loneliness || 30) - 20);
    updateHUDStats();
}

/**
 * Registers actions into DialogueEngine.
 */
DialogueEngine.registerAction('smash_clamp', () => executeSmashClamp());
DialogueEngine.registerAction('hack_drone_database', () => executeHackDroneDatabase());

/**
 * Opens initial telepathic intro brief from Dr. Jamal in right-docked dialogue panel.
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
    const closeBtn = document.getElementById('npc-dialog-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeNpcDialogue();
        });
    }

    // Number key shortcuts (1-4) for choices
    window.addEventListener('keydown', (e) => {
        if (!isJamalDialogOpen()) return;

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
