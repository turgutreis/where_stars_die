import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene } from '../engine/scene';
import { SpaceStation, PlanetEntry } from '../types/game';
import { addLogEntry } from '../ui/hud';

export interface SpaceStationController {
    group: THREE.Group;
    bodyMesh: THREE.Mesh;
    ringMesh: THREE.Mesh;
    dockLights: THREE.Mesh[];
    shieldMesh?: THREE.Mesh;
    update: (dt: number) => void;
}

export const activeStationControllers: SpaceStationController[] = [];

/**
 * Creates a procedural 3D sci-fi space station with rotating habitat ring,
 * docking pylons, comm dish, solar wings, and blinking navigation beacons.
 */
export function createSpaceStationMesh(
    type: 'citadel' | 'trade_hub' | 'mining_relay' = 'trade_hub',
    factionColor = 0x38bdf8
): SpaceStationController {
    const group = new THREE.Group();

    // 1. Central Core Spindle / Spire
    const spindleRadius = type === 'citadel' ? 1.4 : 1.1;
    const spindleHeight = type === 'citadel' ? 6.2 : 5.0;
    const spindleGeo = new THREE.CylinderGeometry(spindleRadius * 0.7, spindleRadius, spindleHeight, 8);
    const spindleMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.35,
        metalness: 0.85
    });
    const bodyMesh = new THREE.Mesh(spindleGeo, spindleMat);
    group.add(bodyMesh);

    // 2. Rotating Habitat Torus Ring
    const ringRadius = type === 'citadel' ? 4.4 : (type === 'trade_hub' ? 3.8 : 3.2);
    const ringTube = type === 'citadel' ? 0.65 : 0.48;
    const ringGeo = new THREE.TorusGeometry(ringRadius, ringTube, 10, 32);
    const ringMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.25,
        metalness: 0.8,
        emissive: factionColor,
        emissiveIntensity: 0.25
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    group.add(ringMesh);

    // Habitat Ring Spoke Struts (connecting central spindle to torus)
    const spokeCount = type === 'citadel' ? 4 : 3;
    for (let i = 0; i < spokeCount; i++) {
        const angle = (i * Math.PI * 2) / spokeCount;
        const spokeGeo = new THREE.CylinderGeometry(0.12, 0.12, ringRadius, 6);
        const spokeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.4 });
        const spokeMesh = new THREE.Mesh(spokeGeo, spokeMat);
        spokeMesh.rotation.z = Math.PI / 2;
        spokeMesh.rotation.y = angle;
        spokeMesh.position.set(Math.cos(angle) * (ringRadius * 0.5), 0, Math.sin(angle) * (ringRadius * 0.5));
        ringMesh.add(spokeMesh);
    }

    // 3. Solar Collector Arrays (Extend along Y-axis)
    const solarWingCount = 2;
    for (let w = 0; w < solarWingCount; w++) {
        const wingGeo = new THREE.BoxGeometry(0.08, 2.2, 1.4);
        const wingMat = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            roughness: 0.15,
            metalness: 0.95,
            emissive: 0x0369a1,
            emissiveIntensity: 0.35
        });
        const wingMesh = new THREE.Mesh(wingGeo, wingMat);
        const side = w === 0 ? 1 : -1;
        wingMesh.position.set(0, (spindleHeight * 0.45 + 1.1) * side, 0);
        group.add(wingMesh);
    }

    // 4. Communication & Sensor Dish at the apex
    const dishGeo = new THREE.ConeGeometry(0.9, 0.4, 12, 1, true);
    dishGeo.rotateX(Math.PI);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.2 });
    const dishMesh = new THREE.Mesh(dishGeo, dishMat);
    dishMesh.position.set(0, spindleHeight * 0.5 + 0.3, 0);
    group.add(dishMesh);

    // 5. Docking Navigation Lights (Red / Green beacons on docking arms)
    const dockLights: THREE.Mesh[] = [];
    const pylonCount = 4;
    for (let p = 0; p < pylonCount; p++) {
        const pAngle = (p * Math.PI * 2) / pylonCount;
        const pylonGeo = new THREE.BoxGeometry(0.35, 0.25, 1.8);
        const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.3 });
        const pylonMesh = new THREE.Mesh(pylonGeo, pylonMat);
        pylonMesh.position.set(Math.cos(pAngle) * (spindleRadius + 0.9), 0, Math.sin(pAngle) * (spindleRadius + 0.9));
        pylonMesh.rotation.y = -pAngle;
        group.add(pylonMesh);

        // Blinking beacon sphere at pylon tip
        const isPort = p % 2 === 0;
        const beaconCol = isPort ? 0x22c55e : 0xef4444; // Green / Red standard nav lights
        const beaconGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const beaconMat = new THREE.MeshBasicMaterial({ color: beaconCol });
        const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
        beaconMesh.position.set(0, 0.18, 0.9);
        pylonMesh.add(beaconMesh);
        dockLights.push(beaconMesh);
    }

    // 6. Station Defense Shield Bubble
    const shieldGeo = new THREE.SphereGeometry(ringRadius * 1.25, 16, 16);
    const shieldMat = new THREE.MeshBasicMaterial({
        color: factionColor,
        transparent: true,
        opacity: 0.08,
        wireframe: true,
        blending: THREE.AdditiveBlending
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    group.add(shieldMesh);

    const controller: SpaceStationController = {
        group,
        bodyMesh,
        ringMesh,
        dockLights,
        shieldMesh,
        update: (dt: number) => {
            // Smooth habitat ring rotation
            ringMesh.rotation.z += (type === 'citadel' ? 0.35 : 0.5) * dt;

            // Nav beacon blink cycle (1.2 Hz)
            const blink = Math.sin(Date.now() * 0.006) > 0;
            dockLights.forEach(light => {
                light.visible = blink;
            });

            // Shield subtle breathing pulse
            if (shieldMesh) {
                const shieldPulse = 0.06 + Math.sin(Date.now() * 0.003) * 0.03;
                shieldMat.opacity = shieldPulse;
            }
        }
    };

    activeStationControllers.push(controller);
    return controller;
}

/**
 * Procedurally populates orbital space stations in systems with Spacefaring
 * or Hyper-Advanced civilizations.
 */
export function spawnSystemSpaceStations(planetsInput?: PlanetEntry[]) {
    clearSpaceStations();

    let planets: PlanetEntry[] = [];
    if (planetsInput && Array.isArray(planetsInput) && planetsInput.length > 0) {
        planets = planetsInput;
    } else if (activePlanets && activePlanets.length > 0) {
        planets = activePlanets;
    } else if (STATE.universe && STATE.universe.systems) {
        const activeSys = STATE.universe.systems.find(s => s.id === STATE.currentSystemId) || STATE.universe.systems[STATE.currentSystemId];
        if (activeSys && activeSys.planets) {
            planets = activeSys.planets;
        }
    }

    if (!planets || planets.length === 0) return;

    let stationIdCounter = 1;

    planets.forEach((p: PlanetEntry) => {
        if (p.isMoon) return;
        const species = (p.attributes && p.attributes.species) || p.species;
        if (!species || !species.techLevel) return;

        const tech = species.techLevel;
        if (tech === 'Spacefaring' || tech === 'Hyper-Advanced') {
            const isHyper = tech === 'Hyper-Advanced';
            const stationType = isHyper ? 'citadel' : 'trade_hub';
            const factionCol = isHyper ? 0xa855f7 : 0x38bdf8;

            const controller = createSpaceStationMesh(stationType, factionCol);

            const pSize = p.size || 5.0;
            // Place in high stable synchronous orbit around planet
            const orbitRadius = pSize * 2.5 + 7.5;
            const orbitAngle = Math.PI * 0.35 + (stationIdCounter * 1.5);
            const orbitSpeed = (0.28 / Math.sqrt(orbitRadius));

            const planetX = p.mesh ? p.mesh.position.x : 0;
            const planetZ = p.mesh ? p.mesh.position.z : 0;

            controller.group.position.set(
                planetX + Math.cos(orbitAngle) * orbitRadius,
                0,
                planetZ + Math.sin(orbitAngle) * orbitRadius
            );

            scene.add(controller.group);

            const stName = isHyper
                ? `Orbital-Zitadelle ${p.name.replace(/ Prime| Major| A| B/g, '')}-Alpha`
                : `Handelsrelais ${p.name.replace(/ Prime| Major| A| B/g, '')}-Dock`;

            const station: SpaceStation = {
                id: Date.now() + stationIdCounter++,
                name: stName,
                factionId: species.factionId || 'free_traders',
                mesh: controller.group,
                bodyMesh: controller.bodyMesh,
                ringMesh: controller.ringMesh,
                position: controller.group.position,
                parentPlanet: p,
                orbitRadius,
                orbitAngle,
                orbitSpeed,
                rotationSpeed: 0.5,
                health: isHyper ? 350 : 180,
                maxHealth: isHyper ? 350 : 180,
                defenseRating: isHyper ? 95 : 60,
                alertLevel: 'peace',
                alertTimer: 0,
                type: stationType
            };

            STATE.spaceStations.push(station);

            // Register as gravity beacon so radar & minimap track it
            const stationGravSource: any = {
                mesh: controller.group,
                type: 'ship_wreck',
                name: stName,
                mass: 2.5,
                radius: 4.5,
                gravityRange: 16.0,
                position: controller.group.position,
                isSpaceStation: true
            };
            STATE.gravitySources.push(stationGravSource);
        }
    });

    if (STATE.spaceStations.length > 0) {
        addLogEntry("SYSTEM", `📡 ORBITALE RELAIS: ${STATE.spaceStations.length} Raumstation(en) im Sektor erfasst.`);
    }
}

/**
 * Updates orbital motion, rotations, and animation controllers of all space stations.
 */
export function updateSpaceStations(dt: number) {
    activeStationControllers.forEach(c => c.update(dt));

    STATE.spaceStations.forEach(station => {
        // Orbit around parent planet if mesh is available
        if (station.parentPlanet && station.parentPlanet.mesh) {
            station.orbitAngle += station.orbitSpeed * dt;
            const parentPos = station.parentPlanet.mesh.position;
            station.position.x = parentPos.x + Math.cos(station.orbitAngle) * station.orbitRadius;
            station.position.z = parentPos.z + Math.sin(station.orbitAngle) * station.orbitRadius;
        }

        // Alert countdown
        if (station.alertTimer > 0) {
            station.alertTimer = Math.max(0, station.alertTimer - dt);
            if (station.alertTimer <= 0) {
                station.alertLevel = 'peace';
            }
        }
    });
}

/**
 * Clears and disposes all active space station meshes and data.
 */
export function clearSpaceStations() {
    STATE.spaceStations.forEach(st => {
        if (st.mesh) {
            scene.remove(st.mesh);
        }
    });
    activeStationControllers.length = 0;
    STATE.spaceStations = [];
}
