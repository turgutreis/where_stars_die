import { STATE } from '../core/state';
import { addLogEntry } from './hud';
import { playVoyagerBeaconPing } from '../engine/audio';
import { QuestManager } from '../systems/quests';

export interface DirectiveItem {
    id: number;
    badge: string;
    title: string;
    instruction: string;
    hint: string;
}

export const FTUE_DIRECTIVES: DirectiveItem[] = [
    {
        id: 0,
        badge: "PROLOG 1",
        title: "Lebensfunke & Bio-Schub",
        instruction: "Bewege Najmafar mit [W/A/S/D] oder [Maus-Lenkung]",
        hint: "Teste deine organischen Steuerdrüsen im Vakuum von Perseus-Rand."
    },
    {
        id: 1,
        badge: "PROLOG 2",
        title: "Jamals Forschungsschiff orten",
        instruction: "Fliege zum nahen Planeten & scanne Jamals Schiffssignatur im Orbit mit [F]",
        hint: "Dr. Jamal hat sein Schiff vor der psionischen Gilde im Schatten des Planeten versteckt."
    },
    {
        id: 2,
        badge: "PROLOG 3",
        title: "Insan-Parkkralle & Köderfalle",
        instruction: "Untersuche die Parkkralle der Insan-Drohne [Dialog rechts]",
        hint: "Zahlen schlägt fehl – wage einen Eingriff an der Kralle und entlarve die Attrappe."
    },
    {
        id: 3,
        badge: "PROLOG 4",
        title: "Reise zur INSAN-Verwahrstelle",
        instruction: "Öffne die Sternenkarte [M] & reise zur INSAN-Verwahrstelle Zeta-9 (2 Sprünge)",
        hint: "Das echte Schiff wurde 2 Raum-Sprünge weit in ein gigantisches Pfanddepot geschleppt."
    },
    {
        id: 4,
        badge: "PROLOG 5",
        title: "Echtes Forschungsschiff bergen",
        instruction: "Befreie die echte ISS Ibn Battuta an Pier 4 & rette das Voyager-Relikt",
        hint: "Sprenge die Verankerung per EMP – dies koppelt Jamals Schiffsdatenbank & schaltet das Logbuch frei!"
    },
    {
        id: 5,
        badge: "PHASE 1",
        title: "Galaktischer Transit",
        instruction: "Öffne die Sternenkarte [M] – Kurs auf ein bewohntes Sternensystem",
        hint: "Im Startsystem gibt es keine Biosphäre. Finde ein System mit intelligentem Leben!"
    },
    {
        id: 6,
        badge: "PHASE 2",
        title: "Der erste Wirt",
        instruction: "Scanne eine bewohnte Welt & führe eine psionische Aufnahme [F] durch",
        hint: "Nimm ein intelligentes Wesen in deine Kokon-Matrix auf, um Einsamkeit zu lindern."
    },
    {
        id: 7,
        badge: "PHASE 3",
        title: "Traum-Matrix & Organe",
        instruction: "Öffne das Bio-Deck [TAB], weise Besatzung zu & halte [LEERTASTE] zur Stabilisierung",
        hint: "Pflege deine Besatzung und nutze ihre wissenschaftlichen Rollen-Boni."
    }
];

let isCollapsed = false;

export function isQuestlogUnlocked(): boolean {
    return Boolean(STATE.jamalShipLiberated);
}

export function initDirectivesHUD() {
    const toggleBtn = document.getElementById('toggle-directives-btn');
    const container = document.getElementById('hud-directives');

    if (toggleBtn && container) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            isCollapsed = !isCollapsed;
            container.classList.toggle('collapsed', isCollapsed);
            toggleBtn.innerText = isCollapsed ? '📋' : '➖';
        });
    }

    if (container && !isQuestlogUnlocked()) {
        container.style.display = 'none';
    }

    renderDirectives();
}

