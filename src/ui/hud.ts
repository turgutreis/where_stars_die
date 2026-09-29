import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene, camera } from '../engine/scene';
import { playSonarChime } from '../engine/audio';
import { toggleDeckModal, isDeckOpen } from './deck';
import { toggleGalaxyMap, isMapOpen } from '../systems/galaxy-map';
import { toggleFlightAssist } from '../input/controls';
import { triggerBioDischarge } from '../systems/fleet';
import { projectedTrajectoryPoints } from '../engine/trajectory';
import { PlanetEntry } from '../types/game';

let minimapCanvas: HTMLCanvasElement | null = null;
let minimapCtx: CanvasRenderingContext2D | null = null;
let currentRadarRange = 220;

let sonarWaveMesh: THREE.Mesh | null = null;
let sonarTimer = 0;

export function initHUD() {
    minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    if (minimapCanvas) {
        minimapCtx = minimapCanvas.getContext('2d');
    }

    const sonarBtn = document.getElementById('psionic-sonar-btn') || document.getElementById('dock-sonar-btn');
    if (sonarBtn) {
        sonarBtn.addEventListener('click', triggerPsionicSonar);
    }

    const dockDeckBtn = document.getElementById('dock-deck-btn');
    if (dockDeckBtn) {
        dockDeckBtn.addEventListener('click', () => toggleDeckModal());
    }

    const closeDeckBtn = document.getElementById('close-deck-modal-btn');
    if (closeDeckBtn) {
        closeDeckBtn.addEventListener('click', () => toggleDeckModal(false));
    }

    const dockMapBtn = document.getElementById('dock-map-btn');
    if (dockMapBtn) {
        dockMapBtn.addEventListener('click', () => toggleGalaxyMap());
    }

    const dockAssistBtn = document.getElementById('dock-assist-btn');
    if (dockAssistBtn) {
        dockAssistBtn.addEventListener('click', () => toggleFlightAssist());
    }

    const compassEl = document.getElementById('psionic-compass-hud');
    if (compassEl) {
        compassEl.addEventListener('click', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }));
        });
    }

    const markersContainer = document.getElementById('screen-edge-gravity-markers');
    if (markersContainer) {
        markersContainer.addEventListener('click', (e) => {
            const marker = (e.target as HTMLElement).closest('.edge-planet-marker') as HTMLElement;
            if (marker && marker.dataset.planetName) {
                const targetName = marker.dataset.planetName;
                const planet = activePlanets.find(p => p.name === targetName);
                if (planet) {
                    STATE.lockedTarget = planet;
                    const badge = document.getElementById('target-lock-badge');
                    const label = document.getElementById('target-label-text');
                    if (badge) badge.style.display = 'flex';
                    if (label) label.innerText = 'Fixiertes Ziel:';
                    addLogEntry("NAV", `🎯 Zielerfassung fixiert auf: ${planet.name}`);
                }
            }
        });
    }
}

export function addLogEntry(category: string, message: string) {
    const list = document.getElementById('log-list');
    const toastStream = document.getElementById('hud-fading-log-stream');

    const now = new Date();
    const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    let catClass = 'sys';
    let catText = 'SYSTEM';
    if (category === 'TELEPATHY') {
        catClass = 'telepathy';
        catText = 'TELEPATHIE';
    } else if (category === 'CREW') {
        catClass = 'crew';
        catText = 'CREW-FUNK';
    } else if (category === 'EVOLUTION') {
        catClass = 'evolution';
        catText = 'EVOLUTION';
    }

    // 1. Persistent Log History (Inside Deck Modal)
    if (list) {
        const li = document.createElement('li');
        li.className = 'log-item';
        li.innerHTML = `
            <span class="log-time">[${timeStr}]</span>
            <span class="log-cat ${catClass}">[${catText}]</span>
            <span class="log-msg">${message}</span>
        `;
        list.prepend(li);
        while (list.children.length > 50) {
            list.removeChild(list.lastChild!);
        }
    }

    // 2. Fading Toast on HUD (Auto-cleans after 5 seconds)
    if (toastStream) {
        const toast = document.createElement('div');
        toast.className = `fading-toast ${catClass}`;
        toast.innerHTML = `<span style="font-weight: bold; margin-right: 4px;">[${catText}]</span> ${message}`;
        toastStream.appendChild(toast);

        // Keep maximum 4 toasts visible simultaneously
        while (toastStream.children.length > 4) {
            toastStream.removeChild(toastStream.firstChild!);
        }

        setTimeout(() => {
            if (toast.parentNode === toastStream) {
                toastStream.removeChild(toast);
            }
        }, 5000);
    }
}

