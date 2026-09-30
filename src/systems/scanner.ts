import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { addLogEntry } from '../ui/hud';
import { startQuantumScanSound, updateQuantumScanSound, stopQuantumScanSound } from '../engine/audio';
import { collapseQuantumCivilization } from '../procedural/quantum-civ';
import { getFaction } from '../systems/factions';
import { openDiplomacyComms } from '../systems/diplomacy';
import { createScanVisuals, updateScanVisuals, removeScanVisuals } from '../procedural/meshes';
import { SpeciesData, PlanetAttributes, FleetShip, SpaceStation } from '../types/game';
import { generateProceduralCandidates } from './crew-generation';
import { advanceFtueStep, triggerVoyagerSignalDetection } from '../ui/directives';
import { abductCrewFromShip } from './abduction';

export function generatePlanetAttributes(p: any): PlanetAttributes {
    const sysId = STATE.currentSystemId || 0;
    const nameHash = (p.name || '').split('').reduce((acc: number, char: string) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0);
    const distFactor = Math.floor((p.distance || 1) * 73);
    const hash = ((sysId * 7919) ^ (nameHash * 17) ^ distFactor) >>> 0;

    const tidalLock = typeof p.tidalLock === 'boolean'
        ? p.tidalLock
        : ((p.distance || 50) < 28 || (p.type === 'Rocky' && hash % 4 === 0));

    const magnetosphere: 'None' | 'Weak' | 'Strong' | 'Hyper-Magnetic' = p.magnetosphere || (
        p.type === 'Gas Giant'
            ? (hash % 3 === 0 ? 'Hyper-Magnetic' : 'Strong')
            : (p.type === 'Habitable'
                ? (hash % 3 === 0 ? 'Weak' : 'Strong')
                : (p.type === 'Rocky' ? (hash % 3 === 0 ? 'None' : (hash % 3 === 1 ? 'Weak' : 'Strong')) : 'Weak'))
    );

    const geothermal: 'Dead' | 'Dormant' | 'Active Geysers' | 'Hyper-Volcanic' = p.geothermal || (
        p.type === 'Gas Giant'
            ? (hash % 2 === 0 ? 'Dead' : 'Dormant')
            : (p.type === 'Habitable'
                ? (hash % 2 === 0 ? 'Dormant' : 'Active Geysers')
                : (p.type === 'Rocky' ? (hash % 3 === 0 ? 'Hyper-Volcanic' : (hash % 3 === 1 ? 'Active Geysers' : 'Dead')) : 'Active Geysers'))
    );

    const radiationLevel: 'Low' | 'Moderate' | 'High' | 'Extreme' = p.radiationLevel || (
        hash % 4 === 0 ? 'Extreme' : (hash % 4 === 1 ? 'High' : (hash % 4 === 2 ? 'Moderate' : 'Low'))
    );

    const entangledTwinId = p.entangledTwinId ?? null;
    const quantumResonance = p.quantumResonance ?? (entangledTwinId ? 0.85 : 0.0);

    if (p.atmos && p.temp && p.bio && p.res && (p.type !== 'Habitable' || (p.species && p.species.candidates && p.species.candidates.length > 0))) {
        return {
            atmos: p.atmos,
            temp: p.temp,
            bio: p.bio,
            res: p.res,
            species: p.species || null,
            tidalLock,
            magnetosphere,
            geothermal,
            radiationLevel,
            entangledTwinId,
            quantumResonance
        };
    }

    let atmos: string, temp: string, bio: string, res: string, species: any;
    if (p.type === 'Habitable') {
        atmos = hash % 2 === 0 ? "Stickstoff & Sauerstoff (Klasse M)" : "Dichte Aerosole & Wasserdampf";
        temp = (15 + (hash % 15)) + "°C";
        bio = hash % 3 === 0 ? "Biolumineszierende Flora" : (hash % 3 === 1 ? "Mikrobielle Kolonien" : "Komplexes Ökosystem");
        res = "Reich an Biomasse, Kohlenstoff & O2";

        const pool = generateProceduralCandidates(hash, hash % 2 === 0 ? 2 : 1);

        const qCiv = collapseQuantumCivilization(STATE.currentSystemId, hash % 8, hash);
        const faction = getFaction(qCiv.factionId);

        species = {
            hasSentient: true,
            name: `${qCiv.societalArchetype} (${faction.shortName})`,
            population: pool.length * 1000 + (hash % 500),
            candidates: pool,
            techLevel: qCiv.quantumTechLevel,
            defenseRating: qCiv.quantumTechLevel === 'Primitive' ? 0 : (qCiv.quantumTechLevel === 'Industrial' ? 20 : (qCiv.quantumTechLevel === 'Spacefaring' ? 65 : 95)),
            fleetDisposition: qCiv.militaryDoctrine === 'Militaristic' ? 'Militaristic' : (qCiv.militaryDoctrine === 'Pacifist' ? 'Pacifist' : 'Defensive'),
            factionId: qCiv.factionId,
            quantumCiv: qCiv
        };
    } else if (p.type === 'Gas Giant') {
        atmos = hash % 2 === 0 ? "Flüssiges Helium & Wasserstoff" : "Superdichtes Ammoniak & Methan";
        temp = (-120 - (hash % 60)) + "°C";
        bio = hash % 5 === 0 ? "Schwebende Plankton-Analoge" : "Keine Signaturen erfasst";
        res = "Extrem hoher Druck, Deuterium-Vorkommen";
        species = null;
    } else { // Rocky
        atmos = hash % 3 === 0 ? "Dünnes CO2-Vakuum" : (hash % 3 === 1 ? "Schwefeldioxid & Argon" : "Keine Atmosphäre (Vakuum)");
        temp = (hash % 2 === 0 ? "+" : "-") + (hash % 250) + "°C";
        bio = hash % 8 === 0 ? "Extremophile Flechten" : "Steril";
        res = "Reich an Silizium-Kristallen, Eisen & Schwermetallen";
        species = null;
    }

    return { 
        atmos, 
        temp, 
        bio, 
        res, 
        species,
        tidalLock,
        magnetosphere,
        geothermal,
        radiationLevel,
        entangledTwinId,
        quantumResonance
    };
}

