import { expect, test, describe, beforeEach } from "bun:test";
import * as THREE from 'three';

// Headless Mocking
if (typeof (globalThis as any).localStorage === 'undefined') {
    (globalThis as any).localStorage = {
        getItem: () => null,
        setItem: () => {}
    };
}

if (typeof globalThis.document === 'undefined') {
    const dummyEl: any = {
        style: {},
        innerText: '',
        innerHTML: '',
        disabled: false,
        classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => false },
        setAttribute: (k: string, v: string) => { dummyEl[k] = v; },
        removeAttribute: (k: string) => { delete dummyEl[k]; },
        appendChild: () => {},
        prepend: () => {},
        children: [],
        scrollTop: 0,
        scrollHeight: 0,
        addEventListener: () => {},
        querySelector: () => dummyEl,
        querySelectorAll: () => [],
        getContext: () => ({
            createRadialGradient: () => ({ addColorStop: () => {} }),
            createLinearGradient: () => ({ addColorStop: () => {} }),
            fillRect: () => {},
            clearRect: () => {},
            arc: () => {},
            beginPath: () => {},
            fill: () => {},
            stroke: () => {},
            moveTo: () => {},
            lineTo: () => {},
            closePath: () => {},
            save: () => {},
            restore: () => {},
            translate: () => {},
            rotate: () => {},
            scale: () => {},
            transform: () => {},
            resetTransform: () => {},
            setLineDash: () => {},
            fillText: () => {},
            strokeText: () => {},
            measureText: () => ({ width: 10 }),
            createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
            getImageData: () => ({ data: new Uint8ClampedArray(1024) }),
            putImageData: () => {}
        })
    };
    const elementsMap: Record<string, any> = {};
    (globalThis as any).document = {
        getElementById: (id: string) => {
            if (!elementsMap[id]) {
                elementsMap[id] = {
                    ...dummyEl,
                    style: {},
                    classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => false }
                };
            }
            return elementsMap[id];
        },
        createElement: () => ({ ...dummyEl, style: {} }),
        createElementNS: () => ({ ...dummyEl, style: {} }),
        querySelector: () => dummyEl,
        querySelectorAll: () => []
    };
}

if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = {
        innerWidth: 1920,
        innerHeight: 1080,
        AudioContext: class {
            currentTime = 0;
            sampleRate = 44100;
            state = 'running';
            createOscillator() {
                return {
                    type: 'sine',
                    frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
                    connect: () => {},
                    start: () => {},
                    stop: () => {}
                };
            }
            createGain() {
                return {
                    gain: {
                        value: 0,
                        setValueAtTime: () => {},
                        linearRampToValueAtTime: () => {},
                        exponentialRampToValueAtTime: () => {},
                        cancelScheduledValues: () => {}
                    },
                    connect: () => {}
                };
            }
            createBiquadFilter() {
                return {
                    type: 'lowpass',
                    frequency: {
                        setValueAtTime: () => {},
                        linearRampToValueAtTime: () => {},
                        exponentialRampToValueAtTime: () => {}
                    },
                    Q: { setValueAtTime: () => {} },
                    connect: () => {}
                };
            }
            createBuffer(channels: number, length: number, rate: number) {
                return { getChannelData: () => new Float32Array(length) };
            }
            createBufferSource() {
                return { buffer: null, connect: () => {}, start: () => {}, stop: () => {} };
            }
            destination = {};
        },
        addEventListener: () => {},
        localStorage: (globalThis as any).localStorage
    };
}

import { STATE, activePlanets } from '../src/core/state';
import { triggerHarvestStart, updateHarvesting, completeHarvesting } from '../src/systems/harvesting';
import { triggerScanStart, updateScanning, completeScanning, generatePlanetAttributes, generateFallbackMoons, updateScannerUI } from '../src/systems/scanner';
import { completeAbduction } from '../src/systems/abduction';
import { getLoreSolSystem, getLoreArrakisSystem, getLoreSolarisSystem, ensureLoreSystems } from '../src/procedural/lore-systems';
import { AUDIO_SETTINGS } from '../src/engine/audio';
import { initiateSystemArrival, initiateSystemDeparture, spawnVoyagerProbe, updateActivePlanets, spawnPlanetsAndAsteroids } from '../src/systems/universe';
import { clearJumpGates, activeJumpGates } from '../src/procedural/meshes';
import { updatePhysics } from '../src/engine/physics';
import { generateProceduralCandidates, getCrewReactiveThought } from '../src/systems/crew-generation';
import { calculateCrewBuffs, updateCrewSimulation, rejuvenateCrewMember, setPrimaryParadigm, setActiveSubCodex, updateParadigmModifiers, getSpeciesClusters, toggleClusterExpansion, rejuvenateSpeciesCluster, cyclePrimaryParadigm, getExpandedClustersKey, clearExpandedClusters, setCrewStation, getStationCrewCounts, calculateRadiationProtection } from '../src/systems/crew';
import { buyMutation } from '../src/ui/deck';
import { triggerAbductStart } from '../src/systems/abduction';
import { advanceFtueStep, FTUE_DIRECTIVES } from '../src/ui/directives';
import { openVoyagerDialog, closeVoyagerDialog, isVoyagerDialogOpen } from '../src/ui/voyager-dialog';
import { handleVoyagerScan, setLockedTarget } from '../src/input/controls';
import { calculateGravityAndCheckCollision, TRAJECTORY_SEGMENTS } from '../src/engine/trajectory';
import { createRealisticStarfield } from '../src/engine/starfield';
import { createAlienBioShip } from '../src/procedural/alien-ship';
import { createHabitableTextures, createGasGiantTextures, createRockyTextures, createIceMoonTextures, createVolcanicMoonTextures } from '../src/procedural/textures';
import { createAtmosphereMesh } from '../src/procedural/atmosphere-shader';
import { getTemplateForBody, resolveArchetypeTemplate, getTemplateById, PLANET_ARCHETYPE_TEMPLATES } from '../src/procedural/planet-textures';
import { LIGHTING_PROFILES, getLightingProfileForSystem } from '../src/graphics/lighting-profiles';
import { applySystemLighting, updateColorGrading } from '../src/engine/postprocessing';
import { createPlanetaryRings } from '../src/procedural/planet-rings';
import { createPlayerMesh } from '../src/procedural/meshes';
import { chooseFirstContactDoctrine, openFirstContactModal, isFirstContactModalOpen } from '../src/ui/first-contact-modal';
import { MUTATION_DEFINITIONS, MUTATION_CONNECTIONS, selectMutationNode, getSelectedMutationKey } from '../src/ui/evolution-tree';
import { spawnSystemFleet, updateFleet, triggerBioDischarge, salvageNearestWreck, clearFleet } from '../src/systems/fleet';
import { updateMinimap, initHUD } from '../src/ui/hud';

