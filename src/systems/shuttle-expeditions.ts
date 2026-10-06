import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { PlanetEntry, SurfaceDeposit, CrewMember, AwayMission, RefinedResourceType } from '../types/game';
import { addLogEntry, updateHUDStats } from '../ui/hud';
import { playBioCollectSound, playSiliconCollectSound } from '../engine/audio';
import { updateScannerUI } from './scanner';

/**
 * Launch an Away-Mission Expedition using Najmafar's Chitin-Shuttle
 */
export function launchAwayMission(
    planet: PlanetEntry,
    deposit: SurfaceDeposit,
    teamCrewIds: string[]
): boolean {
    if (!STATE.bioShuttle.ready) {
        addLogEntry("WARN", "Shuttle-Start fehlgeschlagen: Bio-Lander befindet sich bereits auf einer Mission oder regeneriert!");
        return false;
    }

    if (deposit.depleted) {
        addLogEntry("WARN", `Vorkommen '${deposit.name}' ist bereits vollständig erschöpft.`);
        return false;
    }

    // Resolve crew members
    const team: CrewMember[] = [];
    teamCrewIds.forEach(id => {
        const member = STATE.crew.find(c => String(c.id) === String(id));
        if (member) team.push(member);
    });

    if (team.length === 0) {
        addLogEntry("WARN", "Shuttle-Start fehlgeschlagen: Kein Besatzungsmitglied für das Außenteam ausgewählt!");
        return false;
    }

    if (team.length > 3) {
        team.length = 3; // Max 3 crew members in the lander pod
    }

    const duration = 18.0; // 18 seconds mission cycle

    const mission: AwayMission = {
        id: `mission-${Date.now()}`,
        planetName: planet.name,
        targetDeposit: deposit,
        team: team,
        progress: 0.0,
        duration: duration,
        timer: duration,
        status: 'descending',
        eventsLog: []
    };

    STATE.activeAwayMission = mission;
    STATE.bioShuttle.ready = false;
    STATE.bioShuttle.activeMission = mission;

    const names = team.map(m => `${m.name} (${m.roleName || m.role})`).join(', ');
    addLogEntry("SYSTEM", `🚀 EXPEDITION GESTARTET: Bio-Lander dockt ab! Außenteam [${names}] nimmt Kurs auf '${deposit.name}' (${planet.name}).`);

    closeShuttleExpeditionModal();
    updateHUDStats();
    return true;
}

/**
 * Main simulation tick for active shuttle expeditions
 */
export function updateAwayMissions(dt: number) {
    const mission = STATE.activeAwayMission;
    if (!mission) return;

    mission.timer -= dt;
    mission.progress = Math.min(1.0, 1.0 - (mission.timer / mission.duration));

    const deposit = mission.targetDeposit;
    const team = mission.team;
    const hasScientist = team.some(m => m.role === 'scientist');
    const hasEngineer = team.some(m => m.role === 'engineer');
    const hasSoldier = team.some(m => m.role === 'soldier');
    const hasMedic = team.some(m => m.role === 'medic');

    // Stage 1: Descending (0% - 25%)
    if (mission.progress < 0.25 && mission.status !== 'descending') {
        mission.status = 'descending';
    }

    // Stage 2: Exploring & Hazard Check (25% - 65%)
    if (mission.progress >= 0.25 && mission.progress < 0.65 && mission.status === 'descending') {
        mission.status = 'exploring';

        // Hazard event resolution
        if (deposit.hazardType === 'thermal' && deposit.hazardSeverity !== 'none') {
            if (hasEngineer) {
                const eng = team.find(m => m.role === 'engineer');
                addLogEntry("CREW", `🔧 ${eng?.name}: 'Thermal-Schilde optimal kalibriert. Hitzeeinwirkung auf Null gedämpft!'`);
            } else {
                addLogEntry("WARN", `⚠️ Extreme Hitzewelle auf ${mission.planetName}! Lander-Hitzeschilde bei 85%.`);
                STATE.bioShuttle.hull = Math.max(20, STATE.bioShuttle.hull - 5);
            }
        } else if (deposit.hazardType === 'atmosphere' && deposit.hazardSeverity !== 'none') {
            if (hasMedic) {
                const med = team.find(m => m.role === 'medic');
                addLogEntry("CREW", `💉 ${med?.name}: 'Toxische Bio-Aerosole gefiltert. Vitalfunktionen aller Teammitglieder stabil.'`);
            } else {
                addLogEntry("WARN", `⚠️ Korrosive Atmosphäre greift Chitin-Verkleidung an!`);
                STATE.bioShuttle.hull = Math.max(20, STATE.bioShuttle.hull - 6);
            }
        } else if (deposit.hazardType === 'radiation') {
            if (hasScientist) {
                const sci = team.find(m => m.role === 'scientist');
                addLogEntry("CREW", `🔬 ${sci?.name}: 'Quanten-Strahlungsmuster dekodiert! Isolierte Artefakt-Signaturen entdeckt!'`);
            }
        }

        // Alien Fauna / Security Drone Encounter
        if (deposit.type === 'ruins' || deposit.type === 'xeno_grove') {
            if (hasSoldier) {
                const sol = team.find(m => m.role === 'soldier');
                addLogEntry("CREW", `🛡️ ${sol?.name}: 'Aggressive Xenofauna abgewehrt! Perimeter gesichert – Bergetrupp kann vordringen.'`);
            }
        }
    }

    // Stage 3: Extracting Resources (65% - 90%)
    if (mission.progress >= 0.65 && mission.progress < 0.90 && mission.status === 'exploring') {
        mission.status = 'extracting';
        addLogEntry("EXPEDITION", `⛏️ Außenteam baut '${deposit.name}' ab. Frachtkammern des Bio-Landers werden befüllt.`);
    }

    // Stage 4: Ascending (90% - 100%)
    if (mission.progress >= 0.90 && mission.progress < 1.0 && mission.status === 'extracting') {
        mission.status = 'ascending';
        addLogEntry("EXPEDITION", `🚀 Bergung abgeschlossen! Shuttle zündet Bio-Ascent-Triebwerke und kehrt zu Najmafar zurück.`);
    }

    // Stage 5: Mission Complete
    if (mission.progress >= 1.0) {
        completeAwayMission(mission);
    }
}

