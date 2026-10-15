import { STATE } from '../core/state';
import { playSonarChime, playSynapseEvolveSound, playEmpChargeSound, playLockOnSound } from '../engine/audio';
import { addLogEntry, updateHUDStats } from './hud';
import { advanceFtueStep, renderDirectives } from './directives';

let isDialogOpen = false;

export function isJamalDialogOpen(): boolean {
    return isDialogOpen;
}

/**
 * Opens the initial telepathic mission brief from Dr. Jamal
 * right after Najmafar breaks out from the Intergalactic Zoo.
 */
export function openJamalIntroDialog() {
    if (STATE.jamalIntroModalSeen) return;
    STATE.jamalIntroModalSeen = true;
    STATE.jamalMissionActive = true;

    const modal = document.getElementById('jamal-telepathic-modal');
    if (!modal) return;

    isDialogOpen = true;
    modal.style.display = 'flex';

    // Populate with Intro narrative
    const titleEl = document.getElementById('jamal-dialog-title');
    const badgeEl = document.getElementById('jamal-dialog-status-badge');
    const narrativeEl = document.getElementById('jamal-dialog-narrative');
    const confirmBtn = document.getElementById('jamal-dialog-confirm-btn');

    if (titleEl) titleEl.innerText = "DAS VERSTECKTE FORSCHUNGSSCHIFF & DIE PARKRAUM-DROHNEN";
    if (badgeEl) {
        badgeEl.innerText = "🚨 ORBITAL-NOTRUF";
        badgeEl.className = "jamal-status-badge alert";
    }

    if (narrativeEl) {
        narrativeEl.innerHTML = `
            <div class="jamal-speech-bubble">
                <p>
                    „Najmafar! Hörst du mich in deinen Synapsen? Die psionische Kopplung steht... aber wir haben direkt ein absurdes Problem!
                </p>
                <p>
                    Ich bin nur mit einem unauffälligen Zivil-Touristenshuttle zur Menagerie gereist, um keine Aufmerksamkeit der Psionischen Gilde zu erregen. 
                    Mein eigentliches Forschungsschiff – die <strong>ISS Ibn Battuta</strong>, vollgepackt mit Quantensensoren, meinen Forschungsaufzeichnungen und 
                    wertvollem <strong>Melange-Gewürz</strong> – habe ich im Orbit des nahen Planeten versteckt!
                </p>
                <div class="jamal-highlight-box">
                    <span class="highlight-icon">⚠️</span>
                    <div>
                        <strong>Die Plage der galaktischen Parkraumüberwachung:</strong><br>
                        Dieses System wird von durchgedrehten, autonomen KI-Abschleppdrohnen patrouilliert! Sie jagen Falschparker im Vakuum! 
                        Mein Schiff hat keine Parkvignette und wurde bereits mit einer <strong>orbitalen Parkkralle</strong> festgesetzt!
                    </div>
                </div>
                <p>
                    Wir müssen sofort zum nahen Planeten fliegen und mein Schiff befreien, bevor die Drohnen es zerlegen oder in den Schrottsektor abschleppen!“
                </p>
            </div>
        `;
    }

    if (confirmBtn) {
        confirmBtn.innerText = "🚀 Kurs auf den Planeten setzen & Schiff befreien";
    }

    try {
        playSonarChime();
    } catch (e) {}

    addLogEntry("JAMAL", "„Najmafar! Meine neuronale Kopplung steht. Mein Forschungsschiff im Planetenorbit wurde als Falschparker festgesetzt! Wir müssen es retten!“");
    renderDirectives();
}

/**
 * Triggers the liberation of Dr. Jamal's research shuttle:
 * Shuts down the rogue AI drone, breaks the tow-clamp, grants rewards,
 * and opens the celebratory telepathic dialogue.
 */
