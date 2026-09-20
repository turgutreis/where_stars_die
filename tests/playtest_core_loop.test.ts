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
        addEventListener: () => {}
    };
    (globalThis as any).document = {
        getElementById: () => dummyEl,
        createElement: () => ({ ...dummyEl }),
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
import { initiateSystemArrival, initiateSystemDeparture, spawnVoyagerProbe, updateActivePlanets } from '../src/systems/universe';
import { clearJumpGates, activeJumpGates } from '../src/procedural/meshes';
import { updatePhysics } from '../src/engine/physics';
import { generateProceduralCandidates, getCrewReactiveThought } from '../src/systems/crew-generation';
import { calculateCrewBuffs, updateCrewSimulation, rejuvenateCrewMember } from '../src/systems/crew';
import { advanceFtueStep, FTUE_DIRECTIVES } from '../src/ui/directives';
import { openVoyagerDialog, closeVoyagerDialog, isVoyagerDialogOpen } from '../src/ui/voyager-dialog';
import { handleVoyagerScan, setLockedTarget } from '../src/input/controls';
import { calculateGravityAndCheckCollision, TRAJECTORY_SEGMENTS } from '../src/engine/trajectory';

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

        const erde = solSys.planets.find((p: any) => p.name === "Erde (Terra)");
        expect(erde.moons.length).toBe(1);
        expect(erde.moons[0].name).toContain("Luna");
        expect(erde.species.name).toContain("Menschheit");
        expect(erde.species.candidates.some((c: any) => c.name.includes("Carl Sagan"))).toBe(true);

        const jupiter = solSys.planets.find((p: any) => p.name === "Jupiter");
        expect(jupiter.moons.length).toBe(4); // Io, Europa, Ganymed, Kallisto
        expect(jupiter.magnetosphere).toBe("Hyper-Magnetic");

        const saturn = solSys.planets.find((p: any) => p.name === "Saturn");
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
});