/**
 * Conclude successful Away Mission and award resources & experience
 */
export function completeAwayMission(mission: AwayMission) {
    const deposit = mission.targetDeposit;
    deposit.depleted = true;

    const team = mission.team;
    const hasScientist = team.some(m => m.role === 'scientist');
    const hasEngineer = team.some(m => m.role === 'engineer');

    // Calculate yield with role bonuses
    let yieldMultiplier = 1.0;
    if (hasEngineer) yieldMultiplier += 0.40; // +40% mining yield
    if (hasScientist && deposit.yieldResource === 'tech') yieldMultiplier += 0.50; // +50% tech yield

    const finalAmount = Math.round(deposit.yieldAmount * yieldMultiplier);

    // Apply recovered resource
    switch (deposit.yieldResource) {
        case 'water':
            STATE.waterRes += finalAmount;
            addLogEntry("HARVEST", `💧 EXPEDITIONS-ERFOLG: +${finalAmount} Frischwasser / Volatiles von ${mission.planetName} eingelagert!`);
            playBioCollectSound();
            break;
        case 'alloys':
            STATE.alloyRes += finalAmount;
            addLogEntry("HARVEST", `🛡️ EXPEDITIONS-ERFOLG: +${finalAmount} Titan- & Rumpflegierungen von ${mission.planetName} geborgen!`);
            playSiliconCollectSound();
            break;
        case 'tech':
            STATE.techRes += finalAmount;
            addLogEntry("HARVEST", `⚙️ EXPEDITIONS-ERFOLG: +${finalAmount} Vorläufer-Technologie & Quanten-Schaltkreise geborgen!`);
            playSiliconCollectSound();
            break;
        case 'food':
            STATE.foodRes += finalAmount;
            addLogEntry("HARVEST", `🌾 EXPEDITIONS-ERFOLG: +${finalAmount} Nährstoff-Gel & organische Rationen gesichert!`);
            playBioCollectSound();
            break;
        case 'silicon':
            STATE.siliconRes += finalAmount;
            addLogEntry("HARVEST", `💎 EXPEDITIONS-ERFOLG: +${finalAmount} Silizium-Kristalle extrahiert!`);
            playSiliconCollectSound();
            break;
        case 'bio':
        default:
            STATE.bioRes += finalAmount;
            addLogEntry("HARVEST", `🧬 EXPEDITIONS-ERFOLG: +${finalAmount} Biomasse assimiliert!`);
            playBioCollectSound();
            break;
    }

    // Stress relief & bonding for returning team
    team.forEach(m => {
        m.stress = Math.max(0, m.stress - 20);
    });
    STATE.loneliness = Math.max(0, STATE.loneliness - 10);

    // Derelict Cache chance for stranded survivor rescue
    if (deposit.type === 'derelict_cache' && STATE.crew.length < STATE.maxCrewCapacity && Math.random() < 0.65) {
        const survivorPool = team;
        const newMember: CrewMember = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            name: `Überlebender V-${Math.floor(Math.random() * 899 + 100)}`,
            species: 'Xeno-Humanoid',
            role: 'engineer',
            roleName: 'Kolonie-Ingenieur',
            buffDesc: '+15% Reparatur',
            age: 28,
            maxLifespan: 120,
            stress: 40,
            baseStressRate: 0.1,
            illusionStability: 100,
            status: 'Gerettet',
            thought: 'Ich lebe noch...',
            trait: {
                name: 'Wrack-Überlebender',
                desc: '+15% Shuttle-Haltbarkeit & Reparatur',
                type: 'repair'
            }
        };
        STATE.crew.push(newMember);
        addLogEntry("CREW", `👥 ÜBERLEBENDER GEBORGEN: ${newMember.name} aus dem Wrack gerettet & in Najmafars Kokon aufgenommen!`);
    }

    // Reset shuttle status
    STATE.bioShuttle.ready = true;
    STATE.bioShuttle.activeMission = null;
    STATE.activeAwayMission = null;

    updateHUDStats();
    if (STATE.nearestPlanet) {
        updateScannerUI(STATE.nearestPlanet, 5);
    }
}

