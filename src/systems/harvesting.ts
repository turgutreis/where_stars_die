import { STATE } from '../core/state';
import { createHarvestBeam, removeHarvestBeam, updateHarvestBeam } from '../procedural/meshes';
import { getAudioContext, playBioHarvestSound, playBioCollectSound } from '../engine/audio';
import { addLogEntry } from '../ui/hud';
import { updateMutationUI } from '../ui/deck';

let harvestOsc: OscillatorNode | null = null;
let harvestHarmonicOsc: OscillatorNode | null = null;
let harvestGain: GainNode | null = null;
let harvestFilter: BiquadFilterNode | null = null;

export function triggerHarvestStart() {
    const target = (STATE.orbitLevel === 'moon' && STATE.activeMoonOrbit)
        ? STATE.activeMoonOrbit
        : (STATE.lockedTarget || STATE.nearestPlanet);

    if (!STATE.gameStarted || STATE.extractingPlanet || STATE.scanningPlanet || STATE.abductActive || !target || !target.mesh) return;

    // 1. Scan-Gating Invariant: Scanning is mandatory prior to resource harvesting
    const isScanned = target.scanned || (STATE.scannedPlanets && STATE.scannedPlanets[target.name]);
    if (!isScanned) {
        addLogEntry("WARNUNG", `Scan erforderlich [F]! Vor der Bio-Extraktion muss ${target.name} spektralanalysiert werden.`);
        return;
    }

    // 2. Resource Depletion: Finite extraction yield per celestial body
    const isDepleted = target.depleted || target.harvested || (STATE.depletedPlanets && STATE.depletedPlanets[target.name]);
    if (isDepleted) {
        addLogEntry("SYSTEM", `${target.isMoon ? 'Mond' : 'Planet'} ${target.name}: Planetare Ressourcen erschöpft. Keine extrahierbare Biomasse.`);
        return;
    }

    // 3. Channeling Cost: Bio-Siphon requires ship bio-energy
    const siphonEnergyCost = 10;
    if (STATE.bioEnergy < siphonEnergyCost) {
        addLogEntry("WARNUNG", `Unzureichende Bio-Energie (${Math.round(STATE.bioEnergy)}/${siphonEnergyCost}) für Siphon-Kanalisierung.`);
        return;
    }

    const meshScale = target.mesh ? target.mesh.scale.x : 1.0;
    const maxHarvestDist = Math.max(25.0, (target.size || 2.5) * meshScale * 3.8);
    const dx = STATE.playerPosition.x - target.mesh.position.x;
    const dz = STATE.playerPosition.z - target.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist >= maxHarvestDist) {
        addLogEntry("SYSTEM", `Außerhalb der Siphon-Reichweite (${Math.round(dist)} / ${Math.round(maxHarvestDist)} LJ).`);
        return;
    }

    STATE.bioEnergy = Math.max(0, STATE.bioEnergy - siphonEnergyCost);
    STATE.extractingPlanet = target;
    STATE.harvestProgress = 0;

    const progContainer = document.getElementById('harvest-progress-container');
    if (progContainer) progContainer.style.display = 'block';

    createHarvestBeam(STATE.playerPosition, target.mesh.position);
    startHarvestSound();

    addLogEntry("SYSTEM", `Bio-Siphon aktiviert. Extrahiere planetare Ressourcen von ${target.name}... (-10 Bio-Energie)`);
}

export function updateHarvesting(dt: number) {
    if (!STATE.extractingPlanet) return;

    const meshScale = STATE.extractingPlanet.mesh ? STATE.extractingPlanet.mesh.scale.x : 1.0;
    const maxHoldDist = Math.max(32.0, (STATE.extractingPlanet.size || 2.5) * meshScale * 4.4);
    const dx = STATE.playerPosition.x - STATE.extractingPlanet.mesh.position.x;
    const dz = STATE.playerPosition.z - STATE.extractingPlanet.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > maxHoldDist) {
        cancelHarvesting("Ziel außer Orbit-Reichweite.");
        return;
    }

    updateHarvestBeam(STATE.playerPosition, STATE.extractingPlanet.mesh.position);

    STATE.harvestProgress += dt * 30; // 3.3s to harvest
    updateHarvestSound(STATE.harvestProgress);

    const bar = document.getElementById('harvest-progress-bar');
    const text = document.getElementById('harvest-progress-text');
    if (bar) bar.style.width = `${STATE.harvestProgress}%`;
    if (text) text.innerText = `${Math.round(STATE.harvestProgress)}%`;

    if (STATE.harvestProgress >= 100) {
        completeHarvesting();
    }
}

export function cancelHarvesting(reason: string) {
    stopHarvestSound();
    removeHarvestBeam();
    addLogEntry("SYSTEM", `Assimilation abgebrochen: ${reason}`);
    STATE.extractingPlanet = null;
    STATE.harvestProgress = 0;
    const progContainer = document.getElementById('harvest-progress-container');
    if (progContainer) progContainer.style.display = 'none';
}