export function liberateJamalShip() {
    if (STATE.jamalShipLiberated) return;
    STATE.jamalShipLiberated = true;
    STATE.jamalMissionCompleted = true;

    // 1. Play audio cues
    try {
        playEmpChargeSound();
        setTimeout(() => playSynapseEvolveSound(), 350);
        setTimeout(() => playSonarChime(), 700);
    } catch (e) {}

    // 2. Overload the towing drone & liberate ship mesh
    if (STATE.towingDrone && STATE.towingDrone.triggerOverload) {
        STATE.towingDrone.triggerOverload();
        STATE.towingDrone.name = "KI-Abschleppdrohne TX-9 [SYSTEMFEHLER / DEAKTIVIERT]";
    }

    if (STATE.jamalShip) {
        if (STATE.jamalShip.setLiberated) {
            STATE.jamalShip.setLiberated(true);
        }
        STATE.jamalShip.name = "Forschungsschiff 'ISS Ibn Battuta' [GEBORGEN]";
    }

    // 3. Resource & psionic reward bonus
    const spiceBonus = 50;
    const siliconBonus = 60;
    const mentalBonus = 40;

    STATE.spiceRes = (STATE.spiceRes || 0) + spiceBonus;
    STATE.bioRes = (STATE.bioRes || 0) + spiceBonus;
    STATE.siliconRes = (STATE.siliconRes || 0) + siliconBonus;
    STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, (STATE.mentalEnergy || 50) + mentalBonus);
    STATE.loneliness = Math.max(5, (STATE.loneliness || 30) - 20);

    updateHUDStats();

    // 4. Log events
    addLogEntry("PARK-KI", "⚡ [SYSTEMFEHLER 0xPARK_VOID]: Bio-Leviathan verweigert Annahme des Bußgeldbescheids! Schaltkreise durch psionischen Impuls überlastet!");
    addLogEntry("SYSTEM", `🎉 FORSCHUNGSSCHIFF BEFREIT: +${spiceBonus} Melange-Gewürz | +${siliconBonus} Silizium | +${mentalBonus} Mentalkraft!`);
    addLogEntry("JAMAL", "„Haha! Du hast die Parkkralle einfach mit Psionik zerquetscht! Meine Ausrüstung und das Melange sind gesichert!“");

    // 5. Open celebratory dialog
    openJamalLiberatedDialog();

    // 6. Advance quest progression
    advanceFtueStep(2);
}

/**
 * Opens celebratory dialog upon freeing Jamal's ship.
 */
export function openJamalLiberatedDialog() {
    const modal = document.getElementById('jamal-telepathic-modal');
    if (!modal) return;

    isDialogOpen = true;
    modal.style.display = 'flex';

    const titleEl = document.getElementById('jamal-dialog-title');
    const badgeEl = document.getElementById('jamal-dialog-status-badge');
    const narrativeEl = document.getElementById('jamal-dialog-narrative');
    const confirmBtn = document.getElementById('jamal-dialog-confirm-btn');

    if (titleEl) titleEl.innerText = "FORSCHUNGSLABOR GEBORGEN & SENSOREN SYNCHRONISIERT";
    if (badgeEl) {
        badgeEl.innerText = "✨ SCHIFF BEFREIT";
        badgeEl.className = "jamal-status-badge success";
    }

    if (narrativeEl) {
        narrativeEl.innerHTML = `
            <div class="jamal-speech-bubble">
                <p>
                    „Fantastisch, Najmafar! Du hast die Abschleppkralle einfach mit deiner Biomasse zerquetscht! 
                    Die Drohnen-KI hat einen kompletten Kernel-Panic erlitten!“
                </p>
                <div class="jamal-reward-grid">
                    <div class="reward-pill">✨ <strong>+50 Melange</strong> (Gewürz-Vorrat)</div>
                    <div class="reward-pill">💎 <strong>+60 Silizium</strong> (Quanten-Chips)</div>
                    <div class="reward-pill">🧠 <strong>+40 Mentalkraft</strong> (Psyche gestärkt)</div>
                </div>
                <p>
                    Ich habe die Quantensensoren der <em>ISS Ibn Battuta</em> direkt mit deinem neuralen Netzwerk gekoppelt. 
                    Unsere Sensorreichweite hat sich verdreifacht!
                </p>
                <div class="jamal-highlight-box blue">
                    <span class="highlight-icon">📡</span>
                    <div>
                        <strong>Sensorik schlägt an:</strong><br>
                        Warte... jetzt, wo die Hauptantennen online sind: Ich fange ein archaisches, moduliertes Funksignal am Rand dieses Sternensystems auf! 
                        Das stammt nicht von den Fremdwelten... das klingt menschlich!
                    </div>
                </div>
            </div>
        `;
    }

    if (confirmBtn) {
        confirmBtn.innerText = "🔭 Signal analysieren & System erkunden";
    }
}

export function closeJamalDialog() {
    const modal = document.getElementById('jamal-telepathic-modal');
    if (!modal) return;

    isDialogOpen = false;
    modal.style.display = 'none';
    renderDirectives();
}

export function initJamalDialogListeners() {
    const modal = document.getElementById('jamal-telepathic-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeJamalDialog();
            }
        });
    }

    const closeBtn = document.getElementById('close-jamal-dialog-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeJamalDialog();
        });
    }

    const confirmBtn = document.getElementById('jamal-dialog-confirm-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeJamalDialog();
        });
    }

    window.addEventListener('keydown', (e) => {
        if (!isDialogOpen) return;
        if (e.key === 'Escape' || e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
            e.preventDefault();
            closeJamalDialog();
        }
    });
}