/**
 * Open Modal to configure and launch an expedition
 */
export function openShuttleExpeditionModal(planet: PlanetEntry, deposit: SurfaceDeposit) {
    const modal = document.getElementById('shuttle-expedition-modal');
    if (!modal) return;

    const titleEl = document.getElementById('shuttle-modal-title');
    const descEl = document.getElementById('shuttle-modal-desc');
    const hazardEl = document.getElementById('shuttle-modal-hazards');
    const yieldEl = document.getElementById('shuttle-modal-yield');
    const crewListEl = document.getElementById('shuttle-crew-selection-list');
    const launchBtn = document.getElementById('shuttle-launch-confirm-btn');

    if (titleEl) titleEl.innerText = `Expedition: ${deposit.name}`;
    if (descEl) descEl.innerText = `${deposit.description} (${planet.name})`;
    
    // Hazards
    if (hazardEl) {
        const hazIcon = deposit.hazardType === 'thermal' ? '🔥 Hitze' : (deposit.hazardType === 'atmosphere' ? '☠️ Atmosphäre' : (deposit.hazardType === 'radiation' ? '☢️ Strahlung' : '🪐 Gravitation'));
        const hazColor = deposit.hazardSeverity === 'extreme' ? '#f43f5e' : (deposit.hazardSeverity === 'moderate' ? '#f59e0b' : '#10b981');
        hazardEl.innerHTML = `<span style="color: ${hazColor}; font-weight: bold;">Gefahr: ${hazIcon} (${deposit.hazardSeverity.toUpperCase()})</span>`;
    }

    // Yield
    if (yieldEl) {
        let resLabel = 'Biomasse';
        if (deposit.yieldResource === 'water') resLabel = '💧 Wasser / Volatiles';
        if (deposit.yieldResource === 'alloys') resLabel = '🛡️ Titan-Legierungen';
        if (deposit.yieldResource === 'tech') resLabel = '⚙️ Hyper-Technologie';
        if (deposit.yieldResource === 'food') resLabel = '🌾 Nahrung / Nährstoffe';
        if (deposit.yieldResource === 'silicon') resLabel = '💎 Silizium-Kristalle';
        yieldEl.innerHTML = `<strong>Erwartete Ausbeute:</strong> ~${deposit.yieldAmount}x ${resLabel}`;
    }

    // Populate Crew Selection
    if (crewListEl) {
        crewListEl.innerHTML = '';
        if (STATE.crew.length === 0) {
            crewListEl.innerHTML = '<div style="color: #94a3b8; font-style: italic;">Keine Crew-Mitglieder in den Kokons verfügbar.</div>';
        } else {
            STATE.crew.forEach((c, idx) => {
                const item = document.createElement('label');
                item.className = 'shuttle-crew-item';
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.gap = '10px';
                item.style.padding = '8px';
                item.style.background = 'rgba(15, 23, 42, 0.7)';
                item.style.borderRadius = '6px';
                item.style.cursor = 'pointer';

                const roleIcon = c.role === 'scientist' ? '🔬' : (c.role === 'engineer' ? '🔧' : (c.role === 'soldier' ? '🛡️' : (c.role === 'medic' ? '💉' : '👤')));
                const isPrechecked = idx < 2; // Preselect first 2 members

                item.innerHTML = `
                    <input type="checkbox" name="shuttle-crew" value="${c.id}" ${isPrechecked ? 'checked' : ''} style="accent-color: #38bdf8;">
                    <div style="font-size: 1.2rem;">${roleIcon}</div>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; color: #f8fafc;">${c.name}</div>
                        <div style="font-size: 0.75rem; color: #94a3b8;">${c.roleName || c.role} &bull; Stress: ${Math.round(c.stress)}%</div>
                    </div>
                `;
                crewListEl.appendChild(item);
            });
        }
    }

    if (launchBtn) {
        launchBtn.onclick = () => {
            const checkedBoxes = document.querySelectorAll('input[name="shuttle-crew"]:checked');
            const selectedIds: string[] = [];
            checkedBoxes.forEach(b => selectedIds.push((b as HTMLInputElement).value));

            if (selectedIds.length === 0) {
                alert("Bitte wähle mindestens ein Crewmitglied für das Außenteam aus!");
                return;
            }

            launchAwayMission(planet, deposit, selectedIds);
        };
    }

    modal.style.display = 'flex';
}

export function closeShuttleExpeditionModal() {
    const modal = document.getElementById('shuttle-expedition-modal');
    if (modal) modal.style.display = 'none';
}

if (typeof window !== 'undefined') {
    (window as any).openShuttleExpeditionModal = openShuttleExpeditionModal;
    (window as any).closeShuttleExpeditionModal = closeShuttleExpeditionModal;
}