export function updateHUDStats(isHarmony = false) {
    const hpBar = document.getElementById('core-health-bar') || document.getElementById('health-bar');
    const hpTxt = document.getElementById('core-health-text') || document.getElementById('health-text');
    const bioBar = document.getElementById('bio-energy-bar') || document.getElementById('energy-bar');
    const bioTxt = document.getElementById('bio-energy-text') || document.getElementById('energy-text');
    const mentalBar = document.getElementById('telepathy-energy-bar') || document.getElementById('mental-bar');
    const mentalTxt = document.getElementById('telepathy-energy-text') || document.getElementById('mental-text');
    const loneBar = document.getElementById('loneliness-bar');
    const loneTxt = document.getElementById('loneliness-text');

    if (hpBar) {
        hpBar.style.width = `${(STATE.health / STATE.maxHealth) * 100}%`;
        if (STATE.health < 30) {
            hpBar.className = "progress-bar health danger";
        } else {
            hpBar.className = "progress-bar health";
        }
    }
    if (hpTxt) hpTxt.innerText = `${Math.round(STATE.health)}%`;

    if (bioBar) bioBar.style.width = `${(STATE.bioEnergy / STATE.maxBioEnergy) * 100}%`;
    if (bioTxt) bioTxt.innerText = `${Math.round(STATE.bioEnergy)}%`;

    if (mentalBar) mentalBar.style.width = `${(STATE.mentalEnergy / STATE.maxMentalEnergy) * 100}%`;
    if (mentalTxt) mentalTxt.innerText = `${Math.round(STATE.mentalEnergy)}/${STATE.maxMentalEnergy}`;

    if (loneBar) {
        loneBar.style.width = `${STATE.loneliness}%`;
        if (isHarmony) {
            loneBar.style.background = 'linear-gradient(90deg, #10b981, #38bdf8)';
        } else {
            loneBar.style.background = STATE.loneliness > 60 ? 'linear-gradient(90deg, #d946ef, #ef4444)' : 'linear-gradient(90deg, #38bdf8, #a855f7)';
        }
    }
    if (loneTxt) {
        let loneState = "Verzweiflung";
        if (isHarmony) loneState = "💫 Kosmische Harmonie";
        else if (STATE.loneliness < 30) loneState = "Duale Resonanz";
        else if (STATE.loneliness < 60) loneState = "Erste Bindung";
        else if (STATE.loneliness < 70) loneState = "Geistige Sättigung";
        loneTxt.innerText = `${Math.round(STATE.loneliness)}% (${loneState})`;
    }

    const currentSys = STATE.universe?.systems?.find(s => s.id === STATE.currentSystemId);
    const sysNameEl = document.getElementById('hud-current-system-name');
    if (sysNameEl) {
        sysNameEl.innerText = `🪐 ${currentSys ? currentSys.name : 'Sol Invictus'}`;
    }

    const bioCountEl = document.getElementById('res-bio-count');
    if (bioCountEl) {
        bioCountEl.innerText = `${Math.floor(STATE.bioRes || 0)}`;
    }

    const silCountEl = document.getElementById('res-silicon-count');
    if (silCountEl) {
        silCountEl.innerText = `${Math.floor(STATE.siliconRes || 0)}`;
    }

    const chronosCountEl = document.getElementById('chronos-count');
    if (chronosCountEl) {
        const visited = STATE.visitedSystemIds ? STATE.visitedSystemIds.length : (STATE.systemsVisited || 1);
        chronosCountEl.innerText = `${visited}`;
    }

    // 3. Radiation Cockpit Hazard Telemetry
    const radMeter = document.getElementById('hud-radiation-meter');
    const radLabel = document.getElementById('rad-label');
    const radBar = document.getElementById('rad-level-bar');
    const radBadge = document.getElementById('rad-shield-badge');
    const radStatus = document.getElementById('rad-status-text');

    const ambient = STATE.ambientRadiation || 0;
    const effective = STATE.effectiveRadiation || 0;
    const resistance = STATE.radiationResistance || 0;
    const source = STATE.radiationSource || 'Kosmische Strahlung';

    if (radMeter) {
        if (ambient > 0.05) {
            radMeter.style.display = 'flex';

            const ambPercent = Math.round(ambient * 100);
            const shieldPercent = Math.round(resistance * 100);

            if (radLabel) radLabel.innerText = `STRAHLUNG: ${ambPercent}%`;
            if (radBadge) radBadge.innerText = `🛡️ ${shieldPercent}%`;

            if (radBar) {
                radBar.style.width = `${ambPercent}%`;
            }

            if (effective > 0.15) {
                const dmgPerSec = ((effective - 0.15) * 4.5).toFixed(1);
                radMeter.className = 'hud-radiation-meter glass-capsule hazard';
                if (radStatus) {
                    radStatus.innerHTML = `<span class="rad-alert-icon">⚠️</span> STRAHLUNGSALARM: -${dmgPerSec} HP/s (${source})`;
                }
            } else if (resistance >= 0.50 && ambient > 0.20) {
                radMeter.className = 'hud-radiation-meter glass-capsule shielded';
                if (radStatus) {
                    radStatus.innerHTML = `<span class="rad-shield-icon">🛡️</span> ABGESCHIRMT: ${shieldPercent}% Filterung ✓`;
                }
            } else {
                radMeter.className = 'hud-radiation-meter glass-capsule caution';
                if (radStatus) {
                    radStatus.innerHTML = `<span>⚡</span> Strahlungsfeld aktiv (${source})`;
                }
            }
        } else {
            radMeter.style.display = 'none';
        }
    }
}

