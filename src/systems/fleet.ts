import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene } from '../engine/scene';
import { addLogEntry } from '../ui/hud';
import { playCrashSound, playSiliconCollectSound, playEmpChargeSound, playFleetAlarmSound } from '../engine/audio';
import { empLight } from '../procedural/meshes';
import { collapseQuantumCivilization } from '../procedural/quantum-civ';
import { FleetShip, FleetProjectile, PlanetEntry } from '../types/game';

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
            planets = activeSys.planets;
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
                    alertTimer: 0
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
                cargo: { type: 'silicon', amount: 65 }
            };

            STATE.fleetShips.push(freighter);
        }
    });

    if (STATE.fleetShips.length > 0) {
        addLogEntry("SYSTEM", `Sensoren geortet: ${STATE.fleetShips.length} planetare Schiffe (Jäger & Handels-Konvois) im Sektor aktiv.`);
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

        const planetPos = (ship.homePlanet && ship.homePlanet.mesh) ? ship.homePlanet.mesh.position : ship.position;
        const distToPlayer = ship.position.distanceTo(playerPos);
        const distPlanetToPlayer = planetPos.distanceTo(playerPos);

        // 1. Freighter Trade Cruise & Flee AI
        if (ship.type === 'freighter' || ship.type === 'heavy_freighter') {
            if (ship.state === 'trade_cruise') {
                ship.orbitAngle += ship.orbitSpeed * dt;
                const targetX = planetPos.x + Math.cos(ship.orbitAngle) * ship.orbitRadius;
                const targetZ = planetPos.z + Math.sin(ship.orbitAngle) * ship.orbitRadius;

                ship.position.x = THREE.MathUtils.lerp(ship.position.x, targetX, 0.05);
                ship.position.z = THREE.MathUtils.lerp(ship.position.z, targetZ, 0.05);

                const tangentX = -Math.sin(ship.orbitAngle);
                const tangentZ = Math.cos(ship.orbitAngle);
                ship.mesh.rotation.y = Math.atan2(tangentX, tangentZ);

                // Uncamouflaged proximity panic check
                if (distToPlayer < 28.0 && !STATE.stealthActive) {
                    ship.state = 'flee';
                    playFleetAlarmSound();
                    addLogEntry("SYSTEM", `🚨 NOTRUF: Ziviler Frachter ${ship.name} meldet ungetarnten Leviathan! Fordert Geleitschutz an!`);
                    STATE.systemAlertLevel = 'hunt';
                    STATE.systemAlertTimer = 35.0;
                }
            } else if (ship.state === 'flee') {
                // Accelerate directly away from Najmafar
                const awayDir = new THREE.Vector3().subVectors(ship.position, playerPos).normalize();
                ship.velocity.addScaledVector(awayDir, 30.0 * dt);
                ship.velocity.clampLength(0, 24.0);
                ship.position.addScaledVector(ship.velocity, dt);

                if (ship.velocity.lengthSq() > 0.1) {
                    ship.mesh.rotation.y = Math.atan2(ship.velocity.x, ship.velocity.z);
                }

                if (distToPlayer > 55.0) {
                    ship.state = 'trade_cruise';
                }
            }
            return;
        }

        // 2. Military Combat Ships (Interceptors & Corvettes)
        // System-wide Hunt Response
        if (STATE.systemAlertLevel === 'hunt' && ship.state === 'patrol') {
            if (!STATE.stealthActive) {
                ship.state = 'hunt';
                ship.alertTimer = 25.0;
            }
        }

        const isPlayerThreatening = !STATE.stealthActive && (
            distPlanetToPlayer < 35.0 ||
            (STATE.scanningPlanet && STATE.scanningPlanet.name === ship.homePlanet.name) ||
            (STATE.abductActive && STATE.abductTarget && STATE.abductTarget.name === ship.homePlanet.name)
        );

        if (isPlayerThreatening && ship.state === 'patrol') {
            ship.state = 'intercept';
            ship.alertTimer = 15.0;
            addLogEntry("CREW", `Capt. Miller: 'Militärische Abfangjäger von ${ship.homePlanet.name} formieren Abfangkurs!'`);
        }

        if (ship.state === 'hunt') {
            ship.alertTimer -= dt;

            // Cloaking breaks radar lock
            if (STATE.stealthActive) {
                ship.alertTimer -= dt * 2.0;
                if (ship.alertTimer <= 0) {
                    ship.state = 'patrol';
                    addLogEntry("SYSTEM", `${ship.name}: 'Ziel-Signatur verloren (Sensor-Ghost)... breche Jagd ab.'`);
                }
            }

            const toPlayer = new THREE.Vector3().subVectors(playerPos, ship.position);
            const dist = toPlayer.length();
            toPlayer.normalize();

            const pursuitSpeed = ship.type === 'corvette' ? 26.0 : 38.0;
            const desiredDist = 14.0;
            const distDiff = dist - desiredDist;
            const tangent = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
            const accel = new THREE.Vector3();

            accel.addScaledVector(toPlayer, Math.min(32, distDiff * 4.0));
            accel.addScaledVector(tangent, 15.0);

            ship.velocity.addScaledVector(accel, dt);
            ship.velocity.clampLength(0, pursuitSpeed);
            ship.velocity.multiplyScalar(Math.exp(-0.35 * dt));

            ship.position.addScaledVector(ship.velocity, dt);

            if (ship.velocity.lengthSq() > 0.1) {
                ship.mesh.rotation.y = Math.atan2(ship.velocity.x, ship.velocity.z);
            }

            ship.attackCooldown -= dt;
            if (ship.attackCooldown <= 0 && dist < 32.0 && !STATE.stealthActive) {
                ship.attackCooldown = ship.type === 'corvette' ? 1.2 : 1.6;
                fireFleetProjectile(ship, playerPos);
            }
        } else if (ship.state === 'intercept') {
            ship.alertTimer -= dt;
            if (STATE.stealthActive || (ship.alertTimer <= 0 && distToPlayer > 40.0)) {
                ship.state = 'patrol';
                addLogEntry("SYSTEM", `${ship.name} kehrt in planetaren Patrouillen-Orbit zurück.`);
            }

            const toPlayer = new THREE.Vector3().subVectors(playerPos, ship.position);
            const dist = toPlayer.length();
            toPlayer.normalize();

            const desiredDist = 12.0;
            const distDiff = dist - desiredDist;
            const tangent = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
            const accel = new THREE.Vector3();

            accel.addScaledVector(toPlayer, Math.min(28, distDiff * 3.5));
            accel.addScaledVector(tangent, 18.0);

            ship.velocity.addScaledVector(accel, dt);
            ship.velocity.clampLength(0, ship.type === 'corvette' ? 24.0 : 34.0);
            ship.velocity.multiplyScalar(Math.exp(-0.35 * dt));

            ship.position.addScaledVector(ship.velocity, dt);

            if (ship.velocity.lengthSq() > 0.1) {
                const angle = Math.atan2(ship.velocity.x, ship.velocity.z);
                ship.mesh.rotation.y = angle;
            }

            ship.attackCooldown -= dt;
            if (ship.attackCooldown <= 0 && dist < 30.0 && !STATE.stealthActive) {
                ship.attackCooldown = ship.type === 'corvette' ? 1.4 : 1.8;
                fireFleetProjectile(ship, playerPos);
            }
        } else {
            // Patrol Orbit
            ship.orbitAngle += ship.orbitSpeed * dt;
            const targetX = planetPos.x + Math.cos(ship.orbitAngle) * ship.orbitRadius;
            const targetZ = planetPos.z + Math.sin(ship.orbitAngle) * ship.orbitRadius;

            ship.position.x = THREE.MathUtils.lerp(ship.position.x, targetX, 0.05);
            ship.position.z = THREE.MathUtils.lerp(ship.position.z, targetZ, 0.05);

            const tangentX = -Math.sin(ship.orbitAngle);
            const tangentZ = Math.cos(ship.orbitAngle);
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
            const silBonus = isFreighter ? 65 : 35;
            const bioBonus = isFreighter ? 45 : 30;

            STATE.siliconRes += silBonus;
            STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + bioBonus);

            if (isFreighter) {
                addLogEntry("SYSTEM", `💥 FRACHT-ASSIMILATION: Frachträume von ${ship.name} absorbiert! +${silBonus} Silizium & +${bioBonus} Biomasse erbeutet!`);
            } else {
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
        const spec = p.species || (p.attributes && p.attributes.species);
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
