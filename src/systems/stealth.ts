import * as THREE from 'three';
import { STATE } from '../core/state';
import { addLogEntry } from '../ui/hud';
import { playStealthToggleSound, playCrashSound } from '../engine/audio';

/**
 * Toggles Najmafar's Psionic Camouflage / Mimikry veil [T].
 * Masks the ship's biological signature as an asteroid or space debris,
 * evading planetary defense radar and orbital station sensor arrays.
 */
export function toggleStealth(): boolean {
    if (!STATE.gameStarted) return false;

    if (!STATE.stealthActive) {
        if (STATE.mentalEnergy < 10) {
            addLogEntry("SYSTEM", `Zu wenig Mentalkraft für psionischen Schleier (mindestens 10 Psi nötig)!`);
            return false;
        }

        STATE.stealthActive = true;
        playStealthToggleSound(true);

        const drainRate = getEffectiveStealthDrainRate();
        const veilBonus = STATE.mutations.chimera_veil?.purchased ? " [Schimären-Schleier aktiv: -50% Drain]" : "";
        addLogEntry("SYSTEM", `🔮 PSIONISCHER SCHLEIER AKTIVIERT: Chamäleon-Signatur maskiert Najmafar (-${drainRate.toFixed(1)} Psi/s)${veilBonus}.`);
        updateStealthVisuals(true);
        updateStealthHUD();
        return true;
    } else {
        STATE.stealthActive = false;
        playStealthToggleSound(false);
        addLogEntry("SYSTEM", `👁️ PSIONISCHER SCHLEIER DEAKTIVIERT: Volle biologische Signatur sichtbar.`);
        updateStealthVisuals(false);
        updateStealthHUD();
        return false;
    }
}

/**
 * Calculates current mental energy consumption per second based on mutations.
 */
export function getEffectiveStealthDrainRate(): number {
    let rate = STATE.stealthDrainRate || 2.0;
    if (STATE.mutations.chimera_veil && STATE.mutations.chimera_veil.purchased) {
        rate *= 0.5; // Chimera Veil mutation halves mental toll
    }
    if (STATE.mutations.telepathic_focus && STATE.mutations.telepathic_focus.purchased) {
        rate *= 0.85; // Telepathic focus further streamlines psionic flow
    }
    return Math.max(0.4, rate);
}

/**
 * Continuous loop update for psionic stealth drain and visual fading.
 */
export function updateStealth(dt: number) {
    if (STATE.stealthActive) {
        const drain = getEffectiveStealthDrainRate() * dt;
        STATE.mentalEnergy = Math.max(0, STATE.mentalEnergy - drain);

        if (STATE.mentalEnergy <= 0) {
            // Neural exhaustion collapses the cloak!
            STATE.stealthActive = false;
            playCrashSound();
            addLogEntry("CREW", `⚠️ SCHLEIER KOLLABIERT: Mentale Erschöpfung! Najmafar ist vor den Sensoren entblößt!`);
            updateStealthVisuals(false);
            updateStealthHUD();

            // Trigger alert if close to an active fleet ship or station
            triggerProximityDetection();
        }
    }

    updateStealthVisuals(STATE.stealthActive);
}

/**
 * Alters Najmafar's core meshes and aura to translucent, shimmering refraction
 * when veiled, and smoothly restores solid bio-chitin when revealed.
 */
export function updateStealthVisuals(active: boolean) {
    if (!STATE.playerGroup) return;

    const targetOpacity = active ? 0.28 : 1.0;
    const targetWire = active;

    STATE.playerGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
            const mat = (obj as THREE.Mesh).material;
            if (Array.isArray(mat)) {
                mat.forEach(m => applyMatStealth(m, targetOpacity, active));
            } else if (mat) {
                applyMatStealth(mat, targetOpacity, active);
            }
        }
    });
}

function applyMatStealth(mat: THREE.Material, targetOpacity: number, active: boolean) {
    mat.transparent = true;
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.14);

    if (active) {
        if ('emissive' in mat && (mat as any).emissive) {
            ((mat as any).emissive as THREE.Color).setHex(0xa855f7);
            (mat as any).emissiveIntensity = 0.45;
        }
    } else {
        if ('emissive' in mat && (mat as any).emissive) {
            ((mat as any).emissive as THREE.Color).setHex(0x003311);
            (mat as any).emissiveIntensity = 0.2;
        }
    }
}

/**
 * Immediate detection check when stealth collapses unexpectedly in hostile territory.
 */
function triggerProximityDetection() {
    const playerPos = STATE.playerPosition;
    const hasNearbyThreat = STATE.fleetShips.some(s => s.state !== 'disabled' && s.position.distanceTo(playerPos) < 45.0) ||
                            STATE.spaceStations.some(st => st.position.distanceTo(playerPos) < 55.0);

    if (hasNearbyThreat) {
        STATE.systemAlertLevel = 'hunt';
        STATE.systemAlertTimer = 35.0;
        addLogEntry("SYSTEM", `🚨 SENSOR-ALARM: Flotten-Arrays haben Najmafars ungetarnte Position gelockt!`);
    }
}

/**
 * Updates HUD badge for Stealth status.
 */
export function updateStealthHUD() {
    const badge = document.getElementById('stealth-status-badge');
    if (!badge) return;

    if (STATE.stealthActive) {
        badge.style.display = 'inline-flex';
        badge.className = 'stealth-badge active';
        badge.innerHTML = `🔮 <span>GETARNT</span>`;
    } else {
        badge.style.display = 'inline-flex';
        badge.className = 'stealth-badge inactive';
        badge.innerHTML = `👁️ <span>SICHTBAR</span>`;
    }
}
