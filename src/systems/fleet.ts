import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene } from '../engine/scene';
import { addLogEntry } from '../ui/hud';
import { playCrashSound, playSiliconCollectSound, playEmpChargeSound, playFleetAlarmSound } from '../engine/audio';
import { empLight } from '../procedural/meshes';
import { FleetShip, FleetProjectile, PlanetEntry, FactionId, SpaceStation } from '../types/game';
import { getFaction } from './factions';
import { generateProceduralCandidates } from './crew-generation';
import { collapseQuantumCivilization } from '../procedural/quantum-civ';

let shockwaveMesh: THREE.Mesh | null = null;
let shockwaveTimer = 0;

export const initPlanetDefenseFleets = spawnSystemFleet;

export function spawnSystemFleet(planetsInput?: any) {
    clearFleet();

    let planets: PlanetEntry[] = [];
    if (planetsInput && Array.isArray(planetsInput) && planetsInput.length > 0) {
        planets = planetsInput;
    } else if (activePlanets && activePlanets.length > 0) {
        planets = activePlanets;
    } else if (STATE.universe && STATE.universe.systems) {
        const activeSys = STATE.universe.systems.find(s => s.id === STATE.currentSystemId) || STATE.universe.systems[STATE.currentSystemId];
        if (activeSys && activeSys.planets) {
            planets = activeSys.planets as any;
        }
    }

    if (!planets || planets.length === 0) return;

    planets.forEach((p: PlanetEntry) => {
        if (p.isMoon) return;
        const species = (p.attributes && p.attributes.species) || p.species;
        if (!species || !species.population || species.population <= 0) return;

        // If techLevel is missing, deterministically derive it via Quantum Civ
        if (!species.techLevel) {
            const seed = (p.name || 'Planet').split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) + STATE.currentSystemId;
            const qCiv = collapseQuantumCivilization(STATE.currentSystemId, 0, seed);
            species.techLevel = qCiv.quantumTechLevel;
            species.defenseRating = qCiv.quantumTechLevel === 'Primitive' ? 0 : (qCiv.quantumTechLevel === 'Industrial' ? 20 : (qCiv.quantumTechLevel === 'Spacefaring' ? 65 : 95));
            species.fleetDisposition = qCiv.militaryDoctrine === 'Militaristic' ? 'Militaristic' : (qCiv.militaryDoctrine === 'Pacifist' ? 'Pacifist' : 'Defensive');
            species.factionId = species.factionId || qCiv.factionId;
        }

        const tech = species.techLevel;

        if (tech === 'Spacefaring' || tech === 'Hyper-Advanced' || tech === 'Industrial') {
            const shipCount = tech === 'Hyper-Advanced' ? 3 : (tech === 'Spacefaring' ? 2 : 1);

            for (let i = 0; i < shipCount; i++) {
                const isCorvette = i === 0 && tech !== 'Industrial';
                const shipGroup = new THREE.Group();

                // Geometry & Aesthetics
                const length = isCorvette ? 2.4 : 1.6;
                const width = isCorvette ? 1.4 : 1.0;
                const height = isCorvette ? 0.8 : 0.5;

                const geo = new THREE.ConeGeometry(width, length, 5);
                geo.rotateZ(-Math.PI / 2); // Point forward (+X)
                geo.scale(1.0, height / width, 1.0);

                const origColor = isCorvette ? 0xe11d48 : 0x38bdf8;
                const origEmissive = isCorvette ? 0x881337 : 0x0369a1;

                const mat = new THREE.MeshStandardMaterial({
                    color: origColor,
                    emissive: origEmissive,
                    emissiveIntensity: 0.8,
                    roughness: 0.25,
                    metalness: 0.85
                });

                const bodyMesh = new THREE.Mesh(geo, mat);
                shipGroup.add(bodyMesh);

                // Initial Orbital Placement around Planet
                const pSize = p.size || 5.0;
                const orbitRadius = pSize + 4.0 + i * 2.5;
                const orbitAngle = (i * (Math.PI * 2 / shipCount)) + Math.random() * 0.5;

                const planetX = p.mesh ? p.mesh.position.x : 0;
                const planetZ = p.mesh ? p.mesh.position.z : 0;

                shipGroup.position.set(
                    planetX + Math.cos(orbitAngle) * orbitRadius,
                    0,
                    planetZ + Math.sin(orbitAngle) * orbitRadius
                );

                scene.add(shipGroup);

                const species = (p.attributes && p.attributes.species) || (p as any).species;
                const factionId: FactionId = (species?.factionId as FactionId) || 'free_traders';
                const faction = getFaction(factionId);
                const civName = species?.name || faction.name;

                const shipSeed = ((p.name || 'Orb').charCodeAt(0) * 100 + i * 37 + (isCorvette ? 77 : 13)) >>> 0;
                const crewCount = isCorvette ? 3 : 1;
                const shipCrew = generateProceduralCandidates(shipSeed, crewCount);
                const commander = shipCrew[0];
                if (commander) {
                    commander.thought = isCorvette
                        ? "Waffen und Schilde auf Bereitschaft. Halte Sektor-Patrouille."
                        : "Jäger-Avionik kalibriert. Achte auf unidentifizierte Bio-Signaturen.";
                }

                const fleetShip: FleetShip = {
                    id: Date.now() + Math.random(),
                    mesh: shipGroup,
                    bodyMesh: bodyMesh,
                    type: isCorvette ? 'corvette' : 'interceptor',
                    name: `${isCorvette ? 'Schwere Korvette' : 'Abfangjäger'} ${(p.name || 'Orb').substring(0, 4)}-${i + 1}`,
                    position: shipGroup.position,
                    velocity: new THREE.Vector3(0, 0, 0),
                    homePlanet: p,
                    orbitRadius: orbitRadius,
                    orbitAngle: orbitAngle,
                    orbitSpeed: (0.45 / Math.sqrt(orbitRadius)) * (i % 2 === 0 ? 1 : -1),
                    health: isCorvette ? 80 : 35,
                    maxHealth: isCorvette ? 80 : 35,
                    state: 'patrol',
                    originalColor: origColor,
                    attackCooldown: 0.5 + Math.random() * 1.5,
                    alertTimer: 0,
                    factionId,
                    civilizationName: civName,
                    factionName: faction.shortName,
                    scanned: false,
                    crewMembers: shipCrew,
                    commanderName: commander ? `${commander.name} (${commander.roleName || commander.role})` : (isCorvette ? 'Korvetten-Kommandant' : 'Abfangpilot'),
                    commanderRole: commander ? commander.role : 'pilot',
                    commanderThought: commander?.thought
                };

                STATE.fleetShips.push(fleetShip);
            }

            // Spawn Civilian Freighters on Active Trade Routes
            const freighterGroup = new THREE.Group();
            const hullGeo = new THREE.BoxGeometry(3.0, 1.2, 1.4);
            const hullMat = new THREE.MeshStandardMaterial({
                color: 0xd97706,
                roughness: 0.45,
                metalness: 0.75,
                emissive: 0x78350f,
                emissiveIntensity: 0.3
            });
            const freighterMesh = new THREE.Mesh(hullGeo, hullMat);
            freighterGroup.add(freighterMesh);

            const podGeo = new THREE.BoxGeometry(1.6, 0.7, 1.5);
            const podMat = new THREE.MeshStandardMaterial({
                color: 0x0284c7,
                emissive: 0x0369a1,
                emissiveIntensity: 0.4,
                metalness: 0.8
            });
            const podMesh = new THREE.Mesh(podGeo, podMat);
            podMesh.position.set(0, 0.65, 0);
            freighterGroup.add(podMesh);

            const engGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.6, 8);
            engGeo.rotateZ(Math.PI / 2);
            const engMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
            const engMesh = new THREE.Mesh(engGeo, engMat);
            engMesh.position.set(-1.6, 0, 0);
            freighterGroup.add(engMesh);

            const pSize = p.size || 5.0;
            const routeRadius = pSize * 2.2 + 9.0;
            const routeAngle = Math.random() * Math.PI * 2;

            const planetX = p.mesh ? p.mesh.position.x : 0;
            const planetZ = p.mesh ? p.mesh.position.z : 0;

            freighterGroup.position.set(
                planetX + Math.cos(routeAngle) * routeRadius,
                0,
                planetZ + Math.sin(routeAngle) * routeRadius
            );

            scene.add(freighterGroup);

            const species = (p.attributes && p.attributes.species) || (p as any).species;
            const fFactionId: FactionId = (species?.factionId as FactionId) || 'free_traders';
            const fFaction = getFaction(fFactionId);
            const fCivName = species?.name || fFaction.name;

            const freightSeed = ((p.name || 'Freight').charCodeAt(0) * 150 + Math.floor(Math.random() * 50)) >>> 0;
            const freighterCrew = generateProceduralCandidates(freightSeed, 2);
            const fCommander = freighterCrew[0];
            if (fCommander) {
                fCommander.thought = "Überwacht die Frachtbehälter... 'Hoffentlich keine Sternenfresser oder Piraten.'";
            }

            const freighter: FleetShip = {
                id: Date.now() + Math.random() + 500,
                mesh: freighterGroup,
                bodyMesh: freighterMesh,
                type: 'freighter',
                name: `Handels-Frachter ${(p.name || 'Orb').substring(0, 4)}-${Math.floor(Math.random() * 89 + 10)}`,
                position: freighterGroup.position,
                velocity: new THREE.Vector3(0, 0, 0),
                homePlanet: p,
                orbitRadius: routeRadius,
                orbitAngle: routeAngle,
                orbitSpeed: 0.14,
                health: 45,
                maxHealth: 45,
                state: 'trade_cruise',
                originalColor: 0xd97706,
                attackCooldown: 999,
                alertTimer: 0,
                cargo: {
                    type: (['silicon', 'water', 'alloys', 'tech', 'food', 'passengers'][Math.floor(Math.random() * 6)]) as any,
                    amount: Math.floor(40 + Math.random() * 45)
                },
                factionId: fFactionId,
                civilizationName: fCivName,
                factionName: fFaction.shortName,
                scanned: false,
                crewMembers: freighterCrew,
                commanderName: fCommander ? `${fCommander.name} (${fCommander.roleName || fCommander.role})` : 'Frachtkapitän',
                commanderRole: fCommander ? fCommander.role : 'engineer',
                commanderThought: fCommander?.thought
            };

            assignNextTradeDestination(freighter);
            STATE.fleetShips.push(freighter);
        }
    });

    if (STATE.fleetShips.length > 0) {
        addLogEntry("SYSTEM", `Sensoren geortet: ${STATE.fleetShips.length} planetare Schiffe (Jäger & Handels-Konvois) im Sektor aktiv.`);
    }
}