export function renderDirectives() {
    const hudDirectives = document.getElementById('hud-directives');
    const container = document.getElementById('directives-list');
    if (!container) return;

    // Questlog is strictly hidden until Najmafar has acquired Dr. Jamal's research ship!
    if (!isQuestlogUnlocked()) {
        if (hudDirectives) hudDirectives.style.display = 'none';
        return;
    }

    if (hudDirectives) hudDirectives.style.display = '';

    const currentStep = STATE.ftueStep || 0;

    let html = '';

    // Render dynamic active quests from QuestManager
    const activeQuests = QuestManager.getActiveQuests();
    activeQuests.forEach((q) => {
        const isDone = q.progress.completed;
        const statusClass = isDone ? 'done' : 'active';
        const checkmark = isDone ? '✔' : '◉';

        html += `
            <div class="directive-card ${statusClass} story-quest-card" data-quest="${q.definition.id}">
                <div class="directive-status-icon">${checkmark}</div>
                <div class="directive-body">
                    <div class="directive-header">
                        <span class="directive-badge" style="background: rgba(168, 85, 247, 0.25); border-color: rgba(168, 85, 247, 0.6); color: #d8b4fe;">${q.definition.badge || 'PROLOG-QUEST'}</span>
                        <span class="directive-title">${q.definition.title}</span>
                    </div>
                    <div class="directive-instruction">
                        ${q.currentStage.instruction}
                    </div>
                    ${!isDone && q.currentStage.hint ? `<div class="directive-hint">${q.currentStage.hint}</div>` : ''}
                </div>
            </div>
        `;
    });

    FTUE_DIRECTIVES.forEach((d) => {
        const isDone = d.id < currentStep;
        const isActive = d.id === currentStep;
        const isLocked = d.id > currentStep;

        const statusClass = isDone ? 'done' : (isActive ? 'active' : 'locked');
        const checkmark = isDone ? '✔' : (isActive ? '◉' : '○');

        html += `
            <div class="directive-card ${statusClass}" data-step="${d.id}">
                <div class="directive-status-icon">${checkmark}</div>
                <div class="directive-body">
                    <div class="directive-header">
                        <span class="directive-badge">${d.badge}</span>
                        <span class="directive-title">${d.title}</span>
                    </div>
                    <div class="directive-instruction">${d.instruction}</div>
                    ${isActive ? `<div class="directive-hint">${d.hint}</div>` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

export function advanceFtueStep(targetStep: number) {
    const current = STATE.ftueStep || 0;
    if (targetStep > current) {
        STATE.ftueStep = targetStep;

        // Flash celebratory animation or log
        const completedDirective = FTUE_DIRECTIVES[current];
        if (completedDirective) {
            addLogEntry("SYSTEM", `Direktive erfüllt: [${completedDirective.title}] ✔`);
        }

        if (targetStep >= FTUE_DIRECTIVES.length) {
            STATE.ftueCompleted = true;
            addLogEntry("SYSTEM", "Alle Einführungs-Direktiven abgeschlossen. Das Schicksal der Galaxie liegt in deinen Händen.");
        }

        renderDirectives();
    }
}

export function triggerVoyagerSignalDetection() {
    if (STATE.voyagerSignalDetected) return;
    STATE.voyagerSignalDetected = true;

    try {
        playVoyagerBeaconPing();
    } catch (e) {}

    addLogEntry("NAJMAFAR", "„Dieses System ist erstarrt... Niemand ist hier. Nur die Kälte der Leere.“");
    addLogEntry("SENSOR", "ANOMALIE DETEKTIERT: Schwache elektromagnetische Trägerwelle (1420 MHz) empfangen!");
    addLogEntry("SYSTEM", "Archaische Signalquelle am Systemrand geortet. UNBEKANNTES SIGNAL auf Radar und Nav-Tracker aufgeschaltet!");

    advanceFtueStep(2);
}

export function updateVoyagerHUDTracker() {
    const trackerEl = document.getElementById('voyager-nav-tracker');
    if (!trackerEl) return;

    const titleEl = trackerEl.querySelector('.voyager-tracker-title') as HTMLElement;
    const distEl = document.getElementById('voyager-nav-dist');
    const angleEl = document.getElementById('voyager-nav-arrow');
    const playerPos = STATE.playerPosition;

    // 1. Target Jamal's Ship if quest is active and not yet liberated
    if (STATE.jamalMissionActive && !STATE.jamalShipLiberated && STATE.jamalShip && STATE.jamalShip.position) {
        const shipPos = STATE.jamalShip.position;
        const dx = shipPos.x - playerPos.x;
        const dz = shipPos.z - playerPos.z;
        const dist = Math.hypot(dx, dz);

        trackerEl.style.display = 'flex';
        if (titleEl) {
            if (STATE.jamalShip.isRealShipAtDepot) {
                titleEl.innerText = "ECHTE IBN BATTUTA (PIER 4)";
            } else if (STATE.jamalDecoyRevealed) {
                titleEl.innerText = "KÖDER-ATTRAPPE (ALARM)";
            } else {
                titleEl.innerText = "JAMALS SCHIFF (ORBIT)";
            }
        }
        if (distEl) distEl.innerText = `${dist.toFixed(1)} AE`;

        if (angleEl) {
            const targetAngle = Math.atan2(dz, dx);
            const heading = STATE.shipHeading || 0;
            const relativeAngleDeg = ((targetAngle - heading) * 180 / Math.PI);
            angleEl.style.transform = `rotate(${relativeAngleDeg}deg)`;
        }
        return;
    }

    // 2. Target Voyager 2 Probe at depot if not yet liberated
    if (STATE.voyagerProbe && STATE.voyagerProbe.position && !STATE.voyagerLiberated) {
        const probePos = STATE.voyagerProbe.position;
        const dx = probePos.x - playerPos.x;
        const dz = probePos.z - playerPos.z;
        const dist = Math.hypot(dx, dz);

        trackerEl.style.display = 'flex';
        if (titleEl) {
            titleEl.innerText = "VOYAGER 2 (SCHROTTPFAND)";
        }
        if (distEl) distEl.innerText = `${dist.toFixed(1)} AE`;

        if (angleEl) {
            const targetAngle = Math.atan2(dz, dx);
            const heading = STATE.shipHeading || 0;
            const relativeAngleDeg = ((targetAngle - heading) * 180 / Math.PI);
            angleEl.style.transform = `rotate(${relativeAngleDeg}deg)`;
        }
        return;
    }

    trackerEl.style.display = 'none';
}