export function generateFallbackMoons(p: any) {
    const hash = p.name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    let count = 0;
    if (p.type === 'Gas Giant') count = 1 + (hash % 3);
    else if (p.type === 'Habitable') count = hash % 3;
    else count = hash % 2;

    const moons = [];
    for (let i = 0; i < count; i++) {
        const mType = (p.type === 'Gas Giant' || (hash + i) % 3 === 0) ? "Eismond" : (((hash + i) % 3 === 1) ? "Vulkanmond" : "Kratermond");
        const mColor = mType === 'Eismond' ? "0x38bdf8" : (mType === 'Vulkanmond' ? "0xf97316" : "0x94a3b8");
        const mGeo = mType === 'Eismond' ? "Active Geysers" : (mType === 'Vulkanmond' ? "Hyper-Volcanic" : "Dead");
        moons.push({
            name: `${p.name}-${String.fromCharCode(73 + i)}`,
            type: mType,
            size: 0.7 + ((hash + i) % 5) * 0.1,
            distance: p.size + 3.2 + (i * 2.5),
            speed: 0.9 + ((hash + i) % 6) * 0.15,
            color: mColor,
            temp: mType === 'Eismond' ? "-170°C" : (mType === 'Vulkanmond' ? "+220°C" : "-40°C"),
            atmos: mType === 'Eismond' ? "Subglazialer Wasserdampf" : (mType === 'Vulkanmond' ? "Schwefeldioxid-Ausgasungen" : "Vakuum"),
            bio: mType === 'Eismond' ? "Kryophile Mikroben" : (mType === 'Vulkanmond' ? "Schwefel-Synthetisierer" : "Steril"),
            res: mType === 'Eismond' ? "Reich an Deuterium-Eis" : (mType === 'Vulkanmond' ? "Geschmolzenes Titan & Silizium" : "Regolith & Schwermetalle"),
            tidalLock: true,
            geothermal: mGeo,
            parentPlanetName: p.name
        });
    }
    return moons;
}