export function assignNextTradeDestination(ship: FleetShip) {
    const candidates: { type: 'station' | 'planet'; target: any }[] = [];

    // 1. Space Stations (excluding current station target)
    if (STATE.spaceStations && STATE.spaceStations.length > 0) {
        STATE.spaceStations.forEach(s => {
            if (s !== ship.tradeTargetStation && s.mesh) {
                candidates.push({ type: 'station', target: s });
            }
        });
    }

    // 2. Planets in activePlanets (excluding current planet target)
    const planetList = activePlanets && activePlanets.length > 0 ? activePlanets : [];
    if (planetList.length > 0) {
        const otherPlanets = planetList.filter(p => !p.isMoon && p !== ship.tradeTargetPlanet && p !== ship.homePlanet && p.mesh);
        if (otherPlanets.length > 0) {
            otherPlanets.forEach(p => candidates.push({ type: 'planet', target: p }));
        } else if (ship.tradeTargetPlanet !== ship.homePlanet && ship.homePlanet?.mesh) {
            candidates.push({ type: 'planet', target: ship.homePlanet });
        }
    }

    if (candidates.length > 0) {
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        if (chosen.type === 'station') {
            ship.tradeTargetStation = chosen.target;
            ship.tradeTargetPlanet = null;
        } else {
            ship.tradeTargetPlanet = chosen.target;
            ship.tradeTargetStation = null;
        }
    } else {
        ship.tradeTargetPlanet = ship.homePlanet;
        ship.tradeTargetStation = null;
    }
}