export function updateMinimap() {
    if (!minimapCanvas || !minimapCtx) return;

    const width = minimapCanvas.width;
    const height = minimapCanvas.height;
    const cx = width / 2;
    const cy = height / 2;

    // Continuous Dynamic Radar Range: smoothly zooms in as you travel towards a world
    const approach = STATE.orbitTransitionProgress || 0;
    const isMoon = STATE.orbitLevel === 'moon';
    const baseTargetRange = isMoon ? 24.0 : (220.0 - 175.0 * approach);
    currentRadarRange = THREE.MathUtils.lerp(currentRadarRange, Math.max(24.0, baseTargetRange), 0.08);
    const range = currentRadarRange;

    minimapCtx.fillStyle = 'rgba(3, 7, 18, 0.85)';
    minimapCtx.fillRect(0, 0, width, height);

    const radius = width / 2 - 4;
    minimapCtx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    minimapCtx.lineWidth = 1;

    // Range rings
    minimapCtx.beginPath();
    minimapCtx.arc(cx, cy, radius * 0.33, 0, Math.PI * 2);
    minimapCtx.stroke();

    minimapCtx.beginPath();
    minimapCtx.arc(cx, cy, radius * 0.66, 0, Math.PI * 2);
    minimapCtx.stroke();

    minimapCtx.beginPath();
    minimapCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    minimapCtx.stroke();

    // Crosshair axes
    minimapCtx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    minimapCtx.beginPath();
    minimapCtx.moveTo(cx, cy - radius);
    minimapCtx.lineTo(cx, cy + radius);
    minimapCtx.moveTo(cx - radius, cy);
    minimapCtx.lineTo(cx + radius, cy);
    minimapCtx.stroke();

    const invRangeRadius = radius / range;

    // Draw gravity sources / planets
    STATE.gravitySources.forEach(source => {
        if (source.isAbsorbed) return;

        const dx = source.position.x - STATE.playerPosition.x;
        const dz = source.position.z - STATE.playerPosition.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < range) {
            const sx = cx + dx * invRangeRadius;
            const sy = cy + dz * invRangeRadius;

            if (source.type === 'star') {
                minimapCtx.fillStyle = '#f59e0b';
                minimapCtx.beginPath();
                minimapCtx.arc(sx, sy, 5, 0, Math.PI * 2);
                minimapCtx.fill();
            } else if (source.type === 'planet') {
                const planetEntry = activePlanets.find(p => p.source === source);
                const hasSentient = planetEntry && planetEntry.attributes.species && planetEntry.attributes.species.population > 0;

                if (hasSentient) {
                    minimapCtx.fillStyle = '#d946ef';
                    minimapCtx.beginPath();
                    minimapCtx.arc(sx, sy, 4.5, 0, Math.PI * 2);
                    minimapCtx.fill();

                    minimapCtx.strokeStyle = 'rgba(217, 70, 239, 0.8)';
                    minimapCtx.beginPath();
                    minimapCtx.arc(sx, sy, 6.5 + Math.sin(Date.now() * 0.008) * 1.5, 0, Math.PI * 2);
                    minimapCtx.stroke();
                } else {
                    minimapCtx.fillStyle = planetEntry && planetEntry.isMoon ? '#94a3b8' : '#38bdf8';
                    minimapCtx.beginPath();
                    minimapCtx.arc(sx, sy, planetEntry && planetEntry.isMoon ? 2 : 3.5, 0, Math.PI * 2);
                    minimapCtx.fill();
                }
            } else if (((source as any).type === 'voyager_probe' || (source as any).isVoyager) && STATE.voyagerSignalDetected) {
                // Bright golden radar ping with pulsing wave ring
                minimapCtx.fillStyle = '#fbbf24';
                minimapCtx.beginPath();
                minimapCtx.arc(sx, sy, 4.0, 0, Math.PI * 2);
                minimapCtx.fill();

                const wavePulse = 5.0 + Math.sin(Date.now() * 0.007) * 3.0;
                minimapCtx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
                minimapCtx.lineWidth = 1.2;
                minimapCtx.beginPath();
                minimapCtx.arc(sx, sy, wavePulse, 0, Math.PI * 2);
                minimapCtx.stroke();

                minimapCtx.fillStyle = '#fbbf24';
                minimapCtx.font = '8px Orbitron, sans-serif';
                const probeLabel = STATE.voyagerScanned ? "📡 VOYAGER 2" : "📡 UNBEKANNTES SIGNAL";
                minimapCtx.fillText(probeLabel, sx + 7, sy + 3);
            } else if (source.type === 'asteroid') {
                minimapCtx.fillStyle = source.resourceType === 'bio' ? '#00ff88' : '#38bdf8';
                minimapCtx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
            }
        } else if (source.type === 'planet' || source.type === 'star') {
            // Off-screen planetary and stellar gravity vectors on radar rim
            const angle = Math.atan2(dz, dx);
            const edgeRadius = radius - 3.5;
            const ex = cx + Math.cos(angle) * edgeRadius;
            const ey = cy + Math.sin(angle) * edgeRadius;

            const planetEntry = activePlanets.find(p => p.source === source);
            const isLocked = STATE.lockedTarget && (STATE.lockedTarget === planetEntry || STATE.lockedTarget === source);
            const hasSentient = planetEntry && planetEntry.attributes && planetEntry.attributes.species && planetEntry.attributes.species.population > 0;

            if (isLocked) {
                minimapCtx.fillStyle = '#38bdf8';
                minimapCtx.beginPath();
                minimapCtx.arc(ex, ey, 4.0, 0, Math.PI * 2);
                minimapCtx.fill();

                minimapCtx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
                minimapCtx.lineWidth = 1.5;
                minimapCtx.beginPath();
                minimapCtx.arc(ex, ey, 6.5, 0, Math.PI * 2);
                minimapCtx.stroke();
            } else if (hasSentient) {
                minimapCtx.fillStyle = '#d946ef';
                minimapCtx.beginPath();
                minimapCtx.arc(ex, ey, 3.2, 0, Math.PI * 2);
                minimapCtx.fill();

                minimapCtx.strokeStyle = 'rgba(217, 70, 239, 0.8)';
                minimapCtx.lineWidth = 1;
                minimapCtx.beginPath();
                minimapCtx.arc(ex, ey, 5.2, 0, Math.PI * 2);
                minimapCtx.stroke();
            } else if (source.type === 'star') {
                minimapCtx.fillStyle = '#f59e0b';
                minimapCtx.beginPath();
                minimapCtx.arc(ex, ey, 3.5, 0, Math.PI * 2);
                minimapCtx.fill();
            } else if (planetEntry && !planetEntry.isMoon) {
                const isHab = planetEntry.type === 'Habitable';
                const isGas = planetEntry.type === 'Gas Giant';
                minimapCtx.fillStyle = isHab ? '#10b981' : (isGas ? '#f59e0b' : '#64748b');
                minimapCtx.beginPath();
                minimapCtx.arc(ex, ey, 2.5, 0, Math.PI * 2);
                minimapCtx.fill();
            }
        }
    });

    // Off-screen Voyager 2 pointer on radar perimeter
    if (STATE.voyagerSignalDetected && !STATE.voyagerScanned && STATE.voyagerProbe && STATE.voyagerProbe.position) {
        const vx = STATE.voyagerProbe.position.x - STATE.playerPosition.x;
        const vz = STATE.voyagerProbe.position.z - STATE.playerPosition.z;
        const vDist = Math.hypot(vx, vz);
        if (vDist >= range) {
            const angle = Math.atan2(vz, vx);
            const edgeRadius = radius - 3;
            const ex = cx + Math.cos(angle) * edgeRadius;
            const ey = cy + Math.sin(angle) * edgeRadius;

            minimapCtx.fillStyle = '#fbbf24';
            minimapCtx.beginPath();
            minimapCtx.arc(ex, ey, 3.5, 0, Math.PI * 2);
            minimapCtx.fill();

            minimapCtx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
            minimapCtx.lineWidth = 1;
            minimapCtx.beginPath();
            minimapCtx.arc(ex, ey, 5.5, 0, Math.PI * 2);
            minimapCtx.stroke();
        }
    }

    // Draw Locked Target Indicator
    const lockedTargetPos = STATE.lockedTarget ? ((STATE.lockedTarget as any).position || ((STATE.lockedTarget as any).source ? (STATE.lockedTarget as any).source.position : null)) : null;
    if (lockedTargetPos) {
        const dx = lockedTargetPos.x - STATE.playerPosition.x;
        const dz = lockedTargetPos.z - STATE.playerPosition.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < range) {
            const sx = cx + dx * invRangeRadius;
            const sy = cy + dz * invRangeRadius;
            minimapCtx.strokeStyle = '#38bdf8';
            minimapCtx.lineWidth = 1.5;
            minimapCtx.beginPath();
            minimapCtx.arc(sx, sy, 8, 0, Math.PI * 2);
            minimapCtx.stroke();
        } else {
            const angle = Math.atan2(dz, dx);
            const edgeRadius = radius - 3.5;
            const ex = cx + Math.cos(angle) * edgeRadius;
            const ey = cy + Math.sin(angle) * edgeRadius;
            minimapCtx.strokeStyle = '#38bdf8';
            minimapCtx.lineWidth = 1.8;
            minimapCtx.beginPath();
            minimapCtx.arc(ex, ey, 7.5, 0, Math.PI * 2);
            minimapCtx.stroke();
        }
    }

    // Draw Fleet Ships (Spacefaring Defense Fleets)
    STATE.fleetShips.forEach(ship => {
        const dx = ship.position.x - STATE.playerPosition.x;
        const dz = ship.position.z - STATE.playerPosition.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < range) {
            const sx = cx + dx * invRangeRadius;
            const sy = cy + dz * invRangeRadius;

            if (ship.state === 'disabled') {
                minimapCtx.fillStyle = '#64748b';
                minimapCtx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
            } else if (ship.state === 'intercept') {
                minimapCtx.fillStyle = '#f43f5e';
                minimapCtx.beginPath();
                minimapCtx.arc(sx, sy, 3.5, 0, Math.PI * 2);
                minimapCtx.fill();

                minimapCtx.strokeStyle = 'rgba(244, 63, 94, 0.8)';
                minimapCtx.beginPath();
                minimapCtx.arc(sx, sy, 5.5 + Math.sin(Date.now() * 0.015) * 1.5, 0, Math.PI * 2);
                minimapCtx.stroke();
            } else {
                // Patrol
                minimapCtx.fillStyle = '#f59e0b';
                minimapCtx.beginPath();
                minimapCtx.arc(sx, sy, 2.5, 0, Math.PI * 2);
                minimapCtx.fill();
            }
        }
    });

    // Draw Fleet Projectiles
    STATE.fleetProjectiles.forEach(proj => {
        const dx = proj.position.x - STATE.playerPosition.x;
        const dz = proj.position.z - STATE.playerPosition.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < range) {
            const sx = cx + dx * invRangeRadius;
            const sy = cy + dz * invRangeRadius;
            minimapCtx.fillStyle = proj.type === 'emp' ? '#a855f7' : '#38bdf8';
            minimapCtx.fillRect(sx - 1, sy - 1, 2, 2);
        }
    });

    // Draw Projected Orbital Trajectory on Radar
    if (projectedTrajectoryPoints && projectedTrajectoryPoints.length > 1) {
        minimapCtx.save();
        minimapCtx.lineWidth = 1.5;
        for (let i = 0; i < projectedTrajectoryPoints.length - 1; i++) {
            const p0 = projectedTrajectoryPoints[i];
            const p1 = projectedTrajectoryPoints[i + 1];

            const dx0 = p0.x - STATE.playerPosition.x;
            const dz0 = p0.z - STATE.playerPosition.z;
            const dx1 = p1.x - STATE.playerPosition.x;
            const dz1 = p1.z - STATE.playerPosition.z;

            // Only draw if within reasonable range
            const dist0 = Math.hypot(dx0, dz0);
            const dist1 = Math.hypot(dx1, dz1);
            if (dist0 > range && dist1 > range) continue;

            const sx0 = cx + dx0 * invRangeRadius;
            const sy0 = cy + dz0 * invRangeRadius;
            const sx1 = cx + dx1 * invRangeRadius;
            const sy1 = cy + dz1 * invRangeRadius;

            // Clamp line within minimap circle
            const r0 = Math.hypot(sx0 - cx, sy0 - cy);
            const r1 = Math.hypot(sx1 - cx, sy1 - cy);
            if (r0 <= radius && r1 <= radius) {
                minimapCtx.strokeStyle = p0.isGravityArc ? 'rgba(217, 70, 239, 0.85)' : 'rgba(56, 189, 248, 0.55)';
                minimapCtx.beginPath();
                minimapCtx.moveTo(sx0, sy0);
                minimapCtx.lineTo(sx1, sy1);
                minimapCtx.stroke();
            }
        }
        minimapCtx.restore();
    }

    // Draw Player Ship (Directional arrow)
    const heading = (STATE.playerGroup ? STATE.playerGroup.rotation.y : 0);
    minimapCtx.save();
    minimapCtx.translate(cx, cy);
    minimapCtx.rotate(-heading);
    minimapCtx.fillStyle = '#10b981';
    minimapCtx.shadowColor = '#10b981';
    minimapCtx.shadowBlur = 8;
    minimapCtx.beginPath();
    minimapCtx.moveTo(0, -7);
    minimapCtx.lineTo(5, 5);
    minimapCtx.lineTo(0, 2.5);
    minimapCtx.lineTo(-5, 5);
    minimapCtx.closePath();
    minimapCtx.fill();
    minimapCtx.restore();

    // Radar mode & range telemetry label
    minimapCtx.fillStyle = 'rgba(56, 189, 248, 0.85)';
    minimapCtx.font = '9px monospace';
    minimapCtx.textAlign = 'center';
    const modeLabel = STATE.orbitLevel === 'moon'
        ? `🌕 MOND: ${STATE.activeMoonOrbit?.name || 'Orbit'}`
        : (STATE.orbitLevel === 'planet'
            ? `🪐 SUB-SYS: ${STATE.orbitPlanet?.name || 'Orbit'}`
            : `RADAR: ${Math.round(range)} LJ`);
    minimapCtx.fillText(modeLabel, cx, height - 6);
}