export function triggerScanStart() {
    let target: any = STATE.lockedTarget || ((STATE.orbitLevel === 'moon' && STATE.activeMoonOrbit)
        ? STATE.activeMoonOrbit
        : STATE.nearestPlanet);

    // If no locked target, check if any FleetShip or SpaceStation is in close proximity (< 25 AE) and closer
    if (!STATE.lockedTarget) {
        let bestObj: any = null;
        let bestDist = Infinity;
        const playerPos = STATE.playerPosition;

        STATE.spaceStations.forEach(st => {
            const d = st.position.distanceTo(playerPos);
            if (d < 30.0 && d < bestDist) {
                bestDist = d;
                bestObj = st;
            }
        });

        STATE.fleetShips.forEach(s => {
            if (s.state === 'disabled') return;
            const d = s.position.distanceTo(playerPos);
            if (d < 25.0 && d < bestDist) {
                bestDist = d;
                bestObj = s;
            }
        });

        if (bestObj) {
            const curDist = target && target.mesh ? target.mesh.position.distanceTo(playerPos) : Infinity;
            if (bestDist < curDist) {
                target = bestObj;
            }
        }
    }

    if (!STATE.gameStarted || STATE.scanningPlanet || STATE.extractingPlanet || !target) return;

    const isShip = target.type === 'interceptor' || target.type === 'corvette' || target.type === 'freighter' || target.type === 'heavy_freighter';
    const isStation = target.type === 'citadel' || target.type === 'trade_hub' || target.type === 'mining_relay';

    const isAlreadyScanned = target.scanned || (STATE.scannedPlanets && STATE.scannedPlanets[target.name]);
    if (isAlreadyScanned) {
        addLogEntry("SYSTEM", `${isStation ? 'Raumstation' : (isShip ? 'Schiff' : (target.isMoon ? 'Mond' : 'Planet'))} ${target.name} ist bereits vollständig gescannt & analysiert.`);
        return;
    }

    const meshScale = target.mesh ? target.mesh.scale.x : 1.0;
    const maxScanDist = isStation ? 35.0 : (isShip ? 28.0 : Math.max(25.0, (target.size || 2.5) * meshScale * 3.8));
    const targetPos = target.mesh ? target.mesh.position : (target.position || new THREE.Vector3(0, 0, 0));
    const dx = STATE.playerPosition.x - targetPos.x;
    const dz = STATE.playerPosition.z - targetPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist >= maxScanDist) return;

    STATE.scanningPlanet = target;
    STATE.scanProgress = 0;

    const progContainer = document.getElementById('scan-progress-container');
    if (progContainer) progContainer.style.display = 'block';

    const scanBtn = document.getElementById('start-scan-btn');
    if (scanBtn) scanBtn.setAttribute('disabled', 'true');

    const visualRadius = isStation ? 5.5 : (isShip ? 2.5 : (target.size || 3.0) * meshScale);
    createScanVisuals(STATE.playerPosition, targetPos, visualRadius);
    startQuantumScanSound();
    addLogEntry("SYSTEM", `${isShip ? 'Telepathie- & Frequenz-Scan' : (isStation ? 'Orbital-Stations-Scan' : 'Spektral-Scan')} initiiert für: ${target.name}. Halte Sensordistanz...`);
}

export function updateScanning(dt: number) {
    if (!STATE.scanningPlanet) return;

    const isShip = STATE.scanningPlanet.type === 'interceptor' || STATE.scanningPlanet.type === 'corvette' || STATE.scanningPlanet.type === 'freighter' || STATE.scanningPlanet.type === 'heavy_freighter';
    const isStation = STATE.scanningPlanet.type === 'citadel' || STATE.scanningPlanet.type === 'trade_hub' || STATE.scanningPlanet.type === 'mining_relay';

    const meshScale = STATE.scanningPlanet.mesh ? STATE.scanningPlanet.mesh.scale.x : 1.0;
    const maxHoldDist = isStation ? 42.0 : (isShip ? 35.0 : Math.max(32.0, (STATE.scanningPlanet.size || 2.5) * meshScale * 4.4));

    const targetPos = STATE.scanningPlanet.mesh ? STATE.scanningPlanet.mesh.position : (STATE.scanningPlanet.position || new THREE.Vector3(0, 0, 0));
    const dx = STATE.playerPosition.x - targetPos.x;
    const dz = STATE.playerPosition.z - targetPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > maxHoldDist) {
        cancelScanning("Signalverlust. Abstand überschritt Sicherheitsradius.");
        return;
    }

    updateScanVisuals(STATE.playerPosition, targetPos);

    const scanSpeedMult = (STATE.crewBuffs ? STATE.crewBuffs.scanSpeed : 1.0);
    STATE.scanProgress += dt * 35 * scanSpeedMult;

    // Real-time quantum telemetry frequency modulation
    updateQuantumScanSound(STATE.scanProgress);

    const bar = document.getElementById('scan-progress-bar');
    const text = document.getElementById('scan-progress-text');
    if (bar) bar.style.width = `${STATE.scanProgress}%`;
    if (text) text.innerText = `${Math.round(STATE.scanProgress)}%`;

    if (STATE.scanProgress >= 100) {
        completeScanning();
    }
}

export function cancelScanning(reason: string) {
    stopQuantumScanSound(false);
    removeScanVisuals();
    addLogEntry("SYSTEM", `Scan abgebrochen: ${reason}`);
    STATE.scanningPlanet = null;
    STATE.scanProgress = 0;
    const progContainer = document.getElementById('scan-progress-container');
    if (progContainer) progContainer.style.display = 'none';
}