export function updateFleet(dt: number) {
    // 1. Update Bio-Discharge Cooldown & Charging Phase
    if (STATE.bioDischargeCooldown > 0) {
        STATE.bioDischargeCooldown = Math.max(0, STATE.bioDischargeCooldown - dt);
    }

    if (STATE.empCharging) {
        STATE.empChargeTimer = (STATE.empChargeTimer || 0) - dt;
        if (empLight) {
            empLight.intensity = Math.sin(Date.now() * 0.04) * 3.5 + 2.0;
        }
        if (STATE.empChargeTimer <= 0) {
            STATE.empCharging = false;
            dischargeEmpShockwave();
        }
    }

    updateEmpHUD();

    // 2. System-wide Fleet Alert Management
    if (STATE.systemAlertLevel === 'hunt') {
        if (STATE.stealthActive) {
            // Najmafar is cloaked: alert timer counts down
            STATE.systemAlertTimer = Math.max(0, (STATE.systemAlertTimer || 0) - dt);
            if (STATE.systemAlertTimer <= 0) {
                STATE.systemAlertLevel = 'peace';
                addLogEntry("SYSTEM", "Flottenalarm aufgehoben – Ziel-Biosignatur vollständig im Vakuum verblasst.");
            }
        } else {
            // Najmafar is uncloaked: alert stays active across the entire system!
            STATE.systemAlertTimer = Math.max(STATE.systemAlertTimer || 0, 30.0);
        }
    }

    // 2. Continuous Shockwave Expansion & Hit Detection
    if (shockwaveMesh && shockwaveTimer > 0) {
        shockwaveTimer -= dt;
        const totalDuration = 0.6;
        const progress = Math.min(1.0, 1.0 - (shockwaveTimer / totalDuration));
        const maxRadius = 28.0;
        const currentRadius = 2.0 + progress * maxRadius;

        shockwaveMesh.scale.set(currentRadius, 1, currentRadius);
        (shockwaveMesh.material as THREE.Material).opacity = (1.0 - progress) * 0.9;

        const shockOrigin = shockwaveMesh.position;
        let newlyStunned = 0;

        STATE.fleetShips.forEach(ship => {
            if (ship.state !== 'disabled' && ship.state !== 'stunned') {
                const distToShock = ship.position.distanceTo(shockOrigin);
                if (distToShock <= currentRadius + 3.0) {
                    const isCoreHit = distToShock <= 13.0;
                    ship.state = 'stunned';
                    ship.stunMaxDuration = isCoreHit ? 5.5 : 2.5;
                    ship.stunTimer = ship.stunMaxDuration;
                    ship.health = Math.max(1, ship.health - (isCoreHit ? 25 : 10));

                    const pushDir = new THREE.Vector3().subVectors(ship.position, shockOrigin).normalize();
                    ship.velocity.copy(pushDir.multiplyScalar(isCoreHit ? 15 : 9));

                    (ship.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0x334155);
                    (ship.bodyMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x06b6d4);

                    newlyStunned++;
                }
            }
        });

        if (newlyStunned > 0) {
            playCrashSound();
            addLogEntry("CREW", `Capt. Miller: 'EMP hat ${newlyStunned} Schiffe erfasst! Systeme für 5s überlastet – jetzt assimilieren [E]!'`);
        }

        // Destroy hostile projectiles caught in shockwave
        for (let i = STATE.fleetProjectiles.length - 1; i >= 0; i--) {
            const proj = STATE.fleetProjectiles[i];
            if (proj.position.distanceTo(shockOrigin) <= currentRadius + 2.5) {
                scene.remove(proj.mesh);
                proj.mesh.geometry.dispose();
                (proj.mesh.material as THREE.Material).dispose();
                STATE.fleetProjectiles.splice(i, 1);
            }
        }

        if (shockwaveTimer <= 0) {
            scene.remove(shockwaveMesh);
            shockwaveMesh.geometry.dispose();
            (shockwaveMesh.material as THREE.Material).dispose();
            shockwaveMesh = null;
        }
    }

    const playerPos = STATE.playerPosition;

    // 3. Update Fleet Ships AI & Stun Timers
    STATE.fleetShips.forEach(ship => {
        if (ship.state === 'disabled') {
            ship.position.addScaledVector(ship.velocity, dt);
            ship.velocity.multiplyScalar(Math.exp(-0.8 * dt));
            ship.mesh.rotation.y += 0.8 * dt;
            ship.mesh.rotation.z += 0.5 * dt;
            return;
        }

        if (ship.state === 'stunned') {
            ship.stunTimer = (ship.stunTimer || 0) - dt;
            ship.position.addScaledVector(ship.velocity, dt);
            ship.velocity.multiplyScalar(Math.exp(-1.4 * dt));
            ship.mesh.rotation.y += 1.2 * dt;
            ship.mesh.rotation.z += 0.6 * dt;

            // Sparkle / electrical discharge flicker
            const flicker = Math.sin(Date.now() * 0.04) > 0 ? 0x06b6d4 : 0x000000;
            (ship.bodyMesh.material as THREE.MeshStandardMaterial).emissive.setHex(flicker);

            if (ship.stunTimer <= 0) {
                // Systems reboot!
                ship.state = 'intercept';
                const origCol = ship.originalColor || (ship.type === 'corvette' ? 0xe11d48 : 0x38bdf8);
                const origEm = ship.type === 'corvette' ? 0x881337 : 0x0369a1;
                (ship.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(origCol);
                (ship.bodyMesh.material as THREE.MeshStandardMaterial).emissive.setHex(origEm);
                addLogEntry("SYSTEM", `⚠️ SYSTEM-NEUSTART: ${ship.name} hat Triebwerke reaktiviert!`);
            }
            return;
        }

        const planetPos = (ship.homePlanet && ship.homePlanet.mesh)
            ? ship.homePlanet.mesh.position
            : (ship.homePlanet?.source?.position || new THREE.Vector3(0, 0, 0));
        const distToPlayer = ship.position.distanceTo(playerPos);
        const distPlanetToPlayer = planetPos.distanceTo(playerPos);

        // 1. Returning to Orbit State (Physics-driven cruise back home, NO rubber-banding / yo-yo!)
        if (ship.state === 'returning') {
            const isMilitary = ship.type === 'interceptor' || ship.type === 'corvette';

            // Military ships immediately re-engage if uncamouflaged player threatens again
            if (isMilitary && !STATE.stealthActive && (STATE.systemAlertLevel === 'hunt' || distToPlayer < 45.0)) {
                ship.state = 'hunt';
                ship.alertTimer = 35.0;
                addLogEntry("SYSTEM", `${ship.name}: 'Ziel wieder im Radar! Setze Abfangkurs erneut an!'`);
            } else {
                const toPlanet = new THREE.Vector3().subVectors(planetPos, ship.position);
                const distToPlanet = toPlanet.length();
                const cruiseSpeed = isMilitary ? (ship.type === 'corvette' ? 24.0 : 32.0) : 14.0;
                const cruiseDir = toPlanet.clone().normalize();

                // Smoothly accelerate towards home planet
                ship.velocity.lerp(cruiseDir.multiplyScalar(cruiseSpeed), 3.0 * dt);
                ship.position.addScaledVector(ship.velocity, dt);

                if (ship.velocity.lengthSq() > 0.1) {
                    ship.mesh.rotation.y = Math.atan2(ship.velocity.x, ship.velocity.z);
                }

                // Check orbital insertion: smooth entry into circular orbit
                if (distToPlanet <= ship.orbitRadius + 2.5) {
                    // Synchronize orbit angle exactly to insertion point
                    ship.orbitAngle = Math.atan2(ship.position.z - planetPos.z, ship.position.x - planetPos.x);
                    ship.velocity.set(0, 0, 0);

                    if (isMilitary) {
                        ship.state = 'patrol';
                        addLogEntry("SYSTEM", `${ship.name} hat Heimat-Orbit um ${ship.homePlanet.name} erreicht.`);
                    } else {
                        ship.state = 'trade_cruise';
                    }
                }
                return;
            }
        }

        // 2. Freighter Trade Cruise, Docking & Flee AI
        if (ship.type === 'freighter' || ship.type === 'heavy_freighter') {
            // Uncamouflaged proximity panic check (triggers in cruise, docking, or returning)
            if (distToPlayer < 28.0 && !STATE.stealthActive && ship.state !== 'flee' && (ship.state as any) !== 'stunned' && (ship.state as any) !== 'disabled') {
                ship.state = 'flee';
                playFleetAlarmSound();
                addLogEntry("SYSTEM", `🚨 NOTRUF: Ziviler Frachter ${ship.name} meldet ungetarnten Leviathan! Fordert Geleitschutz an!`);
                STATE.systemAlertLevel = 'hunt';
                STATE.systemAlertTimer = 40.0;
                if (ship.crewMembers && ship.crewMembers[0]) {
                    ship.crewMembers[0].thought = "ALARM! Ungetarnte Bio-Entität auf Abfangkurs! Volle Notfall-Beschleunigung!";
                    ship.commanderThought = ship.crewMembers[0].thought;
                }
            }

            if (ship.state === 'trade_cruise') {
                // Determine destination coordinates
                let destPos: THREE.Vector3 | null = null;
                let destName = 'Handels-Station';

                if (ship.tradeTargetStation && (ship.tradeTargetStation.mesh || ship.tradeTargetStation.position)) {
                    destPos = ship.tradeTargetStation.mesh ? ship.tradeTargetStation.mesh.position : ship.tradeTargetStation.position;
                    destName = ship.tradeTargetStation.name;
                } else if (ship.tradeTargetPlanet && (ship.tradeTargetPlanet.mesh || (ship.tradeTargetPlanet.source && ship.tradeTargetPlanet.source.position))) {
                    destPos = ship.tradeTargetPlanet.mesh ? ship.tradeTargetPlanet.mesh.position : ship.tradeTargetPlanet.source.position;
                    destName = ship.tradeTargetPlanet.name;
                } else {
                    assignNextTradeDestination(ship);
                    if (ship.tradeTargetStation && ship.tradeTargetStation.mesh) {
                        destPos = ship.tradeTargetStation.mesh.position;
                        destName = ship.tradeTargetStation.name;
                    } else if (ship.tradeTargetPlanet && ship.tradeTargetPlanet.mesh) {
                        destPos = ship.tradeTargetPlanet.mesh.position;
                        destName = ship.tradeTargetPlanet.name;
                    }
                }

                if (!destPos) {
                    destPos = planetPos;
                }

                const toDest = new THREE.Vector3().subVectors(destPos, ship.position);
                const distToDest = toDest.length();

                // Dynamic sub-light cruise flight across interplanetary space!
                const cruiseSpeed = 16.0;
                const cruiseDir = toDest.clone().normalize();

                ship.velocity.lerp(cruiseDir.multiplyScalar(cruiseSpeed), Math.min(1.0, 3.5 * dt));
                ship.position.addScaledVector(ship.velocity, dt);

                if (ship.velocity.lengthSq() > 0.1) {
                    ship.mesh.rotation.y = Math.atan2(ship.velocity.x, ship.velocity.z);
                }

                // Check for arrival & docking at destination
                const arrivalDist = ship.tradeTargetStation ? 12.0 : ((ship.tradeTargetPlanet?.size || 5.0) + 7.0);
                if (distToDest <= arrivalDist) {
                    ship.state = 'trade_docked';
                    ship.dockTimer = 10.0 + Math.random() * 8.0;
                    ship.velocity.set(0, 0, 0);
                    if (ship.crewMembers && ship.crewMembers[0]) {
                        ship.crewMembers[0].thought = `Docking an ${destName} bestätigt. Frachtkräne entladen ${ship.cargo?.amount || 65}x ${ship.cargo?.type === 'silicon' ? 'Silizium' : 'Biomasse'}.`;
                        ship.commanderThought = ship.crewMembers[0].thought;
                    }
                }
            } else if (ship.state === 'trade_docked') {
                ship.dockTimer = (ship.dockTimer || 0) - dt;

                // Determine dock center position
                let dockCenter = planetPos;
                if (ship.tradeTargetStation && (ship.tradeTargetStation.mesh || ship.tradeTargetStation.position)) {
                    dockCenter = ship.tradeTargetStation.mesh ? ship.tradeTargetStation.mesh.position : ship.tradeTargetStation.position;
                } else if (ship.tradeTargetPlanet && (ship.tradeTargetPlanet.mesh || ship.tradeTargetPlanet.source?.position)) {
                    dockCenter = ship.tradeTargetPlanet.mesh ? ship.tradeTargetPlanet.mesh.position : ship.tradeTargetPlanet.source.position;
                }

                // Slow gentle orbit around dock during cargo handling
                ship.orbitAngle = (ship.orbitAngle || 0) + 0.15 * dt;
                const dockOrbitRadius = 8.5;
                ship.position.set(
                    dockCenter.x + Math.cos(ship.orbitAngle) * dockOrbitRadius,
                    0,
                    dockCenter.z + Math.sin(ship.orbitAngle) * dockOrbitRadius
                );
                const tangX = -Math.sin(ship.orbitAngle);
                const tangZ = Math.cos(ship.orbitAngle);
                ship.mesh.rotation.y = Math.atan2(tangX, tangZ);

                if (ship.dockTimer <= 0) {
                    // Cargo exchange complete
                    const cargoChoices: ('silicon' | 'water' | 'alloys' | 'tech' | 'food' | 'passengers')[] = [
                        'silicon', 'water', 'alloys', 'tech', 'food', 'passengers'
                    ];
                    const newType = cargoChoices[Math.floor(Math.random() * cargoChoices.length)];
                    const newAmount = newType === 'passengers' ? Math.floor(4 + Math.random() * 5) : Math.floor(40 + Math.random() * 45);
                    ship.cargo = { type: newType, amount: newAmount };

                    // Route to next port
                    assignNextTradeDestination(ship);
                    const nextDestName = ship.tradeTargetStation?.name || ship.tradeTargetPlanet?.name || 'Handels-Station';
                    if (ship.crewMembers && ship.crewMembers[0]) {
                        ship.crewMembers[0].thought = `Ladevorgang beendet. Fracht manifestiert (${newAmount}x ${newType}). Setze Kurs auf ${nextDestName}.`;
                        ship.commanderThought = ship.crewMembers[0].thought;
                    }
                    ship.state = 'trade_cruise';
                }
            } else if (ship.state === 'flee') {
                // Accelerate directly away from Najmafar
                const awayDir = new THREE.Vector3().subVectors(ship.position, playerPos).normalize();
                ship.velocity.addScaledVector(awayDir, 32.0 * dt);
                ship.velocity.clampLength(0, 24.0);
                ship.position.addScaledVector(ship.velocity, dt);

                if (ship.velocity.lengthSq() > 0.1) {
                    ship.mesh.rotation.y = Math.atan2(ship.velocity.x, ship.velocity.z);
                }

                // If player is far away or camouflaged, stop fleeing and resume trade route
                if (distToPlayer > 60.0 || STATE.stealthActive) {
                    ship.state = 'trade_cruise';
                    addLogEntry("SYSTEM", `${ship.name}: 'Gefahr abgewendet. Kehre auf Handelsroute zurück.'`);
                    if (ship.crewMembers && ship.crewMembers[0]) {
                        ship.crewMembers[0].thought = "Bedrohung verloren. Triebwerke stabilisiert – setzen Transit-Route fort.";
                        ship.commanderThought = ship.crewMembers[0].thought;
                    }
                }
            }
            return;
        }

        // 3. Military Combat Ships (Interceptors & Corvettes)
        // System-wide Hunt Response: uncloaked Najmafar draws all military ships across the entire system!
        if (STATE.systemAlertLevel === 'hunt' && (ship.state === 'patrol' || (ship.state as any) === 'returning')) {
            if (!STATE.stealthActive) {
                ship.state = 'hunt';
                ship.alertTimer = 35.0;
            }
        }

        // Local Incursion Detection around civilized planet
        const isPlayerThreatening = !STATE.stealthActive && (
            distPlanetToPlayer < 40.0 ||
            (STATE.scanningPlanet && STATE.scanningPlanet.name === ship.homePlanet.name) ||
            (STATE.abductActive && STATE.abductTarget && STATE.abductTarget.name === ship.homePlanet.name)
        );

        if (isPlayerThreatening && ship.state === 'patrol') {
            ship.state = 'intercept';
            ship.alertTimer = 30.0;
            addLogEntry("CREW", `Capt. Miller: 'Militärische Abfangjäger von ${ship.homePlanet.name} formieren Abfangkurs!'`);
        }

        // Hostile Pursuit & Combat (Hunt / Intercept)
        if (ship.state === 'hunt' || ship.state === 'intercept') {
            // If in intercept and player moves outside local perimeter without cloaking,
            // upgrade to system-wide hunt!
            if (!STATE.stealthActive && ship.state === 'intercept' && distToPlayer > 40.0) {
                ship.state = 'hunt';
                STATE.systemAlertLevel = 'hunt';
                STATE.systemAlertTimer = 40.0;
                addLogEntry("SYSTEM", `${ship.name}: 'Ziel flieht – leite systemweite Langstrecken-Jagd ein!'`);
            }

            // Uncamouflaged: refresh alert and keep tracking across the ENTIRE system!
            if (!STATE.stealthActive) {
                ship.alertTimer = Math.max(ship.alertTimer, 25.0);
            } else {
                // Cloaking active: break radar lock and search window decays
                ship.alertTimer -= dt * 2.0;
                if (ship.alertTimer <= 0) {
                    ship.state = 'returning';
                    addLogEntry("SYSTEM", `${ship.name}: 'Ziel-Signatur verloren (Sensor-Ghost)... breche Jagd ab und kehre zur Basis zurück.'`);
                    return;
                }
            }

            const toPlayer = new THREE.Vector3().subVectors(playerPos, ship.position);
            const dist = toPlayer.length();
            const dirToPlayer = toPlayer.clone().normalize();

            const isCorvette = ship.type === 'corvette';
            const maxCombatSpeed = isCorvette ? 26.0 : 36.0;
            const maxPursuitSpeed = isCorvette ? 36.0 : 48.0;

            const accel = new THREE.Vector3();

            if (dist > 30.0) {
                // Long-range pursuit: direct thrust towards Najmafar with interceptor speed!
                accel.addScaledVector(dirToPlayer, 42.0);
                ship.velocity.addScaledVector(accel, dt);
                ship.velocity.clampLength(0, maxPursuitSpeed);
            } else {
                // Close dogfight range: tactical circle, strafe and weapon fire
                const desiredDist = isCorvette ? 13.0 : 9.0;
                const distDiff = dist - desiredDist;
                const tangent = new THREE.Vector3(-dirToPlayer.z, 0, dirToPlayer.x);

                accel.addScaledVector(dirToPlayer, Math.min(32, distDiff * 4.0));
                accel.addScaledVector(tangent, 16.0);

                ship.velocity.addScaledVector(accel, dt);
                ship.velocity.clampLength(0, maxCombatSpeed);
            }

            ship.velocity.multiplyScalar(Math.exp(-0.35 * dt));
            ship.position.addScaledVector(ship.velocity, dt);

            if (ship.velocity.lengthSq() > 0.1) {
                ship.mesh.rotation.y = Math.atan2(ship.velocity.x, ship.velocity.z);
            }

            // Weapon Fire
            ship.attackCooldown -= dt;
            if (ship.attackCooldown <= 0 && dist < 32.0 && !STATE.stealthActive) {
                ship.attackCooldown = isCorvette ? 1.3 : 1.7;
                fireFleetProjectile(ship, playerPos);
            }
        } else {
            // 4. Stable Circular Patrol Orbit (NO LERP, seamless rotation around parent planet!)
            ship.orbitAngle += ship.orbitSpeed * dt;
            ship.position.set(
                planetPos.x + Math.cos(ship.orbitAngle) * ship.orbitRadius,
                0,
                planetPos.z + Math.sin(ship.orbitAngle) * ship.orbitRadius
            );

            const tangentX = -Math.sin(ship.orbitAngle) * (ship.orbitSpeed >= 0 ? 1 : -1);
            const tangentZ = Math.cos(ship.orbitAngle) * (ship.orbitSpeed >= 0 ? 1 : -1);
            ship.mesh.rotation.y = Math.atan2(tangentX, tangentZ);
        }
    });

    // 4. Update Projectiles
    for (let i = STATE.fleetProjectiles.length - 1; i >= 0; i--) {
        const proj = STATE.fleetProjectiles[i];
        proj.life -= dt;
        proj.position.addScaledVector(proj.velocity, dt);

        const distToPlayer = proj.position.distanceTo(playerPos);
        if (distToPlayer < 2.8) {
            STATE.health = Math.max(0, STATE.health - proj.damage);
            STATE.crew.forEach(c => c.stress = Math.min(100, c.stress + 3.0));
            playCrashSound();
            addLogEntry("CREW", `⚠️ TREFFER! Hüllenschaden erlitten (-${proj.damage} HP)!`);

            scene.remove(proj.mesh);
            proj.mesh.geometry.dispose();
            (proj.mesh.material as THREE.Material).dispose();
            STATE.fleetProjectiles.splice(i, 1);
            continue;
        }

        if (proj.life <= 0) {
            scene.remove(proj.mesh);
            proj.mesh.geometry.dispose();
            (proj.mesh.material as THREE.Material).dispose();
            STATE.fleetProjectiles.splice(i, 1);
        }
    }
}

function fireFleetProjectile(ship: FleetShip, targetPos: THREE.Vector3) {
    const isCorvette = ship.type === 'corvette';
    const projGeo = new THREE.SphereGeometry(isCorvette ? 0.35 : 0.2, 8, 8);
    const projMat = new THREE.MeshBasicMaterial({
        color: isCorvette ? 0xf43f5e : 0x38bdf8
    });

    const projMesh = new THREE.Mesh(projGeo, projMat);
    projMesh.position.copy(ship.position);
    scene.add(projMesh);

    const dir = new THREE.Vector3().subVectors(targetPos, ship.position).normalize();
    const speed = isCorvette ? 42.0 : 54.0;
    const velocity = dir.clone().multiplyScalar(speed);

    projMesh.rotation.y = Math.atan2(dir.x, dir.z);

    const projectile: FleetProjectile = {
        mesh: projMesh,
        position: projMesh.position,
        velocity: velocity,
        life: 2.5,
        damage: isCorvette ? 14 : 7,
        type: isCorvette ? 'emp' : 'laser'
    };

    STATE.fleetProjectiles.push(projectile);
}

// Live EMP Cooldown and Ability UI Feedback
export function updateEmpHUD() {
    const btn = document.getElementById('trigger-emp-btn');
    const badge = document.getElementById('emp-status-badge');
    const bar = document.getElementById('emp-bar-fill');
    if (!btn || !badge || !bar) return;

    if (STATE.empCharging) {
        bar.style.width = `${Math.round(((0.45 - (STATE.empChargeTimer || 0)) / 0.45) * 100)}%`;
        badge.innerText = '⚡ LÄDT...';
        badge.className = 'emp-status-badge cooling';
        btn.className = 'emp-action-btn ready';
    } else if (STATE.bioDischargeCooldown > 0) {
        const totalCd = 4.0;
        const progress = Math.max(0, Math.min(1.0, 1.0 - (STATE.bioDischargeCooldown / totalCd)));
        bar.style.width = `${Math.round(progress * 100)}%`;
        badge.innerText = `${STATE.bioDischargeCooldown.toFixed(1)}s`;
        badge.className = 'emp-status-badge cooling';
        btn.className = 'emp-action-btn cooling-down';
    } else {
        bar.style.width = '100%';
        const hasRes = STATE.bioEnergy >= 15 && STATE.mentalEnergy >= 10;
        badge.innerText = hasRes ? 'BEREIT' : 'WENIG ENERGIE';
        badge.className = hasRes ? 'emp-status-badge' : 'emp-status-badge cooling';
        btn.className = hasRes ? 'emp-action-btn ready' : 'emp-action-btn cooling-down';
    }
}

// Player Action: Bio-Electric EMP Discharge (Key X / Gamepad X)
export function triggerBioDischarge() {
    if (!STATE.gameStarted || STATE.empCharging) return;

    if (STATE.bioDischargeCooldown > 0) {
        addLogEntry("SYSTEM", `Bio-Elektrische Entladung noch in Kalibrierung (${STATE.bioDischargeCooldown.toFixed(1)}s Cooldown).`);
        return;
    }

    if (STATE.bioEnergy < 15 || STATE.mentalEnergy < 10) {
        addLogEntry("SYSTEM", `Zu wenig Bio-Energie oder Mentalkraft für Bio-Elektrische Entladung (benötigt 15 Bio / 10 Psi)!`);
        return;
    }

    // Deduct Costs & Start 0.45s Charge Phase
    STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 15);
    STATE.mentalEnergy = Math.max(0, STATE.mentalEnergy - 10);
    STATE.empCharging = true;
    STATE.empChargeTimer = 0.45;

    playEmpChargeSound();
    addLogEntry("SYSTEM", `⚡ Bio-EMP Vorladung initiiert (0.4s Vorladung)...`);
}