export function triggerPsionicSonar() {
    if (!STATE.gameStarted) return;
    if (STATE.mentalEnergy < 15) {
        addLogEntry("SYSTEM", "Zu wenig Mentalkraft für psionischen Sonar-Ruf (15% benötigt)!");
        return;
    }

    STATE.mentalEnergy = Math.max(0, STATE.mentalEnergy - 15);

    if (sonarWaveMesh) {
        scene.remove(sonarWaveMesh);
        if (sonarWaveMesh.geometry) sonarWaveMesh.geometry.dispose();
        if (sonarWaveMesh.material) (sonarWaveMesh.material as THREE.Material).dispose();
    }

    const ringGeo = new THREE.RingGeometry(1, 4, 64);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xd946ef,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    sonarWaveMesh = new THREE.Mesh(ringGeo, ringMat);
    sonarWaveMesh.position.copy(STATE.playerPosition);
    scene.add(sonarWaveMesh);
    sonarTimer = 1.0;

    playSonarChime();

    const sentientPlanets = activePlanets.filter(p => p.attributes && p.attributes.species && p.attributes.species.population > 0);
    if (sentientPlanets.length > 0) {
        const names = sentientPlanets.map(p => `${p.name} (${p.attributes.species.name})`).join(', ');
        addLogEntry("SYSTEM", `PSIONISCHER RUF: Mentales Resonanz-Echo empfangen von: ${names}! Kompass aktiv.`);
    } else {
        addLogEntry("SYSTEM", "PSIONISCHER RUF: Keine Gedanken-Signaturen in diesem System (Kosmische Stille).");
    }
}