export function completeScanning() {
    stopQuantumScanSound(true);
    removeScanVisuals();
    const progContainer = document.getElementById('scan-progress-container');
    if (progContainer) progContainer.style.display = 'none';

    const target = STATE.scanningPlanet;
    try {
        if (target) {
            const isShip = target.type === 'interceptor' || target.type === 'corvette' || target.type === 'freighter' || target.type === 'heavy_freighter';
            const isStation = target.type === 'citadel' || target.type === 'trade_hub' || target.type === 'mining_relay';

            target.scanned = true;

            if (isShip) {
                STATE.bioRes += 10;
                STATE.siliconRes += 15;
                STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + 15);

                const civ = target.civilizationName || target.factionName || 'Unbekannte Zivilisation';
                const home = target.homePlanet?.name || 'Sektor';
                addLogEntry("SYSTEM", `🧠 TELEPATHIE-SCAN ERFOLGREICH: ${target.name} (${civ}) durchleuchtet! (+15 Silizium | +15 Mentalkraft)`);
                addLogEntry("CREW", `Capt. Miller: 'Bordfunk synchronisiert! Schiff von ${home}. Kommandant: ${target.commanderName}, ${target.crewMembers?.length || 1} Besatzungsmitglied(er) an Bord.'`);
                updateScannerUI(target, 10);
            } else if (isStation) {
                STATE.siliconRes += 25;
                STATE.bioRes += 15;
                STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + 20);

                const civ = target.civilizationName || target.factionName || 'Unbekannte Zivilisation';
                addLogEntry("SYSTEM", `🛰️ STATIONS-ANALYSE ERFOLGREICH: ${target.name} (${civ}) kartografiert! (+25 Silizium | +20 Mentalkraft)`);
                addLogEntry("CREW", `Capt. Miller: 'Stationsleitung ${target.commanderName} erfasst. ${target.population?.toLocaleString() || '1.200'} Einwohner im Habitat-Ring.'`);
                updateScannerUI(target, 10);
            } else {
                if (!target.attributes) {
                    target.attributes = generatePlanetAttributes(target);
                }
                STATE.scannedPlanets[target.name] = true;

                STATE.bioRes += 15;
                STATE.siliconRes += 10;
                STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + 15);

                addLogEntry("SYSTEM", `Spektral-Scan von ${target.name} abgeschlossen! Atmosphärendatenbank aktualisiert (+15 Bio | +10 Silizium).`);

                if (target.attributes?.entangledTwinId) {
                    addLogEntry("SYSTEM", `QUANTEN-KOPPLUNG: ${target.name} ist resonant verschränkt mit ${target.attributes.entangledTwinId} (${Math.round((target.attributes.quantumResonance || 0.85) * 100)}% Resonanz)!`);
                }

                if (target.attributes?.species && target.attributes.species.population > 0) {
                    addLogEntry("SYSTEM", `PSIO-DETEKTION: Intelligentes Leben (${target.attributes.species.name}) auf ${target.name} entdeckt! Psionischer Transfer [F] bereit.`);
                } else {
                    addLogEntry("SENSOR", `Atmosphärendaten: ${target.attributes?.atmos || 'Vakuum'} | Bio: ${target.attributes?.bio || 'Steril'}. Keine Lebensformen detektiert.`);
                }

                if ((STATE.ftueStep || 0) <= 1 && !STATE.voyagerSignalDetected) {
                    triggerVoyagerSignalDetection();
                } else if ((STATE.ftueStep || 0) === 1) {
                    advanceFtueStep(2);
                }

                updateScannerUI(target, 10);
            }
        }
    } catch (err) {
        console.error("Scanner completion error:", err);
    } finally {
        STATE.scanningPlanet = null;
        STATE.scanProgress = 0;
    }
}

let manuallyDismissedTarget: string | null = null;

export function dismissScannerPanel(): void {
    const scannerPanel = document.getElementById('left-deck-panel');
    if (scannerPanel) {
        scannerPanel.classList.remove('visible');
    }
    if (STATE.lockedTarget) {
        manuallyDismissedTarget = STATE.lockedTarget.name;
    } else if (STATE.nearestPlanet) {
        manuallyDismissedTarget = STATE.nearestPlanet.name;
    }
}

export function resetDismissedScanner(): void {
    manuallyDismissedTarget = null;
}