function dischargeEmpShockwave() {
    STATE.bioDischargeCooldown = 4.0; // 4.0s balanced cooldown

    if (empLight) {
        empLight.intensity = 9.0;
    }

    if (shockwaveMesh) {
        scene.remove(shockwaveMesh);
        shockwaveMesh.geometry.dispose();
        (shockwaveMesh.material as THREE.Material).dispose();
    }

    const shockGeo = new THREE.RingGeometry(0.8, 1.8, 48);
    shockGeo.rotateX(Math.PI / 2);
    const shockMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    shockwaveMesh = new THREE.Mesh(shockGeo, shockMat);
    shockwaveMesh.position.copy(STATE.playerPosition);
    scene.add(shockwaveMesh);
    shockwaveTimer = 0.6;

    playCrashSound();
    addLogEntry("SYSTEM", `💥 BIO-ELEKTRISCHE SCHOCKWELLE ENTLADEN! Nahbereich lähmt Schiffe für 5s.`);
}

// Salvage disabled or stunned fleet wreck
export function salvageNearestWreck(): boolean {
    const playerPos = STATE.playerPosition;
    const targets = STATE.fleetShips.filter(s => s.state === 'disabled' || s.state === 'stunned');

    for (let i = 0; i < targets.length; i++) {
        const ship = targets[i];
        if (ship.position.distanceTo(playerPos) <= 8.5) {
            // Salvage successful!
            scene.remove(ship.mesh);

            const isFreighter = ship.type === 'freighter' || ship.type === 'heavy_freighter';
            if (isFreighter && ship.cargo) {
                const c = ship.cargo;
                if (c.type === 'passengers') {
                    const rescuedCount = c.amount || 4;
                    addLogEntry("SYSTEM", `💥 FRACHT-ASSIMILATION: ${rescuedCount} zivile Passagiere aus ${ship.name} gerettet & in Kokons aufgenommen!`);
                    for (let i = 0; i < rescuedCount && STATE.crew.length < STATE.maxCrewCapacity; i++) {
                        const cand = generateProceduralCandidates(Date.now() + i, 1)[0];
                        if (cand) {
                            STATE.crew.push(cand);
                            addLogEntry("CREW", `Überlebender Kolonist geborgen: ${cand.name} (${cand.roleName || cand.role})`);
                        }
                    }
                } else if (c.type === 'water') {
                    STATE.waterRes += c.amount;
                    addLogEntry("SYSTEM", `💥 FRACHT-ASSIMILATION: +${c.amount} Reinwasser / Volatiles aus ${ship.name} extrahiert!`);
                } else if (c.type === 'alloys') {
                    STATE.alloyRes += c.amount;
                    addLogEntry("SYSTEM", `💥 FRACHT-ASSIMILATION: +${c.amount} Titan- & Rumpflegierungen aus ${ship.name} geborgen!`);
                } else if (c.type === 'tech') {
                    STATE.techRes += c.amount;
                    addLogEntry("SYSTEM", `💥 FRACHT-ASSIMILATION: +${c.amount} Hyper-Technologie & Quanten-Prozessoren gesichert!`);
                } else if (c.type === 'food') {
                    STATE.foodRes += c.amount;
                    addLogEntry("SYSTEM", `💥 FRACHT-ASSIMILATION: +${c.amount} Nährstoff-Gel & Rationen geborgen!`);
                } else if (c.type === 'silicon') {
                    STATE.siliconRes += c.amount;
                    addLogEntry("SYSTEM", `💥 FRACHT-ASSIMILATION: +${c.amount} Silizium-Kristalle aus ${ship.name} geborgen!`);
                } else {
                    STATE.bioRes += c.amount;
                    addLogEntry("SYSTEM", `💥 FRACHT-ASSIMILATION: +${c.amount} Biomasse aus ${ship.name} assimiliert!`);
                }
                STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 30);
            } else {
                const silBonus = isFreighter ? 65 : 35;
                const bioBonus = isFreighter ? 45 : 30;
                STATE.siliconRes += silBonus;
                STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + bioBonus);
                addLogEntry("SYSTEM", `Schiff von ${ship.name} assimiliert: +${silBonus} Silizium & +${bioBonus} Bio-Energie gewonnen!`);
            }
            playSiliconCollectSound();

            const idx = STATE.fleetShips.findIndex(s => s.id === ship.id);
            if (idx !== -1) {
                STATE.fleetShips.splice(idx, 1);
            }
            return true;
        }
    }
    return false;
}