export function updateSonarWave(dt: number) {
    if (!sonarWaveMesh) return;
    sonarTimer -= dt;
    const progress = 1.0 - sonarTimer;
    const scale = 1.0 + progress * 60;
    sonarWaveMesh.scale.set(scale, 1, scale);
    (sonarWaveMesh.material as THREE.Material).opacity = Math.max(0, sonarTimer * 0.9);

    if (sonarTimer <= 0) {
        scene.remove(sonarWaveMesh);
        if (sonarWaveMesh.geometry) sonarWaveMesh.geometry.dispose();
        if (sonarWaveMesh.material) (sonarWaveMesh.material as THREE.Material).dispose();
        sonarWaveMesh = null;
    }
}

// ----------------------------------------------------------------------------
// INTERSTELLAR SYSTEM ARRIVAL HUD BANNER
// ----------------------------------------------------------------------------

import { JumpResolution } from '../types/game';

let arrivalBannerTimeout: any = null;

export function triggerSystemArrivalBanner(system: any, factionName?: string, resolution?: JumpResolution | null) {
    const banner = document.getElementById('system-arrival-banner');
    if (!banner) return;

    if (arrivalBannerTimeout) {
        clearTimeout(arrivalBannerTimeout);
        arrivalBannerTimeout = null;
    }

    const titleEl = document.getElementById('arrival-system-title');
    const sectorEl = document.getElementById('arrival-sector-label');
    const starEl = document.getElementById('arrival-star-badge');
    const planetsEl = document.getElementById('arrival-planets-badge');
    const factionEl = document.getElementById('arrival-faction-badge');

    if (titleEl) titleEl.innerText = (system.name || 'UNBEKANNT').toUpperCase();
    
    if (sectorEl) {
        if (resolution && resolution.isDrift) {
            sectorEl.innerText = `⚠️ PSIONISCHE ABWEICHUNG: DRIFT NACH ${system.name.toUpperCase()}!`;
            sectorEl.style.color = '#f87171';
        } else if (resolution && resolution.hazardType === 'solar_corona') {
            sectorEl.innerText = `🔥 PERIHEL-NOTFALL-DROPOUT: NÄHE DER SONNENKORONA!`;
            sectorEl.style.color = '#ef4444';
        } else if (resolution && resolution.hazardType === 'asteroid_belt') {
            sectorEl.innerText = `💥 WARP-FEHLKOLLAPS: ASTEROIDENGÜRTEL-INVASION!`;
            sectorEl.style.color = '#f97316';
        } else {
            sectorEl.innerText = system.sectorName ? `${system.sectorName.toUpperCase()} • TRANSIT` : 'SYSTEM-TRANSIT ABGESCHLOSSEN';
            sectorEl.style.color = '#38bdf8';
        }
    }

    if (starEl && system.star) {
        starEl.innerText = `⭐ ${system.star.type || 'Zentralgestirn'}`;
    }

    const planetCount = system.planets ? system.planets.length : 0;
    let moonCount = 0;
    if (system.planets) {
        system.planets.forEach((p: any) => {
            if (p.moons) moonCount += p.moons.length;
        });
    }

    if (planetsEl) {
        planetsEl.innerText = moonCount > 0
            ? `🪐 ${planetCount} Planeten | ${moonCount} Monde`
            : `🪐 ${planetCount} Himmelskörper`;
    }

    if (factionEl) {
        if (factionName) {
            factionEl.innerText = `🛡️ ${factionName}`;
            factionEl.style.display = 'inline-flex';
        } else {
            factionEl.innerText = `🌌 Unerschlossener Raum`;
            factionEl.style.display = 'inline-flex';
        }
    }

    banner.classList.remove('banner-exit');
    banner.style.display = 'flex';

    arrivalBannerTimeout = setTimeout(() => {
        banner.classList.add('banner-exit');
        setTimeout(() => {
            banner.style.display = 'none';
            banner.classList.remove('banner-exit');
        }, 800);
    }, 4500);
}