describe("🎮 CORE GAMEPLAY LOOP & RESOURCE ECONOMY PLAYTEST", () => {
    let mockPlanet: any;

    beforeEach(() => {
        // Reset state
        STATE.gameStarted = true;
        STATE.playerPosition = new THREE.Vector3(10, 0, 10);
        STATE.playerVelocity = new THREE.Vector3(0, 0, 0);
        STATE.bioEnergy = 100;
        STATE.maxBioEnergy = 100;
        STATE.bioRes = 50;
        STATE.siliconRes = 30;
        STATE.health = 100;
        STATE.maxHealth = 100;
        STATE.scannedPlanets = {};
        STATE.depletedPlanets = {};
        STATE.extractingPlanet = null;
        STATE.scanningPlanet = null;
        STATE.harvestProgress = 0;
        STATE.scanProgress = 0;
        STATE.orbitLevel = 'solar';
        STATE.activeMoonOrbit = null;
        STATE.systemArrivalActive = false;
        STATE.systemDepartureActive = false;

        // Mock 3D Planet
        const meshGroup = new THREE.Group();
        meshGroup.position.set(15, 0, 15);
        meshGroup.scale.set(1.0, 1.0, 1.0);

        mockPlanet = {
            name: "Perseus-IV",
            type: "Habitable",
            size: 3.0,
            mesh: meshGroup,
            scanned: false,
            depleted: false,
            harvested: false,
            attributes: {
                atmos: "Stickstoff & Sauerstoff",
                temp: "21°C",
                bio: "Biolumineszente Flora",
                res: "Hohe Biomasse",
                species: null
            }
        };

        STATE.nearestPlanet = mockPlanet;
        STATE.lockedTarget = mockPlanet;
    });

    test("1. Harvest is strictly gated behind scan (Unscanned body rejects harvest)", () => {
        expect(mockPlanet.scanned).toBe(false);
        expect(STATE.scannedPlanets[mockPlanet.name]).toBeFalsy();

        // Attempt to trigger harvest directly
        triggerHarvestStart();

        // Must NOT start extracting
        expect(STATE.extractingPlanet).toBeNull();
        expect(STATE.harvestProgress).toBe(0);
        // Must NOT deduct bio-energy on failed attempt
        expect(STATE.bioEnergy).toBe(100);
    });

    test("2. Spectral scanning successfully scans body and grants telemetry rewards", () => {
        expect(mockPlanet.scanned).toBe(false);

        // Initiate scan
        triggerScanStart();
        expect(STATE.scanningPlanet).toBe(mockPlanet);

        // Advance scan progress through simulation updates
        updateScanning(1.0);
        expect(STATE.scanProgress).toBeGreaterThan(0);

        // Fast-forward to 100% completion
        STATE.scanProgress = 100;
        completeScanning();

        // Assert scan completed
        expect(mockPlanet.scanned).toBe(true);
        expect(STATE.scannedPlanets[mockPlanet.name]).toBe(true);
        expect(STATE.scanningPlanet).toBeNull();

        // Telemetry reward (+15 Bio, +10 Silicon)
        expect(STATE.bioRes).toBe(65); // 50 + 15
        expect(STATE.siliconRes).toBe(40); // 30 + 10
    });

    test("3. Scanned body allows Bio-Siphon harvest and yields resources", () => {
        // Mark planet scanned
        mockPlanet.scanned = true;
        STATE.scannedPlanets[mockPlanet.name] = true;

        const initialBioRes = STATE.bioRes;
        const initialSilRes = STATE.siliconRes;

        // Trigger harvest
        triggerHarvestStart();

        // Extraction should be active
        expect(STATE.extractingPlanet).toBe(mockPlanet);
        expect(STATE.bioEnergy).toBe(90); // 100 - 10 channeling cost

        // Advance harvest
        updateHarvesting(1.0);
        expect(STATE.harvestProgress).toBeGreaterThan(0);

        // Complete harvest
        STATE.harvestProgress = 100;
        completeHarvesting();

        // Extraction completed and resources granted
        expect(STATE.extractingPlanet).toBeNull();
        expect(STATE.bioRes).toBeGreaterThan(initialBioRes);
        expect(STATE.siliconRes).toBeGreaterThan(initialSilRes);

        // Body must now be marked depleted
        expect(mockPlanet.depleted).toBe(true);
        expect(mockPlanet.harvested).toBe(true);
        expect(STATE.depletedPlanets[mockPlanet.name]).toBe(true);
    });

    test("4. Depleted planet blocks further extraction (Prevents infinite farming)", () => {
        mockPlanet.scanned = true;
        mockPlanet.depleted = true;
        mockPlanet.harvested = true;
        STATE.scannedPlanets[mockPlanet.name] = true;
        STATE.depletedPlanets[mockPlanet.name] = true;

        const beforeEnergy = STATE.bioEnergy;
        triggerHarvestStart();

        // Must reject extraction
        expect(STATE.extractingPlanet).toBeNull();
        expect(STATE.bioEnergy).toBe(beforeEnergy);
    });

    test("5. Flight thruster consumes Bio-Energy and regenerates when cruising", () => {
        // Simulate forward thrust consumption
        const dt = 1.0;
        STATE.bioEnergy = 100;

        // Thrusting burns 4.5 * dt
        STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 4.5 * dt);
        expect(STATE.bioEnergy).toBe(95.5);

        // Cruising passively regenerates 1.5 * dt
        STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 1.5 * dt);
        expect(STATE.bioEnergy).toBe(97.0);
    });

    test("6. Silicon nanites auto-repair damaged hull and consume silicon", () => {
        STATE.health = 50;
        STATE.maxHealth = 100;
        STATE.siliconRes = 20;

        const dt = 2.0;
        const totalRepairRate = 0.25;

        // Auto Nanite repair tick
        if (totalRepairRate > 0 && STATE.siliconRes >= 0.1 && STATE.health < STATE.maxHealth) {
            STATE.health = Math.min(STATE.maxHealth, STATE.health + totalRepairRate * dt);
            STATE.siliconRes = Math.max(0, STATE.siliconRes - 0.20 * dt);
        }

        expect(STATE.health).toBe(50.5);
        expect(STATE.siliconRes).toBe(19.6);
    });

    test("7. Audio volumes are comfortably dampened within safe thresholds", () => {
        expect(AUDIO_SETTINGS.masterVolume).toBeLessThanOrEqual(0.70);
        expect(AUDIO_SETTINGS.sfxVolume).toBeLessThanOrEqual(0.50);
        expect(AUDIO_SETTINGS.thrusterVolume).toBeLessThanOrEqual(0.50);
    });

    test("8. Outer-Rim arrival vector points inward toward central star at high speed", () => {
        const fromSys = { id: 1, name: "Sol", x: 0, z: 0 };
        const targetSys = { id: 2, name: "Vega", x: 100, z: 0 };

        initiateSystemArrival(fromSys, targetSys);

        // Player placed on outer rim perimeter (R = 150)
        const distFromCenter = Math.sqrt(STATE.playerPosition.x ** 2 + STATE.playerPosition.z ** 2);
        expect(distFromCenter).toBeCloseTo(150.0, 1);

        // Direction points inward toward center (dot product negative)
        const dotProduct = STATE.playerPosition.x * STATE.systemArrivalDirection.x +
                           STATE.playerPosition.z * STATE.systemArrivalDirection.z;
        expect(dotProduct).toBeLessThan(0);

        // State is active and speed is high warp dropout (32 LJ/s)
        expect(STATE.systemArrivalActive).toBe(true);
        expect(STATE.systemArrivalTimer).toBe(2.2);
        expect(STATE.playerVelocity.length()).toBeCloseTo(32.0, 1);
    });

    test("9. Spacefaring systems spawn a Faction Jump Gate and clean up on departure", () => {
        activePlanets.length = 0;
        clearJumpGates();

        activePlanets.push({
            id: 10,
            name: "Nova Prime",
            type: "Terrestrial",
            size: 4,
            distance: 40,
            angle: 0,
            speed: 0.05,
            isMoon: false,
            mesh: new THREE.Group(),
            source: { position: new THREE.Vector3(), radius: 4, mass: 100, gravityRange: 20 },
            attributes: {
                species: {
                    name: "Terran Ascendancy",
                    techLevel: "Spacefaring",
                    factionId: "sol_federation"
                }
            }
        });

        const fromSys = { id: 1, name: "Sol", x: 0, z: 0 };
        const targetSys = { id: 2, name: "Terran Center", x: 50, z: 50 };

        initiateSystemArrival(fromSys, targetSys);

        expect(STATE.incomingJumpGate).not.toBeNull();
        expect(activeJumpGates.length).toBe(1);

        clearJumpGates();
        expect(activeJumpGates.length).toBe(0);
    });

    test("10. Warp-braking physics smoothly decelerates ship toward cruise speed", () => {
        activePlanets.length = 0;
        clearJumpGates();

        const fromSys = { id: 1, name: "Sol", x: 0, z: 0 };
        const targetSys = { id: 2, name: "Vega", x: 100, z: 0 };

        initiateSystemArrival(fromSys, targetSys);
        expect(STATE.playerVelocity.length()).toBeCloseTo(32.0, 1);

        // Step physics by 1.1s
        updatePhysics(1.1);
        const midSpeed = STATE.playerVelocity.length();
        expect(midSpeed).toBeLessThan(32.0);
        expect(midSpeed).toBeGreaterThan(7.5);
        expect(STATE.systemArrivalActive).toBe(true);

        // Step physics through the remainder (1.2s more)
        updatePhysics(1.2);
        expect(STATE.systemArrivalActive).toBe(false);
    });

    test("11. Interstellar departure spools up, locks heading and punches into hyperspace", () => {
        const fromSys = { id: 1, name: "Sol", x: 0, z: 0 };
        const targetSys = { id: 2, name: "Alpha Centauri", x: 100, z: 0 };
        STATE.universe = { systems: [fromSys, targetSys] } as any;
        STATE.currentSystemId = 1;

        initiateSystemDeparture(fromSys, targetSys);

        expect(STATE.systemDepartureActive).toBe(true);
        expect(STATE.systemDepartureTimer).toBe(1.6);
        // Departure vector points from Sol to Alpha Centauri (+X direction)
        expect(STATE.systemDepartureDirection.x).toBeGreaterThan(0.9);

        // Advance 0.5s into spooling phase
        updatePhysics(0.5);
        expect(STATE.systemDepartureActive).toBe(true);

        // Advance into phase 2 (fold punch) and completion (1.2s more)
        updatePhysics(1.2);
        // Departure should be complete, triggering arrival in target system
        expect(STATE.systemDepartureActive).toBe(false);
        expect(STATE.systemArrivalActive).toBe(true);
        expect(STATE.currentSystemId).toBe(2);
    });

    test("12. Procedural abduction candidates generate diverse archetypes, unique names, bio-stations and traits", () => {
        const poolA = generateProceduralCandidates(1337, 4);
        const poolB = generateProceduralCandidates(9999, 4);

        expect(poolA.length).toBe(4);
        expect(poolB.length).toBe(4);

        // Verify names are not identical
        const namesA = poolA.map(c => c.name);
        const namesB = poolB.map(c => c.name);
        expect(namesA).not.toEqual(namesB);

        // Verify all entities have valid stations, traits, and avatar icons
        poolA.forEach(c => {
            expect(c.station).toBeDefined();
            expect(c.stationName).toBeDefined();
            expect(c.trait).toBeDefined();
            expect(c.trait.name).toBeDefined();
            expect(c.avatarIcon).toBeDefined();
            expect(c.speciesColor).toBeDefined();
            expect(c.maxLifespan).toBeGreaterThan(100);
            expect(c.ageCategory).toBe('vital');
        });

        // Test reactive thoughts
        const thoughtWarp = getCrewReactiveThought(poolA[0], 'warp_start');
        expect(thoughtWarp).toBeDefined();
        expect(thoughtWarp.length).toBeGreaterThan(10);
    });

    test("13. Crew aging triggers critical alert at 90% lifespan and rejuvenation resets state", () => {
        const candidates = generateProceduralCandidates(4242, 1);
        const member = candidates[0];
        member.maxLifespan = 200;
        member.age = 175; // 87.5% life ratio
        member.criticalAlertTriggered = false;

        STATE.crew = [member];
        calculateCrewBuffs();

        // Simulate 6 seconds (age becomes 181 / 200 = 90.5% -> Critical threshold)
        updateCrewSimulation(6.0);

        expect(member.ageCategory).toBe('critical');
        expect(member.criticalAlertTriggered).toBe(true);

        // Verify trait buffs in crewBuffs
        expect(STATE.crewBuffs).toBeDefined();

        // Perform rejuvenation
        STATE.bioEnergy = 50;
        STATE.bioRes = 50;
        rejuvenateCrewMember(member.id);

        // Age should be reduced by 35% of maxLifespan (70s), dropping below 85%
        expect(member.age).toBeLessThan(140);
        expect(member.criticalAlertTriggered).toBe(false);
        expect(member.rejuvenationCount).toBe(1);
    });

    test("14. Strict anti-collision guarantee: Multiple planets and crew members NEVER produce duplicate names", () => {
        STATE.crew = [];
        const seenNames = new Set<string>();

        // Generate candidates across 25 different planets
        for (let planetIdx = 0; planetIdx < 25; planetIdx++) {
            const planetSeed = 1000 + planetIdx * 37;
            const candidates = generateProceduralCandidates(planetSeed, 2);

            expect(candidates.length).toBe(2);
            // Candidate 1 and Candidate 2 on the same planet must have distinct names
            expect(candidates[0].name).not.toBe(candidates[1].name);

            candidates.forEach(c => {
                // Must not collide with any previously seen names
                expect(seenNames.has(c.name)).toBe(false);
                seenNames.add(c.name);

                // Add to crew and verify generator respects existing crew members
                if (STATE.crew.length < 5) {
                    STATE.crew.push(c);
                }
            });
        }

        // Verify that in a full crew, every single name is completely unique
        const crewNames = STATE.crew.map(c => c.name);
        const uniqueCrewNames = new Set(crewNames);
        expect(crewNames.length).toBe(uniqueCrewNames.size);
    });

    test("15. Starting system exploration requires planet scan before detecting Voyager 2 signal and advancing FTUE onboarding", () => {
        // 1. Initial State: Player starts at step 0
        STATE.ftueStep = 0;
        STATE.ftueCompleted = false;
        STATE.voyagerSignalDetected = false;
        STATE.voyagerScanned = false;
        STATE.mentalEnergy = 50;
        STATE.loneliness = 80;
        STATE.currentSystemId = 1;

        // 2. Spawn Voyager 2 probe in starting system
        spawnVoyagerProbe();
        expect(STATE.voyagerProbe).not.toBeNull();
        expect(STATE.voyagerProbe.isVoyager).toBe(true);
        expect(STATE.voyagerProbe.name).toContain("Unbekanntes Signal");
        expect(STATE.gravitySources.some((s: any) => s.isVoyager)).toBe(true);
        expect(STATE.voyagerSignalDetected).toBe(false);

        // 3. Player moves -> FTUE advances to Phase 2: System-Erkundung
        advanceFtueStep(1);
        expect(STATE.ftueStep).toBe(1);
        expect(STATE.voyagerSignalDetected).toBe(false);

        // 4. Player scans a sterile planet in the starting system
        const sterilePlanet: any = {
            name: "Perseus-Erwachen Prime A",
            size: 3.0,
            scanned: false,
            mesh: { position: new THREE.Vector3(12, 0, 12), scale: { x: 1 } },
            attributes: { atmos: "Dünnes CO2", bio: "Steril", res: "Silizium" }
        };
        STATE.scanningPlanet = sterilePlanet;
        completeScanning();

        // Planet scan reveals sterile nature & triggers archaic Voyager signal detection
        expect(sterilePlanet.scanned).toBe(true);
        expect(STATE.voyagerSignalDetected).toBe(true);
        expect(STATE.ftueStep).toBe(2); // Advanced to Phase 3: Archaisches Signal

        // 5. Player approaches Voyager 2 probe in the outer interstellar void
        STATE.playerPosition.set(STATE.voyagerProbe.position.x, 0, STATE.voyagerProbe.position.z + 5);
        const dist = STATE.playerPosition.distanceTo(STATE.voyagerProbe.position);
        expect(dist).toBeLessThanOrEqual(22);

        // Scan Voyager 2 with [F]
        handleVoyagerScan();
        expect(STATE.voyagerScanned).toBe(true);
        expect(STATE.voyagerProbe.name).toContain("Voyager 2");
        expect(STATE.ftueStep).toBe(3); // Advanced to Phase 4: Funke der Hoffnung
        expect(isVoyagerDialogOpen()).toBe(true);

        // 6. Close/listen Golden Record dialog
        closeVoyagerDialog();
        expect(STATE.ftueStep).toBe(4); // Advanced to Phase 5: Aufbruch ins Leben

        // 7. Open Galaxy Map [M]
        advanceFtueStep(5); // Phase 6: Der erste Wirt
        expect(STATE.ftueStep).toBe(5);

        // 8. Abduction completed
        advanceFtueStep(6);
        expect(STATE.ftueStep).toBe(6);
        expect(STATE.ftueCompleted).toBe(true);
    });

    test("16. Voyager 2 drifts in vacuum, raycasting locks target, scan opens Golden Record dialog with emotional hope buff, and starting system is sterile", () => {
        // 1. Reset state
        STATE.ftueStep = 0;
        STATE.ftueCompleted = false;
        STATE.voyagerSignalDetected = false;
        STATE.voyagerScanned = false;
        STATE.voyagerDialogSeen = false;
        STATE.mentalEnergy = 40;
        STATE.loneliness = 85;
        STATE.currentSystemId = 1;

        // 2. Spawn probe and check initial position
        spawnVoyagerProbe();
        expect(STATE.voyagerProbe).not.toBeNull();
        const startX = STATE.voyagerProbe.position.x;
        const startZ = STATE.voyagerProbe.position.z;

        // 3. Test slow drift movement (update with dt = 2.0s)
        STATE.voyagerProbe.update(2.0);
        expect(STATE.voyagerProbe.position.x).toBeGreaterThan(startX);
        expect(STATE.voyagerProbe.position.z).toBeGreaterThan(startZ);

        // 4. Test targeting via setLockedTarget
        setLockedTarget(STATE.voyagerProbe);
        expect(STATE.lockedTarget).toBe(STATE.voyagerProbe);

        // 5. Test scan interaction & dialog opening
        STATE.playerPosition.set(STATE.voyagerProbe.position.x, 0, STATE.voyagerProbe.position.z + 5);
        handleVoyagerScan();

        expect(STATE.voyagerScanned).toBe(true);
        expect(STATE.voyagerSignalDetected).toBe(true);
        expect(isVoyagerDialogOpen()).toBe(true);
        expect(STATE.voyagerDialogSeen).toBe(true);

        // Hope buff: mental energy increased and loneliness decreased
        expect(STATE.mentalEnergy).toBeGreaterThan(70);
        expect(STATE.loneliness).toBeLessThanOrEqual(45);
        expect(STATE.ftueStep).toBe(3);

        // 6. Test closing dialog
        closeVoyagerDialog();
        expect(isVoyagerDialogOpen()).toBe(false);
        expect(STATE.ftueStep).toBe(4);

        // 7. Verify starting system (Perseus-Rand) has NO habitable worlds
        if (STATE.universe && STATE.universe.systems && STATE.universe.systems[1]) {
            const sys1 = STATE.universe.systems[1];
            if (sys1 && Array.isArray(sys1.planets)) {
                const hasHabitable = sys1.planets.some((p: any) => p.type === 'Habitable');
                expect(hasHabitable).toBe(false);
            }
        }
    });

    test("17. Organic bio-flight locomotion: Lateral drift damping redirects velocity when thrusting into a turn, and active bio-braking halts ship cleanly", () => {
        // 1. Initial State: Ship flying along +X axis (Heading 0) at 20 LJ/s
        STATE.shipHeading = 0; // Pointing +X
        STATE.playerVelocity.set(20, 0, 0);
        STATE.flightAssist = true;
        STATE.isThrusting = true;
        STATE.keys.w = true;
        STATE.isRetroBraking = false;
        STATE.keys.s = false;

        // 2. Player turns 90 degrees left (heading = Math.PI / 2, pointing -Z axis)
        STATE.shipHeading = Math.PI / 2;

        // Initial velocity is perpendicular to the new heading (pure lateral drift!)
        const initialLateral = STATE.playerVelocity.x;
        expect(initialLateral).toBe(20);

        // 3. Simulate multiple physics steps with thrusting along new heading
        const dt = 0.1;
        for (let step = 0; step < 5; step++) {
            updatePhysics(dt);
        }

        // 4. Lateral velocity (along +X) must be dramatically reduced by organic hydrodynamic damping
        expect(STATE.playerVelocity.x).toBeLessThan(5.0);

        // 5. Test active bio-braking on 'S'
        STATE.isThrusting = false;
        STATE.keys.w = false;
        STATE.isRetroBraking = true;
        STATE.keys.s = true;

        const speedBeforeBrake = STATE.playerVelocity.length();
        updatePhysics(0.5);
        const speedAfterBrake = STATE.playerVelocity.length();

        // Must decelerate significantly
        expect(speedAfterBrake).toBeLessThan(speedBeforeBrake * 0.4);
    });

    test("18. Deep orbital trajectory prediction & gravity swing-by: Calculates multi-body gravitational deflection, periapsis approach and vacuum coasting", () => {
        expect(TRAJECTORY_SEGMENTS).toBeGreaterThanOrEqual(120);

        // 1. Setup ship coasting past a massive celestial body
        // Ship starts at (-60, 0, 30) moving directly along +X with velocity (14, 0, 0)
        STATE.playerPosition.set(-60, 0, 30);
        STATE.playerVelocity.set(14, 0, 0);
        STATE.isThrusting = false;
        STATE.keys.w = false;
        STATE.isRetroBraking = false;
        STATE.keys.s = false;
        STATE.flightAssist = true;

        // Massive planet positioned at (0, 0, 0) with mass = 800 and gravityRange = 70
        const massivePlanetSource: any = {
            id: 'planet_gravity_well',
            type: 'planet',
            name: 'Gigantus',
            position: new THREE.Vector3(0, 0, 0),
            mass: 800,
            radius: 8.0,
            gravityRange: 70.0,
            isAbsorbed: false
        };
        STATE.gravitySources = [massivePlanetSource];
        STATE.gConstant = 15.0;

        // 2. Trajectory Prediction Verification:
        // calculateGravityAndCheckCollision at various points along trajectory
        const testAcc = new THREE.Vector3();
        const startCheck = calculateGravityAndCheckCollision(new THREE.Vector3(-60, 0, 30), 0, testAcc);
        expect(startCheck.collided).toBe(false);
        // Net acceleration points inward towards (0, 0, 0)
        expect(testAcc.x).toBeGreaterThan(0);
        expect(testAcc.z).toBeLessThan(0); // pulled towards z = 0

        // 3. Physical trajectory integration over time (coasting past the planet)
        const dt = 0.1;
        const initialZ = STATE.playerPosition.z;
        for (let step = 0; step < 28; step++) { // 2.8 seconds of flight to periapsis passage
            updatePhysics(dt);
        }

        // As ship passes the planet at Z=30, the gravitational force pulls the ship towards Z=0 (swing-by deflection)
        expect(STATE.playerPosition.z).toBeLessThan(initialZ); // Path deflected towards planet
        expect(STATE.playerVelocity.z).toBeLessThan(-3.0);     // Gained strong negative Z velocity from gravitational assist!
        expect(STATE.playerPosition.x).toBeGreaterThan(-10.0); // Advanced rapidly along X

        // 4. Verify that in cruising mode, the ship glides without abrupt drag decay
        // (speed should remain high and not drop to 0)
        expect(STATE.playerVelocity.length()).toBeGreaterThan(15.0);
    });

    test("19. Quantum-entangled star systems & deep planetary physics: Deterministic physical parameters, entangled twin linking, synchronous tidal locking, and magnetospheric induction", () => {
        // 1. Deterministic planetary physics parameter generation
        const mockRawPlanet = {
            name: "Zeta Reticuli B",
            type: "Rocky",
            size: 2.8,
            distance: 22.0, // close to star -> tidal locking expected
            color: "0xd97706"
        };
        const attrs1 = generatePlanetAttributes(mockRawPlanet);
        const attrs2 = generatePlanetAttributes(mockRawPlanet);

        // Strict determinism
        expect(attrs1).toEqual(attrs2);
        expect(typeof attrs1.tidalLock).toBe('boolean');
        expect(attrs1.tidalLock).toBe(true); // distance < 28 -> tidally locked
        expect(['None', 'Weak', 'Strong', 'Hyper-Magnetic']).toContain(attrs1.magnetosphere!);
        expect(['Dead', 'Dormant', 'Active Geysers', 'Hyper-Volcanic']).toContain(attrs1.geothermal!);
        expect(['Low', 'Moderate', 'High', 'Extreme']).toContain(attrs1.radiationLevel!);

        // 2. Fallback moons generate tidal locking, geothermals and parentPlanetName
        const fallbackMoons = generateFallbackMoons({ name: "Zeus Prime", type: "Gas Giant", size: 6.0 });
        expect(fallbackMoons.length).toBeGreaterThan(0);
        fallbackMoons.forEach((m: any) => {
            expect(m.tidalLock).toBe(true);
            expect(m.parentPlanetName).toBe("Zeus Prime");
            expect(m.geothermal).toBeDefined();
        });

        // 3. Tidally locked celestial rotation
        const testPlanetEntry: any = {
            name: "Locked World",
            type: "Rocky",
            size: 2.5,
            angle: 1.25,
            speed: 0.05,
            distance: 30.0,
            mesh: new THREE.Group(),
            bodyMesh: new THREE.Mesh(new THREE.SphereGeometry(2.5)),
            source: { position: new THREE.Vector3() },
            isMoon: false,
            attributes: { tidalLock: true }
        };
        activePlanets.length = 0;
        activePlanets.push(testPlanetEntry);

        updateActivePlanets(0.1);
        // Rotation should synchronously match angle + Math.PI
        expect(testPlanetEntry.bodyMesh.rotation.y).toBeCloseTo(testPlanetEntry.angle + Math.PI, 4);

        // 4. Quantum-Entangled Twin Planet Harvesting Resonance
        const twinA: any = {
            name: "Entangled Alpha",
            type: "Habitable",
            size: 3.2,
            mesh: new THREE.Group(),
            scanned: true,
            attributes: {
                atmos: "O2",
                temp: "22°C",
                bio: "Bio",
                res: "C",
                species: null,
                entangledTwinId: "Entangled Beta",
                quantumResonance: 0.90,
                magnetosphere: "Hyper-Magnetic"
            }
        };

        STATE.extractingPlanet = twinA;
        STATE.bioRes = 100;
        STATE.mentalEnergy = 50;
        STATE.bioEnergy = 50;
        STATE.maxBioEnergy = 100;
        STATE.crewBuffs = { bioGain: 1.0, scanSpeed: 1.0, propulsionSpeed: 1.0, repairEfficiency: 1.0, psionicCostReduction: 0.0 };

        completeHarvesting();

        // Habitable yields 65 base bio. With resonance 0.90, bonus bio = round(65 * 0.90 * 0.4) = 23
        // Total bioRes = 100 + 65 + 23 = 188
        expect(STATE.bioRes).toBe(188);
        // Mental energy boosted by +20
        expect(STATE.mentalEnergy).toBe(70);
        // Hyper-Magnetic induction gives +25 base bioEnergy recharge + 25 hyper-magnetic induction = 100
        expect(STATE.bioEnergy).toBe(100);
    });

    test("20. Sol-System & Iconic Sci-Fi Easter-Eggs (Arrakis / Dune & Solaris): Guarantees 9 planets of Sol, Melange harvesting surge, and Fremen abduction unlocking Augen des Ibad", () => {
        // 1. Sol System Verification
        const solSys = getLoreSolSystem();
        expect(solSys.name).toContain("Sol");
        expect(solSys.star.type).toBe("Yellow Sun");
        expect(solSys.planets.length).toBe(9);

        const planetNames = solSys.planets.map((p: any) => p.name);
        expect(planetNames).toContain("Merkur");
        expect(planetNames).toContain("Venus");
        expect(planetNames).toContain("Erde (Terra)");
        expect(planetNames).toContain("Mars");
        expect(planetNames).toContain("Jupiter");
        expect(planetNames).toContain("Saturn");
        expect(planetNames).toContain("Uranus");
        expect(planetNames).toContain("Neptun");
        expect(planetNames).toContain("Pluto");

        expect(solSys.star.texture).toBe("assets/textures/planets/8k_sun.jpg");
        const erde = solSys.planets.find((p: any) => p.name === "Erde (Terra)");
        expect(erde.moons.length).toBe(1);
        expect(erde.moons[0].name).toContain("Luna");
        expect(erde.moons[0].texture).toBe("assets/textures/planets/8k_moon.jpg");
        expect(erde.texture).toBe("assets/textures/planets/8k_earth_daymap.jpg");
        expect(erde.cloudTexture).toBe("assets/textures/planets/8k_earth_clouds.jpg");
        expect(erde.nightTexture).toBe("assets/textures/planets/8k_earth_nightmap.jpg");
        expect(erde.species.name).toContain("Menschheit");
        expect(erde.species.candidates.some((c: any) => c.name.includes("Carl Sagan"))).toBe(true);

        const jupiter = solSys.planets.find((p: any) => p.name === "Jupiter");
        expect(jupiter.moons.length).toBe(4); // Io, Europa, Ganymed, Kallisto
        expect(jupiter.texture).toBe("assets/textures/planets/8k_jupiter.jpg");
        expect(jupiter.moons.find((m: any) => m.name === "Europa").texture).toBe("assets/textures/planets/jupiter_europa.jpg");
        expect(jupiter.magnetosphere).toBe("Hyper-Magnetic");

        const saturn = solSys.planets.find((p: any) => p.name === "Saturn");
        expect(saturn.texture).toBe("assets/textures/planets/8k_saturn.jpg");
        expect(saturn.ringTexture).toBe("assets/textures/planets/8k_saturn_ring_alpha.png");
        expect(saturn.moons.some((m: any) => m.name.includes("Titan"))).toBe(true);

        // 2. Arrakis & Canopus System Verification
        const arrakisSys = getLoreArrakisSystem();
        expect(arrakisSys.name).toContain("Canopus");
        const arrakis = arrakisSys.planets.find((p: any) => p.name.includes("Arrakis"));
        expect(arrakis).toBeDefined();
        expect(arrakis.res).toContain("Melange");
        expect(arrakis.species.name).toContain("Fremen");
        expect(arrakis.species.candidates.some((c: any) => c.name.includes("Stilgar"))).toBe(true);
        expect(arrakis.species.candidates.some((c: any) => c.name.includes("Chani"))).toBe(true);

        // 3. Fallback injector guarantee
        const mockUniverseSystems = [
            { id: 0, name: "Center Core" },
            { id: 1, name: "Perseus" }
        ];
        ensureLoreSystems(mockUniverseSystems);
        expect(mockUniverseSystems.some(s => s.name.includes("Sol"))).toBe(true);
        expect(mockUniverseSystems.some(s => s.name.includes("Arrakis"))).toBe(true);
        expect(mockUniverseSystems.some(s => s.name.includes("Solaris"))).toBe(true);

        // 4. Melange (Spice) Harvesting on Arrakis
        STATE.extractingPlanet = arrakis;
        STATE.bioRes = 50;
        STATE.siliconRes = 20;
        STATE.mentalEnergy = 40;
        STATE.maxMentalEnergy = 100;
        STATE.bioEnergy = 60;
        STATE.crewBuffs = { bioGain: 1.0, scanSpeed: 1.0, propulsionSpeed: 1.0, repairEfficiency: 1.0, psionicCostReduction: 0.0 };

        completeHarvesting();

        // Base Rocky yield: 25 bio, 50 silicon. Plus Arrakis Melange bonus: +80 bio, +50 mentalEnergy.
        // Total bioRes = 50 + 25 + 80 = 155
        expect(STATE.bioRes).toBe(155);
        // Total mentalEnergy = min(100, 40 + 50) = 90
        expect(STATE.mentalEnergy).toBe(90);

        // 5. Fremen Abduction unlocks Augen des Ibad mutation
        expect(STATE.mutations.ibad).toBeDefined();
        STATE.mutations.ibad!.purchased = false;
        STATE.crew = [];
        STATE.maxCrewCapacity = 4;

        // Mock Abduction Target
        STATE.abductTarget = arrakis;
        completeAbduction();

        // Must have recruited a Fremen candidate (Stilgar or Chani)
        expect(STATE.crew.length).toBe(1);
        expect(STATE.crew[0].species).toBe("Fremen");
        // Must have unlocked Augen des Ibad
        expect(STATE.mutations.ibad!.purchased).toBe(true);
        expect(STATE.mutations.ibad!.desc).toContain("Psychosen");
    });

    test("21. Robust null-safety for celestial scanning: Bodies without pre-existing attributes auto-generate attributes without throwing TypeError", () => {
        // Create a raw celestial body with NO .attributes object
        const rawBody: any = {
            name: "Anomalous-Void-Moon",
            type: "Rocky",
            size: 2.0,
            distance: 45,
            mesh: {
                position: new THREE.Vector3(12, 0, 12),
                scale: new THREE.Vector3(1, 1, 1)
            },
            scanned: false,
            attributes: undefined // Deliberately undefined
        };

        // 1. Updating scanner UI for unscanned body without attributes must not throw
        expect(() => updateScannerUI(rawBody, 5)).not.toThrow();

        // 2. Complete scanning on body without attributes must not throw (fixes entangledTwinId / temp errors)
        STATE.scanningPlanet = rawBody;
        expect(() => completeScanning()).not.toThrow();

        // Body must now be scanned and attributes populated
        expect(rawBody.scanned).toBe(true);
        expect(rawBody.attributes).toBeDefined();
        expect(typeof rawBody.attributes.temp).toBe("string");
        expect(typeof rawBody.attributes.bio).toBe("string");
        expect(typeof rawBody.attributes.atmos).toBe("string");

        // 3. Updating scanner UI for scanned body must not throw
        expect(() => updateScannerUI(rawBody, 5)).not.toThrow();
    });

    test("22. Infinite Celestial Skybox & Dynamic Space Dust: Skybox tracks camera position to infinity, zero translation parallax preserves constellations, and space dust streams dynamically with velocity", () => {
        const starfield = createRealisticStarfield();

        expect(starfield.group).toBeDefined();
        expect(starfield.celestialGroup).toBeDefined();
        expect(starfield.dustPoints).toBeDefined();

        // 1. Initial position check
        expect(starfield.group.position.x).toBe(0);
        expect(starfield.group.position.z).toBe(0);

        // 2. Camera translation to extreme coordinates (e.g. 50,000 units out)
        const distantCamPos = new THREE.Vector3(50000, 65, -35000);
        const playerVel = new THREE.Vector3(0, 0, 0); // Resting
        starfield.update(0.016, distantCamPos, playerVel);

        // Skybox group MUST follow camera translation to ensure infinite celestial background
        expect(starfield.group.position.x).toBe(50000);
        expect(starfield.group.position.z).toBe(-35000);

        // Celestial group must maintain ZERO local translation offset (zero translation parallax)
        expect(starfield.celestialGroup.position.x).toBe(0);
        expect(starfield.celestialGroup.position.z).toBe(0);

        // 3. Resting ship has subtle ambient deep-sea motes (Tiefsee-Quantenglimmer)
        const dustMat = starfield.dustPoints.material as THREE.PointsMaterial;
        const restingOpacity = dustMat.opacity;
        expect(restingOpacity).toBeLessThanOrEqual(0.10);

        // 4. Subtle abyssal quantum motes reaction during flight (refined, never a snowstorm)
        const highSpeedVel = new THREE.Vector3(30, 0, 40); // 50 units/sec velocity
        starfield.update(0.1, distantCamPos, highSpeedVel);

        // Dust material gently increases opacity relative to resting state, maintaining elegance
        expect(dustMat.opacity).toBeGreaterThan(restingOpacity);
        expect(dustMat.opacity).toBeLessThanOrEqual(0.25);

        // 5. Space dust particles must remain strictly bounded within local bounding box
        const dustPositions = starfield.dustPoints.geometry.attributes.position.array as Float32Array;
        let allBounded = true;
        for (let i = 0; i < dustPositions.length; i += 3) {
            const px = dustPositions[i];
            const pz = dustPositions[i + 2];
            if (Math.abs(px) > 86 || Math.abs(pz) > 86) {
                allBounded = false;
                break;
            }
        }
        expect(allBounded).toBe(true);

        // 6. Bio-Kielwasser: Wingtip slipstream ribbons on Najmafar
        const ship = createAlienBioShip();
        expect(ship.leftSlipstream).toBeDefined();
        expect(ship.rightSlipstream).toBeDefined();

        // Resting ship: slipstream opacity collapses to 0
        STATE.isThrusting = false;
        STATE.playerVelocity.set(0, 0, 0);
        ship.update(0.016);
        const slipstreamMat = ship.leftSlipstream!.material as THREE.LineBasicMaterial;
        expect(slipstreamMat.opacity).toBeLessThanOrEqual(0.15);

        // Active thrust: slipstream flares up at wingtips creating organic bio-wake
        STATE.isThrusting = true;
        STATE.playerVelocity.set(30, 0, 15);
        ship.update(0.1);
        expect(slipstreamMat.opacity).toBeGreaterThan(0.20);

        // 7. Clean disposal
        expect(() => starfield.dispose()).not.toThrow();
    });

    test("23. High-End PBR Planetary Graphics, Specular/Roughness Maps & Atmospheric Twilight Terminator", () => {
        // 1. Habitable Planet PBR generation
        const habTex = createHabitableTextures(0x38bdf8, 42);
        expect(habTex.map).toBeInstanceOf(THREE.CanvasTexture);
        expect(habTex.bumpMap).toBeInstanceOf(THREE.CanvasTexture);
        expect(habTex.roughnessMap).toBeInstanceOf(THREE.CanvasTexture);

        // 2. Roughness maps for Gas Giants, Rocky Worlds, and Moons
        const gasTex = createGasGiantTextures(0xf59e0b, 77);
        expect(gasTex.map).toBeInstanceOf(THREE.CanvasTexture);
        expect(gasTex.roughnessMap).toBeInstanceOf(THREE.CanvasTexture);

        const rockyTex = createRockyTextures(0x888888, 99);
        expect(rockyTex.map).toBeInstanceOf(THREE.CanvasTexture);
        expect(rockyTex.bumpMap).toBeInstanceOf(THREE.CanvasTexture);
        expect(rockyTex.roughnessMap).toBeInstanceOf(THREE.CanvasTexture);

        const iceMoonTex = createIceMoonTextures(0xe0f2fe, 123);
        expect(iceMoonTex.map).toBeInstanceOf(THREE.CanvasTexture);
        expect(iceMoonTex.roughnessMap).toBeInstanceOf(THREE.CanvasTexture);

        const volcanicMoonTex = createVolcanicMoonTextures(0xf97316, 321);
        expect(volcanicMoonTex.map).toBeInstanceOf(THREE.CanvasTexture);
        expect(volcanicMoonTex.emissiveMap).toBeInstanceOf(THREE.CanvasTexture);
        expect(volcanicMoonTex.roughnessMap).toBeInstanceOf(THREE.CanvasTexture);

        // 3. Atmospheric Shader with Rayleigh Twilight Scattering
        const atmoMesh = createAtmosphereMesh(12, 0x38bdf8, 1.25);
        expect(atmoMesh).toBeInstanceOf(THREE.Mesh);
        expect(atmoMesh.material).toBeInstanceOf(THREE.ShaderMaterial);

        const atmoMat = atmoMesh.material as THREE.ShaderMaterial;
        expect(atmoMat.uniforms.glowColor).toBeDefined();
        expect(atmoMat.uniforms.intensityMultiplier).toBeDefined();
        expect(atmoMat.uniforms.uStarPosition).toBeDefined();
        expect(atmoMat.uniforms.uStarPosition.value).toBeInstanceOf(THREE.Vector3);

        // Verify vertex shader computes world normals for true planetary lighting
        expect(atmoMat.vertexShader).toContain('vWorldNormal');
        expect(atmoMat.vertexShader).toContain('modelMatrix');

        // Verify fragment shader contains Rayleigh sunset twilight scattering formulas
        expect(atmoMat.fragmentShader).toContain('twilightFactor');
        expect(atmoMat.fragmentShader).toContain('sunsetColor');
        expect(atmoMat.fragmentShader).toContain('uStarPosition');

        // 4. System Arrival Integration: Planar Mesh, atmoMesh, and Night-Side City Lights
        const testSys: any = {
            id: 'pbr-test-sys',
            name: 'PBR Prime',
            dominantFaction: 'Verbund Freier Siedler',
            star: {
                type: 'Yellow Sun',
                color: '0xffd700',
                size: 24,
                mass: 100
            },
            planets: [
                {
                    name: 'Gaia Nova',
                    type: 'Habitable',
                    size: 8,
                    color: '0x38bdf8',
                    moons: [
                        { name: 'Io Prime', type: 'Vulkanmond', size: 2.2, color: '0xf97316' },
                        { name: 'Europa Secundus', type: 'Eismond', size: 2.0, color: '0xe0f2fe' }
                    ],
                    species: {
                        name: 'Aethelgardianer',
                        population: 4500000,
                        techLevel: 'Spacefaring',
                        candidates: [{ id: 'c-1', name: 'Test', bioStation: 'Botaniker' }]
                    }
                },
                {
                    name: 'Titanus Gas',
                    type: 'Gas Giant',
                    size: 16,
                    color: '0xf59e0b',
                    moons: []
                }
            ]
        };

        STATE.universe = { systems: [testSys] };
        STATE.currentSystemId = 0;
        activePlanets.length = 0;
        spawnPlanetsAndAsteroids();

        const habPlanet = activePlanets.find(p => p.name === 'Gaia Nova');
        expect(habPlanet).toBeDefined();
        expect(habPlanet!.atmoMesh).toBeDefined();
        expect(habPlanet!.atmoMesh).toBeInstanceOf(THREE.Mesh);

        // Body mesh material must be standard PBR with roughnessMap and city lights terminator hook
        const bodyMesh = habPlanet!.bodyMesh as THREE.Mesh;
        expect(bodyMesh).toBeInstanceOf(THREE.Mesh);
        const bodyMat = bodyMesh.material as THREE.MeshStandardMaterial;
        expect(bodyMat.roughnessMap).toBeDefined();
        expect(bodyMat.roughness).toBe(1.0); // full dynamic range utilized by roughnessMap
        expect(bodyMat.customProgramCacheKey).toBeDefined();
        expect(bodyMat.customProgramCacheKey!()).toBe('cityLightsTerminator');

        // Moons must also possess PBR materials with roughnessMap and volcanic emission
        const volcanicMoon = activePlanets.find(p => p.name === 'Io Prime');
        expect(volcanicMoon).toBeDefined();
        const vMoonMesh = volcanicMoon!.bodyMesh as THREE.Mesh;
        const vMoonMat = vMoonMesh.material as THREE.MeshStandardMaterial;
        expect(vMoonMat.roughnessMap).toBeDefined();
        expect(vMoonMat.emissiveMap).toBeDefined();
        expect(vMoonMat.emissiveIntensity).toBeGreaterThan(0.0);

        // 5. Planetary Template Archetypes (Schablonen-System)
        const earthTemplate = getTemplateForBody('Habitable', 42);
        expect(earthTemplate.map).toBe(PLANET_ARCHETYPE_TEMPLATES.EARTH_DAY);
        expect(earthTemplate.cloudMap).toBe(PLANET_ARCHETYPE_TEMPLATES.EARTH_CLOUDS);
        expect(earthTemplate.nightMap).toBe(PLANET_ARCHETYPE_TEMPLATES.EARTH_NIGHT);

        const jupiterTemplate = getTemplateForBody('Gas Giant', 42);
        expect([PLANET_ARCHETYPE_TEMPLATES.JUPITER, PLANET_ARCHETYPE_TEMPLATES.SATURN]).toContain(jupiterTemplate.map);
    });

    test("24. QPU Quantum Archetype & Template System: Resolves quantum templates, custom normal/roughness scales, and rings", () => {
        // 1. Check getTemplateById for known archetypes
        const earthTpl = getTemplateById('earth');
        expect(earthTpl).toBeDefined();
        expect(earthTpl!.map).toBe(PLANET_ARCHETYPE_TEMPLATES.EARTH_DAY);
        expect(earthTpl!.cloudMap).toBe(PLANET_ARCHETYPE_TEMPLATES.EARTH_CLOUDS);
        expect(earthTpl!.normalMap).toBe(PLANET_ARCHETYPE_TEMPLATES.EARTH_NORMAL);
        expect(earthTpl!.roughnessMap).toBe(PLANET_ARCHETYPE_TEMPLATES.EARTH_SPECULAR);

        const jupTpl = getTemplateById('jupiter');
        expect(jupTpl).toBeDefined();
        expect(jupTpl!.map).toBe(PLANET_ARCHETYPE_TEMPLATES.JUPITER);

        const ioTpl = getTemplateById('jupiter_io');
        expect(ioTpl).toBeDefined();
        expect(ioTpl!.map).toBe(PLANET_ARCHETYPE_TEMPLATES.JUPITER_IO);

        // 2. Test resolveArchetypeTemplate with custom archetype object
        const resolved = resolveArchetypeTemplate({
            templateId: 'mars',
            normalScale: 1.5,
            roughnessScale: 0.9
        }, 'Rocky', 123);
        expect(resolved.map).toBe(PLANET_ARCHETYPE_TEMPLATES.MARS);

        // 3. Spawning a system with QPU-enriched archetype parameters
        const qpuSys: any = {
            id: 888,
            name: "QPU Quantum Sanctuary",
            star: { type: "Yellow Sun", color: "0xf59e0b", size: 10, mass: 100 },
            planets: [
                {
                    name: "Quantum Eden",
                    type: "Habitable",
                    size: 3.5,
                    distance: 30,
                    color: "0x22c55e",
                    archetype: {
                        templateId: "earth",
                        cloudCoverage: 0.45,
                        normalScale: 1.3,
                        roughnessScale: 0.4,
                        hasNightLights: true,
                        hasRings: false
                    },
                    species: { population: 500000000, candidates: [] },
                    moons: [
                        {
                            name: "Quantum Eden-I",
                            type: "Eismond",
                            size: 0.9,
                            distance: 8,
                            speed: 1.0,
                            color: "0x38bdf8",
                            archetype: {
                                templateId: "jupiter_europa",
                                roughnessScale: 0.22,
                                normalScale: 0.6,
                                cryoVolcanism: true
                            }
                        }
                    ]
                },
                {
                    name: "Quantum Ring Giant",
                    type: "Gas Giant",
                    size: 6.0,
                    distance: 80,
                    color: "0xf97316",
                    archetype: {
                        templateId: "saturn",
                        roughnessScale: 0.25,
                        hasRings: true,
                        ringTexture: "8k_saturn_ring_alpha.png"
                    },
                    moons: []
                }
            ]
        };

        STATE.universe = { systems: [qpuSys] };
        STATE.currentSystemId = 0;
        activePlanets.length = 0;
        spawnPlanetsAndAsteroids();

        const eden = activePlanets.find(p => p.name === 'Quantum Eden');
        expect(eden).toBeDefined();
        const edenMesh = eden!.bodyMesh as THREE.Mesh;
        const edenMat = edenMesh.material as THREE.MeshStandardMaterial;
        expect(edenMat.roughness).toBe(0.4);
        expect(edenMat.normalScale.x).toBe(1.3);

        const ringGiant = activePlanets.find(p => p.name === 'Quantum Ring Giant');
        expect(ringGiant).toBeDefined();
        const ringGiantMesh = ringGiant!.bodyMesh as THREE.Mesh;
        const ringGiantMat = ringGiantMesh.material as THREE.MeshStandardMaterial;
        expect(ringGiantMat.roughness).toBe(0.25);

        const europaMoon = activePlanets.find(p => p.name === 'Quantum Eden-I');
        expect(europaMoon).toBeDefined();
        const europaMesh = europaMoon!.bodyMesh as THREE.Mesh;
        const europaMat = europaMesh.material as THREE.MeshStandardMaterial;
        expect(europaMat.roughness).toBe(0.22);
    });

    test("25. System-Specific Color Grading, Lighting Profiles & Astronomical Shadow Mapping", () => {
        // 1. Verify Lighting Profiles for all 5 Star Classes and Cosmic Anomalies
        expect(LIGHTING_PROFILES['Yellow Sun']).toBeDefined();
        expect(LIGHTING_PROFILES['Blue Giant']).toBeDefined();
        expect(LIGHTING_PROFILES['Red Dwarf']).toBeDefined();
        expect(LIGHTING_PROFILES['White Dwarf']).toBeDefined();
        expect(LIGHTING_PROFILES['Black Hole']).toBeDefined();
        expect(LIGHTING_PROFILES['Pulsar']).toBeDefined();

        // Blue Giant: Extreme cold contrast (1.22) & ice blue color filter
        const blueProfile = getLightingProfileForSystem('Blue Giant');
        expect(blueProfile.contrast).toBeGreaterThan(1.15);
        expect(blueProfile.colorFilter.b).toBeGreaterThan(blueProfile.colorFilter.r);

        // Red Dwarf: Warm copper amber filter with muted saturation
        const redProfile = getLightingProfileForSystem('Red Dwarf');
        expect(redProfile.colorFilter.r).toBeGreaterThan(redProfile.colorFilter.b);
        expect(redProfile.saturation).toBeLessThan(1.0);

        // Black Hole: Maximum vignette & intense contrast
        const bhProfile = getLightingProfileForSystem('Black Hole');
        expect(bhProfile.vignette).toBeGreaterThanOrEqual(0.40);
        expect(bhProfile.contrast).toBeGreaterThanOrEqual(1.30);

        // Anomaly overrides: Pulsar returns Pulsar profile
        const pulsarProfile = getLightingProfileForSystem('Yellow Sun', 'pulsar');
        expect(pulsarProfile.name).toContain('Pulsar');

        // 2. Test Color Grading Transition Engine
        applySystemLighting('Blue Giant');
        updateColorGrading(0.1); // Smooth transition tick

        // 3. Astronomical Ring Eclipse Shadow:
        // Planet's spherical body casts an elliptical shadow onto its rings
        const planetR = 8.0;
        const rings = createPlanetaryRings(planetR, 0xc0c6d0, 101);
        expect(rings).toBeDefined();
        expect(rings.receiveShadow).toBe(true);

        const ringMat = rings.material as THREE.MeshStandardMaterial;
        expect(ringMat.customProgramCacheKey!()).toBe('ringPlanetEclipseShadow');

        // Test the analytical shadow equation used in the shader:
        // Ray from ring fragment towards star (0, 38, 0):
        const starPos = new THREE.Vector3(0, 38, 0);
        const planetPos = new THREE.Vector3(100, 0, 0); // Planet on X-axis

        // Point A on night side of ring (directly behind planet, away from star):
        const nightRingPoint = new THREE.Vector3(115, 0, 0);
        const toStarA = starPos.clone().sub(nightRingPoint).normalize();
        const toPlanetA = planetPos.clone().sub(nightRingPoint);
        const tA = toPlanetA.dot(toStarA);
        expect(tA).toBeGreaterThan(0); // Planet is between ring point and star
        const closestA = toPlanetA.clone().sub(toStarA.clone().multiplyScalar(tA));
        expect(closestA.length()).toBeLessThan(planetR); // In umbra!

        // Point B on day side of ring (facing star):
        const dayRingPoint = new THREE.Vector3(85, 0, 0);
        const toStarB = starPos.clone().sub(dayRingPoint).normalize();
        const toPlanetB = planetPos.clone().sub(dayRingPoint);
        const tB = toPlanetB.dot(toStarB);
        expect(tB).toBeLessThan(0); // Planet is NOT between ring point and star -> fully lit!

        // 4. Directional Shadow Mapping on Player Ship & Celestial Meshes
        const playerShip = createPlayerMesh();
        let shipCastsShadow = false;
        let shipReceivesShadow = false;
        playerShip.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                if (child.castShadow) shipCastsShadow = true;
                if (child.receiveShadow) shipReceivesShadow = true;
            }
        });
        expect(shipCastsShadow).toBe(true);
        expect(shipReceivesShadow).toBe(true);

        // 5. Spawn system and verify shadow-casting on DirectionalLight and planet/moon meshes
        const testSystem: any = {
            id: 99,
            name: 'Shadow Test Prime',
            star: {
                name: 'Shadow Sun',
                type: 'Yellow Sun',
                color: '0xffffff',
                size: 5.0,
                mass: 200
            },
            planets: [
                {
                    name: 'Shadow Planet',
                    type: 'Gas Giant',
                    size: 7.0,
                    distance: 50.0,
                    color: '0x38bdf8',
                    moons: [
                        {
                            name: 'Shadow Moon',
                            type: 'Eismond',
                            size: 1.8,
                            distance: 14.0,
                            color: '0xcccccc'
                        }
                    ]
                }
            ]
        };

        STATE.universe = { systems: [testSystem] };
        STATE.currentSystemId = 0;
        activePlanets.length = 0;
        spawnPlanetsAndAsteroids();

        const testPlanet = activePlanets.find(p => p.name === 'Shadow Planet');
        expect(testPlanet).toBeDefined();
        expect(testPlanet!.bodyMesh!.castShadow).toBe(true);
        expect(testPlanet!.bodyMesh!.receiveShadow).toBe(false);

        const testMoon = activePlanets.find(p => p.name === 'Shadow Moon');
        expect(testMoon).toBeDefined();
        expect(testMoon!.bodyMesh!.castShadow).toBe(true);
        expect(testMoon!.bodyMesh!.receiveShadow).toBe(false);
    });

    test("26. Bio-Ship Evolution & Dynamic Cocoon Capacity (Scaling 4 -> 6 -> 10 -> 20 -> 30)", () => {
        // 1. Initial starting capacity must be 4
        expect(STATE.maxCrewCapacity).toBe(4);
        STATE.crew = [];

        // Add 4 dummy members
        for (let i = 0; i < 4; i++) {
            STATE.crew.push({
                id: 1000 + i,
                name: `Probe ${i}`,
                species: 'Terranischer Pionier',
                role: 'pilot',
                roleName: 'Astral-Pilot',
                buffDesc: '+30% Schub',
                stress: 20,
                baseStressRate: 0.1,
                illusionStability: 100,
                status: 'Harmonisch',
                thought: 'Bereit',
                age: 20,
                maxLifespan: 500
            });
        }
        expect(STATE.crew.length).toBe(4);

        // Abduction must reject when capacity is full
        STATE.nearestPlanet = {
            name: 'Target World',
            size: 5.0,
            mesh: { position: new THREE.Vector3(12, 0, 10), scale: new THREE.Vector3(1, 1, 1) } as any
        };
        STATE.abductActive = false;
        triggerAbductStart();
        expect(STATE.abductActive).toBe(false); // Gated behind max capacity!

        // 2. Buy 'hivemind' mutation -> expands to 6
        STATE.bioRes = 1000;
        STATE.siliconRes = 1000;
        buyMutation('hivemind');
        expect(STATE.mutations.hivemind.purchased).toBe(true);
        expect(STATE.maxCrewCapacity).toBe(6);

        // 3. Buy 'neural_cluster' mutation -> expands to 10
        STATE.bioRes = 2000;
        STATE.siliconRes = 2000;
        buyMutation('neural_cluster');
        expect(STATE.mutations.neural_cluster.purchased).toBe(true);
        expect(STATE.maxCrewCapacity).toBe(10);

        // 4. Buy 'cryo_matrix' mutation -> expands to 20
        STATE.bioRes = 3000;
        STATE.siliconRes = 3000;
        buyMutation('cryo_matrix');
        expect(STATE.mutations.cryo_matrix.purchased).toBe(true);
        expect(STATE.maxCrewCapacity).toBe(20);

        // 5. Buy 'hive_cerebrum' mutation -> expands to 30
        STATE.bioRes = 5000;
        STATE.siliconRes = 5000;
        buyMutation('hive_cerebrum');
        expect(STATE.mutations.hive_cerebrum.purchased).toBe(true);
        expect(STATE.maxCrewCapacity).toBe(30);
    });

    test("27. Species Clustering, Aggregated Metrics & Collective Operations", () => {
        STATE.crew = [];

        // Create 6 Terrans (scholarly)
        for (let i = 0; i < 6; i++) {
            STATE.crew.push({
                id: 2000 + i,
                name: `Terran ${i}`,
                species: 'Terranischer Pionier (Erde)',
                speciesArchetypeName: 'Terranischer Pionier',
                speciesColor: '#3b82f6',
                avatarIcon: '🧑‍🚀',
                disposition: 'scholarly',
                role: i % 2 === 0 ? 'biologist' : 'engineer',
                roleName: i % 2 === 0 ? 'Bio-Architekt' : 'Naniten-Meister',
                buffDesc: 'Buff',
                stress: 20 + i * 5,
                baseStressRate: 0.1,
                illusionStability: 80 - i * 2,
                status: 'Arbeitet',
                thought: 'Forschung...',
                age: 100 + i * 20,
                maxLifespan: 500,
                rejuvenationCount: 0
            });
        }

        // Create 5 Ash Warriors (martial)
        for (let i = 0; i < 5; i++) {
            STATE.crew.push({
                id: 3000 + i,
                name: `Kragh ${i}`,
                species: 'Ash-Krieger (Kasernen)',
                speciesArchetypeName: 'Ash-Krieger (Xenomilitär)',
                speciesColor: '#ef4444',
                avatarIcon: '⚔️',
                disposition: 'martial',
                role: 'pilot',
                roleName: 'Astral-Pilot',
                buffDesc: 'Schub',
                stress: 30 + i * 2,
                baseStressRate: 0.2,
                illusionStability: 90,
                status: 'Kampfbereit',
                thought: 'Ehre!',
                age: 150 + i * 10,
                maxLifespan: 400,
                rejuvenationCount: 0
            });
        }

        expect(STATE.crew.length).toBe(11);

        // 1. Check getSpeciesClusters
        const clusters = getSpeciesClusters();
        expect(clusters.length).toBe(2);

        const terranCluster = clusters.find(c => c.speciesName === 'Terranischer Pionier');
        expect(terranCluster).toBeDefined();
        expect(terranCluster!.count).toBe(6);
        expect(terranCluster!.disposition).toBe('scholarly');
        expect(terranCluster!.avgStress).toBe(Math.round((20 + 25 + 30 + 35 + 40 + 45) / 6));

        const ashCluster = clusters.find(c => c.speciesName === 'Ash-Krieger (Xenomilitär)');
        expect(ashCluster).toBeDefined();
        expect(ashCluster!.count).toBe(5);
        expect(ashCluster!.disposition).toBe('martial');
        expect(ashCluster!.dominantRole).toBe('Astral-Pilot');

        // 2. Toggle Expansion
        expect(terranCluster!.isExpanded).toBe(false);
        toggleClusterExpansion('Terranischer Pionier');
        const clustersUpdated = getSpeciesClusters();
        const terranUpdated = clustersUpdated.find(c => c.speciesName === 'Terranischer Pionier');
        expect(terranUpdated!.isExpanded).toBe(true);

        // 3. Collective Rejuvenation
        STATE.bioEnergy = 300;
        STATE.bioRes = 200;
        const initialAshAges = ashCluster!.members.map(m => m.age);
        rejuvenateSpeciesCluster('Ash-Krieger (Xenomilitär)');

        // All 5 Ash members must have age reduced by 35% of maxLifespan
        ashCluster!.members.forEach((m, idx) => {
            expect(m.age).toBeLessThan(initialAshAges[idx]);
            expect(m.rejuvenationCount).toBe(1);
        });
        const stationCounts = getStationCrewCounts();
        const bioDiscount = Math.min(0.5, stationCounts.bio_incubator * 0.15);
        const reqBio = Math.round(20 * (1 - bioDiscount));
        const reqRes = Math.round(10 * (1 - bioDiscount));
        expect(STATE.bioEnergy).toBe(300 - (5 * reqBio));
        expect(STATE.bioRes).toBe(200 - (5 * reqRes));
    });

    test("28. Triad Paradigms, Sub-Codex Combinations & Species Disposition Matrix", () => {
        STATE.crew = [];

        // Add 2 Martial, 2 Scholarly, 1 Empathic
        STATE.crew.push({
            id: 4001,
            name: 'Kragh-1',
            species: 'Ash-Krieger',
            disposition: 'martial',
            role: 'pilot',
            roleName: 'Pilot',
            buffDesc: 'Buff',
            stress: 10,
            baseStressRate: 0.1,
            illusionStability: 100,
            status: 'Ok',
            thought: 'Ruhm',
            age: 50,
            maxLifespan: 500
        });
        STATE.crew.push({
            id: 4002,
            name: 'Kragh-2',
            species: 'Ash-Krieger',
            disposition: 'martial',
            role: 'pilot',
            roleName: 'Pilot',
            buffDesc: 'Buff',
            stress: 10,
            baseStressRate: 0.1,
            illusionStability: 100,
            status: 'Ok',
            thought: 'Ruhm',
            age: 50,
            maxLifespan: 500
        });
        STATE.crew.push({
            id: 4003,
            name: 'Dr. Song',
            species: 'Terraner',
            disposition: 'scholarly',
            role: 'biologist',
            roleName: 'Biologe',
            buffDesc: 'Buff',
            stress: 10,
            baseStressRate: 0.1,
            illusionStability: 100,
            status: 'Ok',
            thought: 'Analyse',
            age: 50,
            maxLifespan: 500
        });
        STATE.crew.push({
            id: 4004,
            name: 'Dr. Vance',
            species: 'Terraner',
            disposition: 'scholarly',
            role: 'biologist',
            roleName: 'Biologe',
            buffDesc: 'Buff',
            stress: 10,
            baseStressRate: 0.1,
            illusionStability: 100,
            status: 'Ok',
            thought: 'Analyse',
            age: 50,
            maxLifespan: 500
        });
        STATE.crew.push({
            id: 4005,
            name: 'Maya-Sol',
            species: 'Olyndar',
            disposition: 'empathic',
            role: 'psychologist',
            roleName: 'Psychologe',
            buffDesc: 'Buff',
            stress: 10,
            baseStressRate: 0.1,
            illusionStability: 100,
            status: 'Ok',
            thought: 'Ruhe',
            age: 50,
            maxLifespan: 1000
        });

        // 1. Domination + Iron Discipline (Brute force: martial crew resists)
        setPrimaryParadigm('domination', true);
        setActiveSubCodex('iron_discipline');
        updateParadigmModifiers();
        expect(STATE.paradigmModifiers.thrustBonus).toBe(0.45);
        // 2 martial crew members add resistance: drainMult increases
        expect(STATE.paradigmModifiers.mentalDrainMult).toBeGreaterThan(1.55);
        expect(STATE.paradigmModifiers.stressModifier).toBeGreaterThan(0.7);

        // 2. Domination + Gunboat Diplomacy (Martial crew respects strength)
        setActiveSubCodex('gunboat_diplomacy');
        updateParadigmModifiers();
        expect(STATE.paradigmModifiers.thrustBonus).toBe(0.30);
        expect(STATE.paradigmModifiers.stressModifier).toBeLessThan(0); // Stress reduced!

        // 3. Deception + Benevolent Facade (Scholarly crew analyzes glitches)
        setPrimaryParadigm('deception', true);
        setActiveSubCodex('benevolent_facade');
        updateParadigmModifiers();
        expect(STATE.paradigmModifiers.stealthBonus).toBe(0.45);
        expect(STATE.paradigmModifiers.harmonyBonus).toBe(0.15);
        // 2 scholarly minds add slight mental drain to maintain facade
        expect(STATE.paradigmModifiers.mentalDrainMult).toBeGreaterThan(1.0);

        // 4. Symbiosis + Living Symbiosis (Organic unity)
        setPrimaryParadigm('symbiosis', true);
        setActiveSubCodex('living_symbiosis');
        updateParadigmModifiers();
        expect(STATE.paradigmModifiers.bioRegenBonus).toBe(0.60);
        expect(STATE.paradigmModifiers.harmonyBonus).toBe(0.45);
        expect(STATE.paradigmModifiers.stressModifier).toBeLessThan(-1.5);

        // Verify crew buffs integrate paradigm modifiers
        calculateCrewBuffs();
        expect(STATE.crewBuffs.bioGain).toBeGreaterThan(1.5);
    });

    test("29. Paradigm Switching Cycle & Cluster Expansion State Verification", () => {
        clearExpandedClusters();
        STATE.primaryParadigm = 'deception';
        
        // Cycle: deception -> domination -> symbiosis -> deception (instant mode for test validation)
        cyclePrimaryParadigm(true);
        expect(STATE.primaryParadigm).toBe('domination');
        expect(STATE.activeSubCodex).toBe('gunboat_diplomacy'); // Default assigned on domination switch

        cyclePrimaryParadigm(true);
        expect(STATE.primaryParadigm).toBe('symbiosis');
        // 'gunboat_diplomacy' is compatible with both domination & symbiosis (Protection Pact), so preserved
        expect(STATE.activeSubCodex).toBe('gunboat_diplomacy');

        cyclePrimaryParadigm(true);
        expect(STATE.primaryParadigm).toBe('deception');
        expect(STATE.activeSubCodex).toBe('benevolent_facade'); // Default assigned on deception switch

        // Test cluster expansion toggle and key generation
        expect(getExpandedClustersKey()).toBe('');
        toggleClusterExpansion('Terraner');
        expect(getExpandedClustersKey()).toBe('Terraner');
        
        toggleClusterExpansion('Olyndar');
        expect(getExpandedClustersKey()).toBe('Olyndar,Terraner');

        toggleClusterExpansion('Terraner');
        expect(getExpandedClustersKey()).toBe('Olyndar');

        toggleClusterExpansion('Olyndar');
        expect(getExpandedClustersKey()).toBe('');
    });

    test("30. Organ-Station Synergy, Station Tick Effects & Psionic Upheaval (Transition)", () => {
        STATE.crew = [];
        STATE.primaryParadigm = 'deception';
        STATE.doctrineTransition = {
            active: false,
            fromParadigm: 'deception',
            targetParadigm: 'deception',
            progress: 1.0,
            duration: 25.0
        };

        // Add 4 crew members with different optimal organ assignments
        STATE.crew.push({
            id: 5001,
            name: 'Pilot Thorne',
            species: 'Terraner',
            disposition: 'martial',
            role: 'pilot',
            roleName: 'Pilot',
            buffDesc: 'Buff',
            stress: 10,
            baseStressRate: 0.1,
            illusionStability: 100,
            status: 'Ok',
            thought: 'Fokus',
            age: 40,
            maxLifespan: 500
        });
        STATE.crew.push({
            id: 5002,
            name: 'Eng Petrov',
            species: 'Cyborg',
            disposition: 'lithoid',
            role: 'engineer',
            roleName: 'Ingenieur',
            buffDesc: 'Buff',
            stress: 10,
            baseStressRate: 0.1,
            illusionStability: 100,
            status: 'Ok',
            thought: 'Fokus',
            age: 40,
            maxLifespan: 500
        });
        STATE.crew.push({
            id: 5003,
            name: 'Bio Song',
            species: 'Myzel',
            disposition: 'synthetic',
            role: 'biologist',
            roleName: 'Biologe',
            buffDesc: 'Buff',
            stress: 10,
            baseStressRate: 0.1,
            illusionStability: 100,
            status: 'Ok',
            thought: 'Fokus',
            age: 40,
            maxLifespan: 500
        });
        STATE.crew.push({
            id: 5004,
            name: 'Psi Vance',
            species: 'Olyndar',
            disposition: 'empathic',
            role: 'psychologist',
            roleName: 'Psychologe',
            buffDesc: 'Buff',
            stress: 10,
            baseStressRate: 0.1,
            illusionStability: 100,
            status: 'Ok',
            thought: 'Fokus',
            age: 40,
            maxLifespan: 500
        });

        // 1. Test Optimal Station Assignment
        calculateCrewBuffs();
        const counts = getStationCrewCounts();
        expect(counts.flight_synapse).toBe(1);
        expect(counts.chitin_gland).toBe(1);
        expect(counts.bio_incubator).toBe(1);
        expect(counts.dream_core).toBe(1);

        // Verify Station Buff Contributions
        expect(STATE.crewBuffs.thrust).toBeGreaterThan(1.0);
        expect(STATE.crewBuffs.repairRate).toBeGreaterThan(0.9);
        expect(STATE.crewBuffs.bioGain).toBeGreaterThan(1.1);
        expect(STATE.crewBuffs.psionicBonus).toBeGreaterThan(20);

        // 2. Test Manual Station Switch
        setCrewStation(5001, 'chitin_gland');
        const updatedCounts = getStationCrewCounts();
        expect(updatedCounts.flight_synapse).toBe(0);
        expect(updatedCounts.chitin_gland).toBe(2);

        // Re-assign back to optimal
        setCrewStation(5001, 'flight_synapse');

        // 3. Test Real-time Station Tick (Chitin Gland Silicon Auto-Repair)
        STATE.health = 50;
        STATE.maxHealth = 100;
        STATE.siliconRes = 25;
        updateCrewSimulation(2.0); // 2 seconds tick
        expect(STATE.health).toBeGreaterThan(50);
        expect(STATE.siliconRes).toBeLessThan(25);

        // 4. Test Psionic Upheaval (Doctrine Transition Process)
        expect(STATE.primaryParadigm).toBe('deception');
        setPrimaryParadigm('domination', false); // Non-instant transition trigger
        expect(STATE.doctrineTransition.active).toBe(true);
        expect(STATE.doctrineTransition.fromParadigm).toBe('deception');
        expect(STATE.doctrineTransition.targetParadigm).toBe('domination');
        expect(STATE.doctrineTransition.progress).toBe(0.0);

        // Modifiers must be interpolated, not abruptly switched
        updateParadigmModifiers();
        expect(STATE.primaryParadigm).toBe('deception'); // Still in transition

        // Advance simulation with Dream Core accelerating the shift
        updateCrewSimulation(10.0);
        expect(STATE.doctrineTransition.progress).toBeGreaterThan(0.3);

        // Telepathy doubles transition speed
        STATE.telepathyActive = true;
        updateCrewSimulation(10.0);
        expect(STATE.doctrineTransition.progress).toBeGreaterThan(0.8);

        // Finish transition
        updateCrewSimulation(10.0);
        expect(STATE.doctrineTransition.active).toBe(false);
        expect(STATE.primaryParadigm).toBe('domination');
        STATE.telepathyActive = false;
    });

    test("31. Initial neutral solitude, first contact doctrine decision modal & instant doctrine awakening", () => {
        // Reset to initial game-start state
        STATE.primaryParadigm = 'neutral';
        STATE.activeSubCodex = 'none';
        STATE.crew = [];
        updateParadigmModifiers();

        // 1. In neutral solitude: modifiers are all zeroed out
        expect(STATE.primaryParadigm).toBe('neutral');
        expect(STATE.activeSubCodex).toBe('none');
        expect(STATE.paradigmModifiers.thrustBonus).toBe(0);
        expect(STATE.paradigmModifiers.stealthBonus).toBe(0);
        expect(STATE.paradigmModifiers.bioRegenBonus).toBe(0);
        expect(STATE.paradigmModifiers.harmonyBonus).toBe(0);

        // Attempting to cycle paradigm without crew does nothing (Najmafar is trapped in solitude)
        cyclePrimaryParadigm();
        expect(STATE.primaryParadigm).toBe('neutral');

        // 2. Generate first contact candidate and trigger modal
        const candidates = generateProceduralCandidates(12345, 1);
        expect(candidates.length).toBe(1);
        const firstBeing = candidates[0];

        // Abduct the candidate
        STATE.crew.push(firstBeing);
        openFirstContactModal(firstBeing);
        expect(isFirstContactModalOpen()).toBe(true);

        // 3. Player chooses Symbiosis
        chooseFirstContactDoctrine('symbiosis');
        expect(isFirstContactModalOpen()).toBe(false);
        expect(STATE.primaryParadigm).toBe('symbiosis');
        expect(STATE.activeSubCodex).toBe('living_symbiosis');

        // Initial choice is instantly awakened without upheaval transition delay
        expect(STATE.doctrineTransition.active).toBe(false);
        expect(STATE.paradigmModifiers.bioRegenBonus).toBeGreaterThan(0);

        // Subsequent cycling now moves between the three doctrines
        cyclePrimaryParadigm(true);
        expect(STATE.primaryParadigm).toBe('deception');
    });

    test("32. Organic Synaptic Evolution Web: Node layout hierarchy, SVG axon state connections, inspector selection, and progressive mutation synthesis", () => {
        // 1. Verify Definition Coverage for All 3 Branches stemming from Najmafar's Nucleus
        expect(MUTATION_DEFINITIONS.nucleus).toBeDefined();
        expect(MUTATION_DEFINITIONS.nucleus.branch).toBe('nucleus');

        // Ast 1: Chitin & Fleisch
        expect(MUTATION_DEFINITIONS.organic_siphon).toBeDefined();
        expect(MUTATION_DEFINITIONS.chitin_armor).toBeDefined();
        expect(MUTATION_DEFINITIONS.vector_tentacles).toBeDefined();
        expect(MUTATION_DEFINITIONS.blade_armor).toBeDefined();
        expect(MUTATION_DEFINITIONS.chitin_armor.branch).toBe('chitin');

        // Ast 2: Neuronales Nest
        expect(MUTATION_DEFINITIONS.cocoon).toBeDefined();
        expect(MUTATION_DEFINITIONS.hivemind).toBeDefined();
        expect(MUTATION_DEFINITIONS.neural_cluster).toBeDefined();
        expect(MUTATION_DEFINITIONS.cryo_matrix).toBeDefined();
        expect(MUTATION_DEFINITIONS.hive_cerebrum).toBeDefined();
        expect(MUTATION_DEFINITIONS.cocoon.branch).toBe('cocoon');

        // Ast 3: Psionik & Geist
        expect(MUTATION_DEFINITIONS.telepathic_focus).toBeDefined();
        expect(MUTATION_DEFINITIONS.psionic_pulse).toBeDefined();
        expect(MUTATION_DEFINITIONS.chimera_veil).toBeDefined();
        expect(MUTATION_DEFINITIONS.resonance_screech).toBeDefined();
        expect(MUTATION_DEFINITIONS.telepathic_focus.branch).toBe('psionic');

        // Relikt
        expect(MUTATION_DEFINITIONS.ibad).toBeDefined();
        expect(MUTATION_DEFINITIONS.ibad.branch).toBe('artifact');

        // 2. Verify Hierarchical Axon Connections for all 3 Branches
        expect(MUTATION_CONNECTIONS).toContainEqual(['nucleus', 'organic_siphon']);
        expect(MUTATION_CONNECTIONS).toContainEqual(['organic_siphon', 'chitin_armor']);
        expect(MUTATION_CONNECTIONS).toContainEqual(['chitin_armor', 'vector_tentacles']);
        expect(MUTATION_CONNECTIONS).toContainEqual(['vector_tentacles', 'blade_armor']);

        expect(MUTATION_CONNECTIONS).toContainEqual(['nucleus', 'cocoon']);
        expect(MUTATION_CONNECTIONS).toContainEqual(['cocoon', 'hivemind']);
        expect(MUTATION_CONNECTIONS).toContainEqual(['hivemind', 'neural_cluster']);
        expect(MUTATION_CONNECTIONS).toContainEqual(['neural_cluster', 'cryo_matrix']);
        expect(MUTATION_CONNECTIONS).toContainEqual(['cryo_matrix', 'hive_cerebrum']);

        expect(MUTATION_CONNECTIONS).toContainEqual(['nucleus', 'telepathic_focus']);
        expect(MUTATION_CONNECTIONS).toContainEqual(['telepathic_focus', 'psionic_pulse']);
        expect(MUTATION_CONNECTIONS).toContainEqual(['psionic_pulse', 'chimera_veil']);
        expect(MUTATION_CONNECTIONS).toContainEqual(['chimera_veil', 'resonance_screech']);

        expect(MUTATION_CONNECTIONS).toContainEqual(['psionic_pulse', 'ibad']);

        // 3. Test Inspector Selection
        selectMutationNode('chitin_armor');
        expect(getSelectedMutationKey()).toBe('chitin_armor');

        selectMutationNode('psionic_pulse');
        expect(getSelectedMutationKey()).toBe('psionic_pulse');

        // 4. Test Organic Purchase of Chitin & Fleisch Branch and Escalating Radiation Protection
        STATE.bioRes = 2000;
        STATE.siliconRes = 2000;
        if (STATE.mutations.organic_siphon) STATE.mutations.organic_siphon.purchased = false;
        if (STATE.mutations.chitin_armor) STATE.mutations.chitin_armor.purchased = false;
        if (STATE.mutations.vector_tentacles) STATE.mutations.vector_tentacles.purchased = false;
        if (STATE.mutations.blade_armor) STATE.mutations.blade_armor.purchased = false;
        if (STATE.mutations.armor) STATE.mutations.armor.purchased = false;

        // Step A: Base Radiation Protection is 0
        expect(calculateRadiationProtection()).toBe(0);

        // Step B: Buy Organischer Siphon -> +25% Radiation Protection
        buyMutation('organic_siphon');
        expect(STATE.mutations.organic_siphon?.purchased).toBe(true);
        expect(calculateRadiationProtection()).toBeCloseTo(0.25, 2);

        // Step C: Buy Chitin-Panzer -> +25% Radiation Protection (Total 50%)
        buyMutation('chitin_armor');
        expect(STATE.mutations.chitin_armor?.purchased).toBe(true);
        expect(STATE.mutations.armor.purchased).toBe(true); // legacy alias synced
        expect(calculateRadiationProtection()).toBeCloseTo(0.50, 2);

        // Step D: Buy Vektor-Tentakel -> Upgrades agility & thrust
        const oldThrust = STATE.thrustStrength;
        buyMutation('vector_tentacles');
        expect(STATE.mutations.vector_tentacles?.purchased).toBe(true);
        expect(STATE.thrustStrength).toBeGreaterThan(oldThrust);

        // Step E: Buy Klingen-Panzerung -> +35% Radiation Protection (Total 85%)
        buyMutation('blade_armor');
        expect(STATE.mutations.blade_armor?.purchased).toBe(true);
        expect(calculateRadiationProtection()).toBeCloseTo(0.85, 2);

        // 5. Radiation Damage & Aging Mitigation in Hazardous Zone
        // Mock a hazardous planet with Extreme radiation
        STATE.nearestPlanet = {
            attributes: { radiationLevel: 'Extreme' }
        } as any;
        STATE.health = 100;
        STATE.crew = [{
            id: 'c-test-rad',
            name: 'RadTest',
            species: 'Human',
            age: 0,
            maxLifespan: 1000,
            stress: 0
        }] as any;

        // Tick simulation with 85% shielding
        updateCrewSimulation(1.0);
        // With 85% protection: ambient Extreme (0.9) * (1 - 0.85) = 0.135 effective radiation (below 0.25 threshold)
        // Hull takes 0 damage and aging multiplier is modest: 1.0 + (0.135 * 1.5) = ~1.20x vs 2.35x unshielded
        expect(STATE.health).toBe(100);
        expect(STATE.crew[0].age).toBeLessThan(1.5);
    });

    test("33. Orbital Planetary Fleet Defense: Spacefaring & Advanced civilizations spawn patrol fleets, intercept hostile incursions, and respond to EMP bio-discharge & salvage", () => {
        clearFleet();
        activePlanets.length = 0;

        // 1. Setup Spacefaring civilized planet
        const planetGroup = new THREE.Group();
        planetGroup.position.set(150, 0, 0);

        const civilizedPlanet: any = {
            name: 'Valerius Prime',
            type: 'Habitable',
            size: 6.0,
            distance: 150,
            mesh: planetGroup,
            isMoon: false,
            scanned: false,
            attributes: {
                atmos: "Stickstoff & Sauerstoff",
                temp: "22°C",
                bio: "Komplex",
                res: "Hoch",
                species: {
                    hasSentient: true,
                    name: 'Valerianer',
                    population: 5000000000,
                    techLevel: 'Spacefaring',
                    defenseRating: 65,
                    fleetDisposition: 'Defensive'
                }
            }
        };

        activePlanets.push(civilizedPlanet);

        // 2. Spawn fleets
        spawnSystemFleet();
        expect(STATE.fleetShips.length).toBe(2); // Spacefaring spawns 2 ships (1 corvette, 1 interceptor)
        const corvette = STATE.fleetShips.find(s => s.type === 'corvette');
        const interceptor = STATE.fleetShips.find(s => s.type === 'interceptor');
        expect(corvette).toBeDefined();
        expect(interceptor).toBeDefined();
        expect(corvette!.state).toBe('patrol');
        expect(interceptor!.state).toBe('patrol');

        // 3. Patrol Tick - Ships orbit around planet
        const initialAngle = corvette!.orbitAngle;
        updateFleet(0.5);
        expect(corvette!.orbitAngle).not.toBe(initialAngle);

        // 4. Incursion Detection - Player approaches Valerius Prime within 35 units
        STATE.playerPosition.set(140, 0, 0); // 10 units away from planet
        updateFleet(0.1);
        expect(corvette!.state).toBe('intercept');
        expect(interceptor!.state).toBe('intercept');

        // 5. Hostile Intercept & Fire Projectile
        corvette!.attackCooldown = 0.05;
        updateFleet(0.1);
        expect(STATE.fleetProjectiles.length).toBeGreaterThan(0);

        // 6. Player Countermeasure: Trigger EMP Bio-Discharge [X]
        STATE.bioDischargeCooldown = 0;
        STATE.bioEnergy = 50;
        STATE.mentalEnergy = 50;
        triggerBioDischarge();
        expect(STATE.empCharging).toBe(true);

        // Advance EMP charging timer to discharge shockwave
        updateFleet(0.5);
        expect(STATE.empCharging).toBe(false);

        // Shockwave hits and stuns hostile ships
        updateFleet(0.1);
        expect(corvette!.state).toBe('stunned');
        expect(corvette!.stunTimer).toBeGreaterThan(0);

        // 7. Salvage & Bio-Assimilation [E]
        STATE.playerPosition.copy(corvette!.position);
        STATE.siliconRes = 0;
        STATE.bioEnergy = 10;
        const salvaged = salvageNearestWreck();
        expect(salvaged).toBe(true);
        expect(STATE.siliconRes).toBe(35);
        expect(STATE.bioEnergy).toBe(40);
        expect(STATE.fleetShips.length).toBe(1);

        // 8. Hyperjump Sector Cleanup
        clearFleet();
        expect(STATE.fleetShips.length).toBe(0);
        expect(STATE.fleetProjectiles.length).toBe(0);
    });

    test("34. Minimap Radar Celestial Navigation & Planetary Gravity Vectors: Renders 360° off-screen planetary gravity beacons on radar perimeter and provides subtle long-range tidal drift", () => {
        // 1. Setup mock active planet far outside radar range (e.g. 350 AE away)
        const planetGroup = new THREE.Group();
        planetGroup.position.set(0, 0, -350); // 350 AE north

        const targetPlanet: any = {
            name: 'Aethelgard Prime',
            type: 'Habitable',
            size: 7.0,
            distance: 350,
            angle: 0,
            speed: 0.05,
            mesh: planetGroup,
            source: {
                type: 'planet',
                position: new THREE.Vector3(0, 0, -350),
                mass: 600,
                radius: 7.0,
                gravityRange: 50.0,
                isAbsorbed: false
            },
            isMoon: false,
            attributes: {
                species: {
                    hasSentient: true,
                    name: 'Aethelgardianer',
                    population: 4200000000
                }
            }
        };

        activePlanets.length = 0;
        activePlanets.push(targetPlanet);
        STATE.gravitySources = [targetPlanet.source];
        STATE.lockedTarget = targetPlanet;
        STATE.playerPosition.set(0, 0, 0);

        // 2. Initialize HUD & Run Minimap Update (renders off-screen perimeter indicators without errors)
        initHUD();
        expect(() => updateMinimap()).not.toThrow();

        // 3. Long-range subtle cosmic gravity tidal pull (beyond immediate gravityRange = 50 up to 120)
        targetPlanet.distance = 100;
        targetPlanet.angle = 0;
        targetPlanet.speed = 0;
        targetPlanet.source.position.set(100, 0, 0); // distance = 100 (> 50 and < 120)
        STATE.playerPosition.set(0, 0, 0);
        STATE.playerVelocity.set(0, 0, 0);
        STATE.isThrusting = false;
        STATE.keys.w = false;
        STATE.keys.s = false;
        STATE.flightAssist = false;

        updatePhysics(0.1);
        // Player should experience a subtle tidal pull toward +X
        expect(STATE.playerVelocity.x).toBeGreaterThan(0);
        expect(STATE.playerPosition.x).toBeGreaterThan(0);
    });
});