export function completeHarvesting() {
    stopHarvestSound();
    removeHarvestBeam();

    // Satisfying acoustic completion feedback
    playBioHarvestSound();
    setTimeout(() => {
        playBioCollectSound();
    }, 140);

    const progContainer = document.getElementById('harvest-progress-container');
    if (progContainer) progContainer.style.display = 'none';

    const planet = STATE.extractingPlanet;
    if (planet) {
        planet.depleted = true;
        planet.harvested = true;
        if (!STATE.depletedPlanets) STATE.depletedPlanets = {};
        STATE.depletedPlanets[planet.name] = true;

        const bioMult = (STATE.crewBuffs ? STATE.crewBuffs.bioGain : 1.0);
        const bioGain = Math.round((planet.type === 'Habitable' ? 65 : (planet.type === 'Gas Giant' ? 35 : 25)) * bioMult);
        const silGain = Math.round((planet.type === 'Rocky' || planet.isMoon ? 50 : 20) * bioMult);

        STATE.bioRes += bioGain;
        STATE.siliconRes += silGain;
        STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 25);
        STATE.health = Math.min(STATE.maxHealth, STATE.health + 15);

        // Quantum Resonance Boost: Entangled Twin worlds amplify extraction
        if (planet.attributes && planet.attributes.entangledTwinId) {
            const resonance = planet.attributes.quantumResonance || 0.85;
            const bonusBio = Math.round(bioGain * resonance * 0.4);
            STATE.bioRes += bonusBio;
            STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + 20);
            addLogEntry("SYSTEM", `QUANTEN-RESONANZ: Verschränkungsbrücke zu ${planet.attributes.entangledTwinId} aktiv! +${bonusBio} Resonanz-Biomasse | +20 Psionik.`);
        }

        // Magnetospheric Induction: Hyper-magnetic planets feed back into Najmafar's capacitor
        if (planet.attributes && planet.attributes.magnetosphere === 'Hyper-Magnetic') {
            STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 25);
            addLogEntry("SENSOR", `MAGNETOSPHÄREN-INDUKTION: Hyper-Magnetfeld von ${planet.name} induziert Bio-Ladung (+25 Bio-Energie).`);
        }

        // Easter Egg: Melange (Das Gewürz / Spice) Extraction on Arrakis
        if (planet.name && planet.name.includes("Arrakis")) {
            const spiceBioBonus = 80;
            const spicePsiBonus = 50;
            STATE.bioRes += spiceBioBonus;
            STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + spicePsiBonus);
            addLogEntry("SYSTEM", `✨ MELANGE-EXTRAKTION: Das heilige Gewürz von Arrakis durchströmt Najmafars Zellkerne! (+${spiceBioBonus} Melange-Biomasse | +${spicePsiBonus} Psionik).`);
        }

        // Subspace Rift (Plasma-Wirbel) in Deep Void: Siphoning reality tears recharges mental/psionic energy
        if (planet.type === 'Plasma-Wirbel') {
            const psiGain = 35;
            STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + psiGain);
            addLogEntry("SYSTEM", `🌀 SUBRAUM-SIPHON: Raumzeit-Fluktuation aus ${planet.name} absorbiert! +${psiGain} Mentalkraft (Raumzeit-Faltung wieder möglich).`);
        }

        addLogEntry("SYSTEM", `Assimilation von ${planet.name} abgeschlossen! +${bioGain} Biomasse | +${silGain} Silizium absorbiert. Vorkommen erschöpft.`);
        updateMutationUI();
    }

    STATE.extractingPlanet = null;
    STATE.harvestProgress = 0;
}

export function startHarvestSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    harvestOsc = ctx.createOscillator();
    harvestHarmonicOsc = ctx.createOscillator();
    harvestGain = ctx.createGain();
    harvestFilter = ctx.createBiquadFilter();

    // Warm, audible organic thrum: 160Hz triangle fundamental + 240Hz sine overtone
    harvestOsc.type = 'triangle';
    harvestOsc.frequency.setValueAtTime(160, ctx.currentTime);

    harvestHarmonicOsc.type = 'sine';
    harvestHarmonicOsc.frequency.setValueAtTime(240, ctx.currentTime);

    // Warm lowpass filter to remove harsh digital buzzing
    harvestFilter.type = 'lowpass';
    harvestFilter.frequency.setValueAtTime(650, ctx.currentTime);
    harvestFilter.Q.setValueAtTime(1.5, ctx.currentTime);

    // Clearly audible and comfortable volume (0.09)
    harvestGain.gain.setValueAtTime(0, ctx.currentTime);
    harvestGain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 0.25);

    harvestOsc.connect(harvestFilter);
    harvestHarmonicOsc.connect(harvestFilter);
    harvestFilter.connect(harvestGain);
    harvestGain.connect(ctx.destination);

    harvestOsc.start();
    harvestHarmonicOsc.start();
}

export function updateHarvestSound(progressPct: number) {
    if (harvestOsc && harvestHarmonicOsc) {
        const ctx = getAudioContext();
        if (!ctx) return;
        // Pitch gently rises as planetary resources flow into the ship (160Hz -> 230Hz)
        const baseFreq = 160 + (progressPct / 100.0) * 70;
        harvestOsc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
        harvestHarmonicOsc.frequency.setValueAtTime(baseFreq * 1.5, ctx.currentTime);
    }
}

export function stopHarvestSound() {
    if (harvestOsc) {
        const ctx = getAudioContext();
        const time = ctx ? ctx.currentTime : 0;
        if (harvestGain && time) {
            harvestGain.gain.cancelScheduledValues(time);
            harvestGain.gain.setValueAtTime(harvestGain.gain.value, time);
            harvestGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            harvestOsc.stop(time + 0.18);
            if (harvestHarmonicOsc) harvestHarmonicOsc.stop(time + 0.18);
        } else {
            harvestOsc.stop();
            if (harvestHarmonicOsc) harvestHarmonicOsc.stop();
        }
        harvestOsc = null;
        harvestHarmonicOsc = null;
        harvestGain = null;
        harvestFilter = null;
    }
}