// ----------------------------------------------------------------------------
// PSIONIC GRAVITATIONAL COMPASS & SENSORY ECOSYSTEM
// ----------------------------------------------------------------------------

export function updatePsionicCompass() {
    const compassEl = document.getElementById('psionic-compass-hud');
    if (!compassEl) return;

    if (!STATE.gameStarted || isMapOpen() || isDeckOpen()) {
        compassEl.style.display = 'none';
        return;
    }

    // 1. Determine Tracked Target
    let target: any = STATE.lockedTarget;
    let targetPos: THREE.Vector3 | null = null;
    let isLocked = !!STATE.lockedTarget;
    let isSentient = false;

    if (target) {
        targetPos = target.mesh ? target.mesh.position : (target.position || (target.source ? target.source.position : null));
        if (target.attributes && target.attributes.species && target.attributes.species.population > 0) {
            isSentient = true;
        }
    }

    if (!targetPos && activePlanets.length > 0) {
        // Priority 1: Check for closest sentient planet
        let bestSentient: any = null;
        let bestSentientDist = Infinity;
        let closestBody: any = null;
        let closestDist = Infinity;

        activePlanets.forEach(p => {
            if (!p.mesh) return;
            const d = p.mesh.position.distanceTo(STATE.playerPosition);
            if (p.attributes && p.attributes.species && p.attributes.species.population > 0) {
                if (d < bestSentientDist) {
                    bestSentientDist = d;
                    bestSentient = p;
                }
            }
            if (d < closestDist) {
                closestDist = d;
                closestBody = p;
            }
        });

        if (bestSentient && bestSentientDist < 450) {
            target = bestSentient;
            targetPos = bestSentient.mesh.position;
            isSentient = true;
        } else if (closestBody) {
            target = closestBody;
            targetPos = closestBody.mesh.position;
            if (target.attributes && target.attributes.species && target.attributes.species.population > 0) {
                isSentient = true;
            }
        }
    }

    // Fallback: check central star or Voyager probe
    if (!targetPos) {
        const star = STATE.gravitySources.find(s => s.type === 'star');
        if (star) {
            target = star;
            targetPos = star.position;
        }
    }

    if (!target || !targetPos) {
        compassEl.style.display = 'none';
        return;
    }

    compassEl.style.display = 'flex';
    compassEl.className = `psionic-compass-hud ${isLocked ? 'locked-mode' : ''} ${isSentient ? 'sentient-pulse' : ''}`;

    const dx = targetPos.x - STATE.playerPosition.x;
    const dz = targetPos.z - STATE.playerPosition.z;
    const dist = Math.hypot(dx, dz);

    // Screen angle: camera looks down from +Y, -Z is screen UP, +X is screen RIGHT
    const angleDeg = Math.atan2(dx, -dz) * (180 / Math.PI);
    const needleEl = document.getElementById('compass-arrow-needle');
    if (needleEl) {
        needleEl.style.transform = `rotate(${angleDeg}deg)`;
    }

    const iconEl = document.getElementById('compass-beacon-icon');
    const labelEl = document.getElementById('compass-label');
    const nameEl = document.getElementById('compass-planet-name');
    const distEl = document.getElementById('compass-distance-text');

    // Organic Sensation of Gravitation
    let gravSensation = '';
    if (dist < 22) {
        gravSensation = '⚡ Orbit-Eintritt / Starkes Gravitationsfeld';
    } else if (dist < 65) {
        gravSensation = '🌀 Spürbare Raumzeitkrümmung';
    } else if (dist < 160) {
        gravSensation = '🌌 Sanfte Schwerkraft-Dünung';
    } else {
        gravSensation = '🔭 Fernes Gravitations-Echo';
    }

    // Icon & Label styling
    if (iconEl) {
        if (isSentient) iconEl.innerText = '🧠';
        else if (target.type === 'star' || target.type === 'Yellow Sun' || target.type === 'Black Hole') iconEl.innerText = '☀️';
        else if (target.type === 'Gas Giant') iconEl.innerText = '🪐';
        else if (target.type === 'Habitable') iconEl.innerText = '🌍';
        else if (target.isMoon) iconEl.innerText = '🌕';
        else if (target.type === 'voyager_probe' || target.name?.includes('Voyager')) iconEl.innerText = '📡';
        else iconEl.innerText = '🌑';
    }

    if (labelEl) {
        if (isLocked) {
            labelEl.innerText = '🎯 FIXIERTES GRAVITATIONSZIEL:';
            labelEl.style.color = '#38bdf8';
        } else if (isSentient) {
            labelEl.innerText = '🧠 PSIO- & GRAVITATIONS-RESONANZ:';
            labelEl.style.color = '#d946ef';
        } else {
            labelEl.innerText = '🪐 RAUMZEIT-GEFÄLLE (NÄCHSTE MASSE):';
            labelEl.style.color = '#a855f7';
        }
    }

    if (nameEl) {
        let displayName = target.name || 'Unbekannter Körper';
        if (isSentient && target.attributes?.species?.name) {
            displayName += ` (${target.attributes.species.name})`;
        }
        nameEl.innerText = displayName;
    }

    if (distEl) {
        distEl.innerText = `${dist.toFixed(1)} AE • ${gravSensation}`;
        distEl.innerHTML = `<strong>${dist.toFixed(1)} AE</strong> &bull; ${gravSensation}`;
    }
}