export function clearFleet() {
    STATE.fleetShips.forEach(ship => {
        if (ship.mesh) scene.remove(ship.mesh);
    });
    STATE.fleetProjectiles.forEach(proj => {
        if (proj.mesh) scene.remove(proj.mesh);
    });
    if (shockwaveMesh) {
        scene.remove(shockwaveMesh);
        shockwaveMesh = null;
    }
    STATE.fleetShips = [];
    STATE.fleetProjectiles = [];
}

/**
 * Triggered on interstellar arrival into a star system:
 * If the system hosts a Spacefaring or Hyper-Advanced civilization and
 * Najmafar arrives uncamouflaged, triggers an immediate system-wide red alert
 * and scrambles planetary defense squadrons to hunt Najmafar!
 */
export function handleSystemArrivalStealthCheck() {
    if (!STATE.universe) return;
    const activeSys = STATE.universe.systems.find(s => s.id === STATE.currentSystemId) || STATE.universe.systems[STATE.currentSystemId];
    if (!activeSys || !activeSys.planets) return;

    const hasAdvancedCiv = activeSys.planets.some(p => {
        const spec = p.species || ((p as any).attributes && (p as any).attributes.species);
        return spec && (spec.techLevel === 'Spacefaring' || spec.techLevel === 'Hyper-Advanced');
    });

    if (!hasAdvancedCiv) return;

    if (!STATE.stealthActive) {
        STATE.systemAlertLevel = 'hunt';
        STATE.systemAlertTimer = 45.0;
        playFleetAlarmSound();
        addLogEntry("SYSTEM", `🚨 SYSTEMWEITER ALARM: Orbital-Zitadelle hat ungetarnte Raumzeit-Faltung geortet! Jagdstaffeln starten!`);

        // Scramble all combat ships immediately into hunt mode
        STATE.fleetShips.forEach(s => {
            if (s.type === 'interceptor' || s.type === 'corvette') {
                s.state = 'hunt';
                s.alertTimer = 35.0;
            }
        });
    } else {
        STATE.systemAlertLevel = 'peace';
        addLogEntry("SYSTEM", `🤫 PSIONISCHER SCHLEIER AKTIV: Sensoren der Orbital-Zitadelle getäuscht. Systemverkehr ahnungslos.`);
    }
}