export function updateScannerUI(planet: any, dist: number) {
    const nameEl = document.getElementById('scan-planet-name');
    const distEl = document.getElementById('scan-planet-dist');
    const scanBtn = document.getElementById('start-scan-btn') as HTMLButtonElement | null;
    const placeholderBox = document.getElementById('scan-placeholder-box');
    const resultsBox = document.getElementById('scan-results-box');
    const harvestBtn = document.getElementById('start-harvest-btn');
    const abductBtn = document.getElementById('start-abduct-btn');
    const scannerPanel = document.getElementById('left-deck-panel');

    if (!planet) {
        if (scannerPanel) scannerPanel.classList.remove('visible');
        return;
    }

    // Reset manual dismissal if target changed
    if (manuallyDismissedTarget && manuallyDismissedTarget !== planet.name) {
        manuallyDismissedTarget = null;
    }

    const isLocked = STATE.lockedTarget && STATE.lockedTarget.name === planet.name;
    const isInOrbit = (STATE.orbitPlanet && STATE.orbitPlanet.name === planet.name) ||
                      (STATE.activeMoonOrbit && STATE.activeMoonOrbit.name === planet.name);
    const isCurrentlyVisible = scannerPanel ? scannerPanel.classList.contains('visible') : false;
    const isDismissed = manuallyDismissedTarget === planet.name;

    let shouldShow = false;
    if (!isDismissed) {
        if (isInOrbit || isLocked) {
            shouldShow = true;
        } else if (isCurrentlyVisible) {
            shouldShow = dist <= 30; // Keep open while within 30 units
        } else {
            shouldShow = dist <= 25; // Auto-open only when actually within interaction range
        }
    }

    if (scannerPanel) {
        if (shouldShow) {
            scannerPanel.classList.add('visible');
        } else {
            scannerPanel.classList.remove('visible');
        }
    }

    const isShip = planet && (planet.type === 'interceptor' || planet.type === 'corvette' || planet.type === 'freighter' || planet.type === 'heavy_freighter');
    const isStation = planet && (planet.type === 'citadel' || planet.type === 'trade_hub' || planet.type === 'mining_relay');

    if (nameEl) {
        if (isShip) {
            const shipTypeLabel = planet.type === 'corvette' ? 'Schwere Korvette' : (planet.type === 'freighter' ? 'Ziviler Frachter' : 'Abfangjäger');
            nameEl.innerText = `${planet.name} (${shipTypeLabel})`;
        } else if (isStation) {
            const stationTypeLabel = planet.type === 'citadel' ? 'Orbital-Zitadelle' : (planet.type === 'trade_hub' ? 'Handels-Hub' : 'Bergbau-Relais');
            nameEl.innerText = `${planet.name} (${stationTypeLabel})`;
        } else {
            nameEl.innerText = `${planet.name} (${planet.isMoon ? 'Mond' : planet.type})`;
        }
    }

    const orbitBadge = document.getElementById('orbit-subsystem-badge');
    const orbitBadgeTitle = document.getElementById('orbit-badge-title');
    const orbitBadgeSub = document.getElementById('orbit-badge-sub');

    if (orbitBadge) {
        if (!isShip && !isStation && STATE.orbitLevel === 'moon' && STATE.activeMoonOrbit) {
            orbitBadge.style.display = 'flex';
            if (orbitBadgeTitle) {
                orbitBadgeTitle.innerText = `🌕 MOND-ORBIT: ${STATE.activeMoonOrbit.name.toUpperCase()}`;
            }
            if (orbitBadgeSub) {
                const parentName = STATE.activeMoonOrbit.parentPlanet ? STATE.activeMoonOrbit.parentPlanet.name : (STATE.orbitPlanet ? STATE.orbitPlanet.name : 'Zentralkörper');
                const curRadius = STATE.activeMoonOrbit.source ? STATE.activeMoonOrbit.source.radius : (STATE.activeMoonOrbit.size || 1.0);
                const alt = Math.max(0.1, dist - curRadius).toFixed(1);
                orbitBadgeSub.innerText = `Mutterplanet: ${parentName} • Höhe: ${alt} LJ`;
            }
        } else if (!isShip && !isStation && STATE.orbitLevel === 'planet' && STATE.orbitPlanet) {
            orbitBadge.style.display = 'flex';
            if (orbitBadgeTitle) {
                orbitBadgeTitle.innerText = `🪐 SUB-SYSTEM: ${STATE.orbitPlanet.name.toUpperCase()}`;
            }
            if (orbitBadgeSub) {
                const moons = activePlanets.filter(m => m.isMoon && m.parentPlanet === STATE.orbitPlanet);
                const curRadius = STATE.orbitPlanet.source ? STATE.orbitPlanet.source.radius : (STATE.orbitPlanet.size || 2.5);
                const alt = Math.max(0.2, dist - curRadius).toFixed(1);
                orbitBadgeSub.innerText = `Höhe: ${alt} LJ • ${moons.length} Monde im Orbit`;
            }
        } else {
            orbitBadge.style.display = 'none';
        }
    }

    const meshScale = planet.mesh ? planet.mesh.scale.x : 1.0;
    const maxScanDist = isStation ? 35.0 : (isShip ? 28.0 : Math.max(25.0, (planet.size || 2.5) * meshScale * 3.8));
    const inRange = dist < maxScanDist;
    const isScanned = Boolean(planet.scanned || STATE.scannedPlanets[planet.name]);

    if (distEl) {
        distEl.innerText = `${dist.toFixed(1)} ${inRange ? '(In Sensorreichweite)' : '(Zu weit entfernt)'}`;
        distEl.style.color = inRange ? '#10b981' : '#f59e0b';
    }

    if (scanBtn) {
        scanBtn.disabled = !inRange || isScanned || (STATE.scanningPlanet !== null);
        if (isScanned) {
            scanBtn.innerText = isShip ? "Telepathie-Dossier Geladen ✓" : (isStation ? "Stations-Scan Abgeschlossen ✓" : "Oberflächenscan Abgeschlossen ✓");
        } else {
            scanBtn.innerText = inRange ? (isShip ? "Telepathie-Scan [F]" : (isStation ? "Station Scannen [F]" : "Scan initiieren [F]")) : `Zu weit entfernt (< ${Math.round(maxScanDist)} nötig)`;
        }
    }

    if (isScanned) {
        if (placeholderBox) placeholderBox.style.display = 'none';
        if (resultsBox) resultsBox.style.display = 'block';

        const titleEl = document.getElementById('scan-planet-title');
        const typeEl = document.getElementById('scan-planet-type');
        const tempEl = document.getElementById('scan-planet-temp');
        const bioEl = document.getElementById('scan-planet-bio');
        const atmosEl = document.getElementById('scan-planet-atmos');
        const quantumRow = document.getElementById('scan-planet-quantum-row');
        const quantumEl = document.getElementById('scan-planet-quantum');
        const physicsRow = document.getElementById('scan-planet-physics-row');
        const physicsEl = document.getElementById('scan-planet-physics');
        const radiationRow = document.getElementById('scan-planet-radiation-row');
        const radiationEl = document.getElementById('scan-planet-radiation');
        const resEl = document.getElementById('scan-planet-resources');
        const speciesRow = document.getElementById('scan-planet-species-row');
        const speciesEl = document.getElementById('scan-planet-species');
        const techRow = document.getElementById('scan-planet-tech-row');
        const techEl = document.getElementById('scan-planet-tech');
        const fleetRow = document.getElementById('scan-planet-fleet-row');
        const fleetEl = document.getElementById('scan-planet-fleet');
        const commsBtn = document.getElementById('start-comms-btn');

        if (isShip || isStation) {
            if (titleEl) titleEl.innerText = isStation ? `Station: ${planet.name}` : `Schiff: ${planet.name}`;
            if (typeEl) {
                typeEl.innerText = isStation
                    ? (planet.type === 'citadel' ? 'Orbital-Zitadelle' : (planet.type === 'trade_hub' ? 'Handels-Hub' : 'Bergbau-Relais'))
                    : (planet.type === 'corvette' ? 'Schwere Korvette' : (planet.type === 'freighter' ? 'Ziviler Frachter' : 'Leichter Abfangjäger'));
            }
            if (tempEl) tempEl.innerText = `${planet.health} / ${planet.maxHealth} HP (Struktur & Hülle)`;
            if (bioEl) {
                bioEl.innerText = planet.state === 'stunned'
                    ? '⚡ Systeme gelähmt (EMP-Schock)'
                    : (planet.state === 'hunt' || planet.state === 'intercept'
                        ? '🚨 Roter Alarm: Kampf & Jagd'
                        : (planet.state === 'flee'
                            ? '⚠️ Panik: Ausweichmanöver vor Bio-Signatur'
                            : (planet.state === 'trade_cruise'
                                ? '📦 Interstellarer Handels-Transit'
                                : (planet.state === 'trade_docked'
                                    ? '⚓ Im Fracht-Dock (Löscht/Bunkert Fracht)'
                                    : (planet.state === 'returning' ? '🔄 Flug zum Heimat-Orbit' : '🛡️ Normaler Patrouillenbetrieb')))));
            }
            if (atmosEl) {
                atmosEl.innerText = planet.cargo
                    ? `📦 Frachtgut: ${planet.cargo.amount}x ${planet.cargo.type === 'silicon' ? 'Silizium' : 'Biomasse'}`
                    : (isStation ? '🏢 Fracht-Docks & Wohnringe' : 'Militärische Bewaffnung (Keine Handelsgüter)');
            }

            if (quantumRow) quantumRow.style.display = 'none';
            if (radiationRow) radiationRow.style.display = 'none';

            if (physicsRow && physicsEl) {
                physicsRow.style.display = 'flex';
                const physLabel = physicsRow.querySelector('.label') as HTMLElement;
                if (physLabel) physLabel.innerText = isStation ? 'Deflektorschilde:' : 'Antrieb:';
                physicsEl.innerText = isStation
                    ? `Schildbewertung: ${planet.defenseRating}/100`
                    : `Sub-Licht-Ionenschub (${planet.velocity ? Math.round(planet.velocity.length()) : 0} AE/s)`;
            }

            // Civilization & Crew Member Cards
            if (speciesRow && speciesEl) {
                speciesRow.style.display = 'flex';
                const specLabel = speciesRow.querySelector('.label') as HTMLElement;
                if (specLabel) specLabel.innerText = 'Zivilisation & Crew:';

                const faction = planet.factionId ? getFaction(planet.factionId as any) : null;
                const civ = planet.civilizationName || faction?.name || 'Unabhängige Sternen-Allianz';
                const home = planet.homePlanet?.name || (planet.parentPlanet ? planet.parentPlanet.name : 'Sektor');

                let crewHtml = `
                    <div style="margin-bottom: 6px;">
                        <span style="color: #38bdf8; font-weight: bold;">${faction?.emblem || '🏛️'} ${civ}</span>
                        <span style="color: #94a3b8; font-size: 0.72rem;"> (${planet.factionName || faction?.shortName || 'Unabhängig'} • Heimat: ${home})</span>
                    </div>`;

                if (planet.crewMembers && planet.crewMembers.length > 0) {
                    crewHtml += `<div style="font-weight: 600; color: #a855f7; margin-bottom: 3px; font-size: 0.74rem;">👥 Besatzung (${planet.crewMembers.length}):</div>`;
                    planet.crewMembers.forEach((c: any) => {
                        crewHtml += `
                        <div class="ship-crew-card">
                            <div class="crew-header">
                                <span>${c.avatarIcon || '👤'}</span>
                                <span style="color: #f1f5f9;">${c.name}</span>
                                <span style="color: #38bdf8; font-size: 0.68rem;">[${c.roleName || c.role}]</span>
                            </div>
                            <div style="color: #94a3b8; font-size: 0.68rem;">Spezies: ${c.speciesArchetypeName || c.species} • Trait: ${c.trait?.name || 'Standard'}</div>
                            ${c.thought ? `<div class="crew-thought">💭 "${c.thought}"</div>` : ''}
                        </div>`;
                    });
                }

                if (isStation && planet.population) {
                    crewHtml += `<div style="color: #06b6d4; font-size: 0.72rem; margin-top: 4px;">👥 Habitat-Bevölkerung: ~${planet.population.toLocaleString()} Wesen</div>`;
                }

                speciesEl.innerHTML = crewHtml;
            }

            if (techRow && techEl) {
                techRow.style.display = 'flex';
                const techLabel = techRow.querySelector('.label') as HTMLElement;
                if (techLabel) techLabel.innerText = 'Doktrin:';
                const faction = planet.factionId ? getFaction(planet.factionId as any) : null;
                techEl.innerText = faction ? `${faction.emblem} ${faction.doctrine}` : (isStation ? 'Raumstation der Föderation' : 'Militärische Abfangstaffel');
            }

            if (fleetRow) fleetRow.style.display = 'none';

            if (resEl) {
                resEl.innerText = planet.cargo
                    ? `Erbeutbare Fracht: +${planet.cargo.amount} ${planet.cargo.type === 'silicon' ? 'Silizium' : 'Biomasse'}`
                    : (isStation ? 'Handelsgüter & Flottentreibstoff' : 'Silizium-Legierungen & Schiffsschrott');
            }

            if (commsBtn) {
                commsBtn.style.display = (inRange && (isStation || planet.state === 'trade_cruise' || planet.state === 'patrol')) ? 'block' : 'none';
                if (isStation) {
                    commsBtn.onclick = () => openDiplomacyComms(planet.parentPlanet || planet);
                }
            }

            if (harvestBtn) {
                const canHarvest = (planet.state === 'stunned' || planet.state === 'disabled') && inRange;
                harvestBtn.style.display = canHarvest ? 'block' : 'none';
                if (canHarvest) {
                    (harvestBtn as HTMLButtonElement).disabled = false;
                    harvestBtn.innerText = 'Wrack plündern [E]';
                }
            }

            if (abductBtn) {
                const canAbduct = (planet.state === 'stunned' || planet.state === 'disabled') && planet.crewMembers && planet.crewMembers.length > 0 && inRange;
                abductBtn.style.display = canAbduct ? 'block' : 'none';
                if (canAbduct) {
                    abductBtn.innerText = 'Besatzung per Kokon bergen [F]';
                    abductBtn.onclick = () => {
                        abductCrewFromShip(planet);
                    };
                }
            }
        } else {
            // Planet / Moon Rendering
            if (!planet.attributes) {
                planet.attributes = generatePlanetAttributes(planet);
            }
            const attrs = planet.attributes;

            if (titleEl) titleEl.innerText = `Analyse: ${planet.name}`;
            if (typeEl) typeEl.innerText = `${planet.type} (${planet.size}x)`;
            if (tempEl) tempEl.innerText = attrs.temp || '-';
            if (bioEl) bioEl.innerText = attrs.bio || '-';
            if (atmosEl) atmosEl.innerText = attrs.atmos || '-';

            if (quantumRow && quantumEl) {
                if (attrs.entangledTwinId) {
                    quantumRow.style.display = 'flex';
                    const resPct = Math.round((attrs.quantumResonance || 0.85) * 100);
                    quantumEl.innerHTML = `🔗 Verschränkt mit <span style="color: #c084fc; font-weight: bold;">${attrs.entangledTwinId}</span> (${resPct}% Resonanz)`;
                } else {
                    quantumRow.style.display = 'none';
                }
            }

            if (physicsRow && physicsEl) {
                physicsRow.style.display = 'flex';
                const physLabel = physicsRow.querySelector('.label') as HTMLElement;
                if (physLabel) physLabel.innerText = 'Planetare Physik:';
                const rotText = attrs.tidalLock ? "Gebundene Rotation (1:1)" : "Freie Rotation";
                const geoText = attrs.geothermal ? ` • ${attrs.geothermal}` : "";
                physicsEl.innerText = `${rotText}${geoText}`;
            }

            if (radiationRow && radiationEl) {
                radiationRow.style.display = 'flex';
                const radLevel = attrs.radiationLevel || 'Normal';
                const magLevel = attrs.magnetosphere ? ` • 🧲 ${attrs.magnetosphere}` : "";
                radiationEl.innerText = `${radLevel}${magLevel}`;
                if (radLevel === 'Extreme') {
                    radiationEl.style.color = '#f43f5e';
                } else if (radLevel === 'High') {
                    radiationEl.style.color = '#fb923c';
                } else {
                    radiationEl.style.color = '#facc15';
                }
            }

            if (resEl) resEl.innerText = attrs.res || '-';

            const spec = attrs.species;
            const hasSentient = spec && spec.population > 0;

            if (speciesRow && speciesEl) {
                const specLabel = speciesRow.querySelector('.label') as HTMLElement;
                if (specLabel) specLabel.innerText = 'Intelligentes Leben:';

                if (hasSentient) {
                    speciesRow.style.display = 'flex';
                    let candidateTag = '';
                    if (spec.candidates && spec.candidates.length > 0) {
                        const topCand = spec.candidates[0];
                        const hasRole = STATE.crew.some(c => c.role === topCand.role);
                        candidateTag = hasRole
                            ? `<br><span class="candidate-role-synergy-tag duplicate-role">👥 Ziel: ${topCand.roleName || topCand.role} (Verstärkt Buffs)</span>`
                            : `<br><span class="candidate-role-synergy-tag new-role">✨ Ziel: ${topCand.roleName || topCand.role} (Neue Rolle: Synergie!)</span>`;
                    }
                    speciesEl.innerHTML = `<span style="color: #38bdf8; font-weight: bold;">${spec.name}</span> (Pop: ${spec.population})${candidateTag}`;
                } else {
                    speciesRow.style.display = 'none';
                }
            }

            if (techRow && techEl) {
                const techLabel = techRow.querySelector('.label') as HTMLElement;
                if (techLabel) techLabel.innerText = 'Zivilisation:';

                if (hasSentient && spec.techLevel) {
                    techRow.style.display = 'flex';
                    let icon = '🏛️';
                    if (spec.techLevel === 'Industrial') icon = '🏭';
                    if (spec.techLevel === 'Spacefaring') icon = '🚀';
                    if (spec.techLevel === 'Hyper-Advanced') icon = '🌌';
                    techEl.innerText = `${icon} ${spec.techLevel} (${spec.fleetDisposition || 'Defensiv'})`;
                } else {
                    techRow.style.display = 'none';
                }
            }

            if (fleetRow && fleetEl) {
                if (hasSentient && (spec.techLevel === 'Spacefaring' || spec.techLevel === 'Hyper-Advanced')) {
                    fleetRow.style.display = 'flex';
                    const activeShips = STATE.fleetShips.filter(s => s.homePlanet.name === planet.name);
                    const alertText = activeShips.some(s => s.state === 'intercept') ? '🚨 ALARM: Abfangkurs!' : '🛡️ Patrouille aktiv';
                    fleetEl.innerText = `${activeShips.length} Einheiten | ${alertText}`;
                    fleetEl.style.color = activeShips.some(s => s.state === 'intercept') ? '#f43f5e' : '#38bdf8';
                } else {
                    fleetRow.style.display = 'none';
                }
            }

            if (commsBtn) {
                commsBtn.style.display = (inRange && hasSentient) ? 'block' : 'none';
                commsBtn.onclick = () => openDiplomacyComms(planet);
            }

            if (harvestBtn) {
                const isDepleted = planet.depleted || planet.harvested || (STATE.depletedPlanets && STATE.depletedPlanets[planet.name]);
                harvestBtn.style.display = (inRange && !STATE.extractingPlanet && !STATE.abductActive) ? 'block' : 'none';
                if (isDepleted) {
                    (harvestBtn as HTMLButtonElement).disabled = true;
                    harvestBtn.innerText = "Ressourcen erschöpft ✕";
                    harvestBtn.style.opacity = '0.5';
                } else {
                    (harvestBtn as HTMLButtonElement).disabled = false;
                    harvestBtn.innerText = "Bio-Siphon aktivieren [E]";
                    harvestBtn.style.opacity = '1.0';
                }
            }

            if (abductBtn) {
                abductBtn.style.display = (inRange && hasSentient && !STATE.abductActive && !STATE.extractingPlanet) ? 'block' : 'none';
            }
        }
    } else {
        if (resultsBox) resultsBox.style.display = 'none';
        if (placeholderBox) placeholderBox.style.display = 'block';
        if (harvestBtn) harvestBtn.style.display = 'none';
        if (abductBtn) abductBtn.style.display = 'none';
        const commsBtn = document.getElementById('start-comms-btn');
        if (commsBtn) commsBtn.style.display = 'none';
    }
}