// ----------------------------------------------------------------------------
// SCREEN-EDGE CELESTIAL GRAVITATIONAL MARKERS
// ----------------------------------------------------------------------------

const cachedEdgeMarkers: Map<string, HTMLElement> = new Map();

export function updateScreenEdgeMarkers() {
    const container = document.getElementById('screen-edge-gravity-markers');
    if (!container) return;

    if (!STATE.gameStarted || isMapOpen() || isDeckOpen() || !camera) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    if (!activePlanets || activePlanets.length === 0) {
        container.innerHTML = '';
        cachedEdgeMarkers.clear();
        return;
    }

    // Collect candidates to mark: locked target + up to 3 nearest other planets
    const candidates: { planet: PlanetEntry; dist: number; isLocked: boolean }[] = [];
    const pPos = STATE.playerPosition;

    activePlanets.forEach(p => {
        if (!p.mesh || p.isMoon) return;
        const d = p.mesh.position.distanceTo(pPos);
        const isLocked = !!(STATE.lockedTarget && STATE.lockedTarget.name === p.name);
        candidates.push({ planet: p, dist: d, isLocked });
    });

    // Sort: locked first, then by distance
    candidates.sort((a, b) => {
        if (a.isLocked) return -1;
        if (b.isLocked) return 1;
        return a.dist - b.dist;
    });

    const activeSubset = candidates.slice(0, 4);
    const activeNames = new Set<string>();

    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
    const margin = 48; // px from screen border

    activeSubset.forEach(item => {
        const p = item.planet;
        const worldPos = p.mesh.position;
        const proj = worldPos.clone().project(camera);

        // Check if on-screen (proj.x in [-0.85, 0.85] and proj.y in [-0.85, 0.85] and proj.z < 1)
        const isOnScreen = proj.z < 1.0 && Math.abs(proj.x) < 0.86 && Math.abs(proj.y) < 0.86;
        if (isOnScreen) return; // Do not show edge marker if planet is already visible in viewport

        activeNames.add(p.name);

        // Calculate 2D direction from center of screen in NDC
        const dx = proj.x;
        const dy = proj.y;

        const maxRangeX = halfW - margin;
        const maxRangeY = halfH - margin;

        let edgeX = 0;
        let edgeY = 0;

        if (Math.abs(dx) * maxRangeY > Math.abs(dy) * maxRangeX) {
            // Intersects left or right edge
            edgeX = dx > 0 ? maxRangeX : -maxRangeX;
            edgeY = (dx > 0 ? maxRangeX : -maxRangeX) * (dy / (Math.abs(dx) || 0.001));
            edgeY = THREE.MathUtils.clamp(edgeY, -maxRangeY, maxRangeY);
        } else {
            // Intersects top or bottom edge
            edgeY = dy > 0 ? maxRangeY : -maxRangeY;
            edgeX = (dy > 0 ? maxRangeY : -maxRangeY) * (dx / (Math.abs(dy) || 0.001));
            edgeX = THREE.MathUtils.clamp(edgeX, -maxRangeX, maxRangeX);
        }

        // Convert to screen pixel coordinates (Y inverted in NDC)
        const screenX = halfW + edgeX;
        const screenY = halfH - edgeY;

        // Angle for arrow pointing towards the planet
        const arrowAngleDeg = Math.atan2(-edgeY, edgeX) * (180 / Math.PI);

        let markerEl = cachedEdgeMarkers.get(p.name);
        if (!markerEl) {
            markerEl = document.createElement('div');
            markerEl.className = 'edge-planet-marker';
            markerEl.dataset.planetName = p.name;
            container.appendChild(markerEl);
            cachedEdgeMarkers.set(p.name, markerEl);
        }

        const isSentient = !!(p.attributes?.species && p.attributes.species.population > 0);
        markerEl.className = `edge-planet-marker ${item.isLocked ? 'locked' : ''} ${isSentient ? 'sentient' : ''}`;
        markerEl.style.left = `${Math.round(screenX)}px`;
        markerEl.style.top = `${Math.round(screenY)}px`;

        const icon = isSentient ? '🧠' : (p.type === 'Gas Giant' ? '🪐' : (p.type === 'Habitable' ? '🌍' : '🌑'));
        markerEl.innerHTML = `
            <span class="edge-planet-chevron" style="transform: rotate(${arrowAngleDeg}deg); display: inline-block;">➤</span>
            <span class="edge-planet-icon">${icon}</span>
            <span class="edge-planet-name">${p.name}</span>
            <span class="edge-planet-dist">${item.dist.toFixed(0)} AE</span>
        `;
    });

    // Remove obsolete markers
    cachedEdgeMarkers.forEach((el, name) => {
        if (!activeNames.has(name)) {
            if (el.parentNode) el.parentNode.removeChild(el);
            cachedEdgeMarkers.delete(name);
        }
    });
}
