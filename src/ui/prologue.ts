import { STATE } from '../core/state';
import { CrewMember } from '../types/game';
import { 
    playHeartbeatPulse, 
    playSynapseHoverSound, 
    playSynapseEvolveSound, 
    playCrashSound, 
    playSonarChime, 
    playFleetAlarmSound, 
    playWarpSpoolSound, 
    playWarpSnapSound, 
    playWarpDropoutSound 
} from '../engine/audio';
import { addLogEntry } from './hud';
import { renderCrewUI } from '../systems/crew';
import { renderDirectives } from './directives';
import { openJamalIntroDialog } from './jamal-dialog';
import { initMenagerieScene, shatterMenagerie, cleanupMenagerieScene, isMenagerieActive, menagerieGroup } from '../procedural/menagerie-scene';
import { scene } from '../engine/scene';
import { clearActiveSystem, spawnPlanetsAndAsteroids } from '../systems/universe';
import storyData from '../data/prologue_story.json';

export interface PrologueBeat {
    id: string;
    act: string;
    stage: 'office_dream' | 'alien_zoo' | 'jamal_contact' | 'absorption_sync' | 'breakout_warp';
    eyebrow: string;
    stepCounter: string;
    mainText: string;
    subText: string;
    sound?: 'heartbeat' | 'glitch' | 'sonar' | 'synapse' | 'alarm' | 'warp';
    speakerType?: 'narrator' | 'character' | 'guide' | 'thoughts' | 'alert' | 'harmonize' | 'climax';
    speakerName?: string;
    options: {
        label: string;
        action: string;
        keyHint?: string;
    }[];
}

const PROLOGUE_BEATS: PrologueBeat[] = storyData.beats as PrologueBeat[];

let isPrologueActive = false;
let currentBeatIndex = 0;
let onCompleteCallback: (() => void) | null = null;

export function isPrologueRunning(): boolean {
    return isPrologueActive;
}

export function getCurrentPrologueBeatIndex(): number {
    return currentBeatIndex;
}

export function getPrologueBeats(): PrologueBeat[] {
    return PROLOGUE_BEATS;
}

export function triggerPrologueSequence(onComplete: () => void) {
    const overlay = document.getElementById('prologue-overlay');
    if (!overlay) {
        recruitJamal();
        onComplete();
        return;
    }

    isPrologueActive = true;
    STATE.prologueActive = true;
    STATE.prologueCompleted = false;
    onCompleteCallback = onComplete;
    currentBeatIndex = 0;

    // Completely hide all in-game space UI / HUD elements during prologue
    if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('prologue-mode');
    }

    // Clear any previous star system and initialize 3D Menagerie Scene Enclosure around player
    if (scene) {
        clearActiveSystem();
        initMenagerieScene(scene);
        if (menagerieGroup) {
            menagerieGroup.visible = false; // Hidden during Act I (office dream)
        }
    }

    // Keep ship parked inside menagerie containment at leviathan scale
    STATE.playerPosition.set(0, 0, 0);
    STATE.playerVelocity.set(0, 0, 0);
    if (STATE.playerGroup) {
        STATE.playerGroup.position.set(0, 0, 0);
        STATE.playerGroup.scale.set(2.4, 2.4, 2.4);
    }

    overlay.classList.remove('hidden', 'fade-out');
    overlay.classList.add('visible');

    renderBeat(currentBeatIndex);
}

function renderBeat(index: number) {
    if (index < 0 || index >= PROLOGUE_BEATS.length) {
        finishPrologue();
        return;
    }

    currentBeatIndex = index;
    STATE.prologueStep = index;
    const beat = PROLOGUE_BEATS[index];
    STATE.prologueStage = beat.stage;

    const overlay = document.getElementById('prologue-overlay');
    const eyebrowText = document.getElementById('prologue-eyebrow-text');
    const speakerBadge = document.getElementById('prologue-speaker-badge');
    const mainTextEl = document.getElementById('prologue-main-text');
    const subTextEl = document.getElementById('prologue-sub-text');
    const stepCounterEl = document.getElementById('prologue-step-counter');
    const choicesContainer = document.getElementById('prologue-choices-container');

    if (overlay) {
        overlay.classList.remove('stage-office', 'stage-zoo', 'stage-jamal', 'stage-sync', 'stage-warp');
        const stageClass = beat.stage === 'office_dream' ? 'office' 
            : beat.stage === 'alien_zoo' ? 'zoo' 
            : beat.stage === 'jamal_contact' ? 'jamal' 
            : beat.stage === 'absorption_sync' ? 'sync'
            : 'warp';
        overlay.classList.add(`stage-${stageClass}`);
    }

    if (menagerieGroup) {
        menagerieGroup.visible = beat.stage !== 'office_dream';
    }

    if (eyebrowText) eyebrowText.innerText = beat.eyebrow;
    if (stepCounterEl) stepCounterEl.innerText = beat.stepCounter;

    // Speaker Badge
    if (speakerBadge) {
        if (beat.speakerName) {
            speakerBadge.style.display = 'inline-block';
            speakerBadge.className = `prologue-speaker-badge speaker-${beat.speakerType || 'character'}`;
            speakerBadge.innerText = beat.speakerName;
        } else {
            speakerBadge.style.display = 'none';
        }
    }

    if (mainTextEl) {
        mainTextEl.classList.remove('fade-in');
        void mainTextEl.offsetWidth;
        mainTextEl.innerText = beat.mainText;
        mainTextEl.classList.add('fade-in');
    }

    if (subTextEl) {
        subTextEl.classList.remove('fade-in');
        void subTextEl.offsetWidth;
        subTextEl.innerText = beat.subText;
        subTextEl.classList.add('fade-in');
    }

    // Play associated sound
    try {
        if (beat.sound === 'heartbeat') playHeartbeatPulse();
        else if (beat.sound === 'synapse') playSynapseHoverSound(580);
        else if (beat.sound === 'sonar') playSonarChime();
        else if (beat.sound === 'alarm') playFleetAlarmSound();
    } catch (e) {
        // Audio might still be warming up
    }

    // Render interactive options / buttons
    if (choicesContainer) {
        choicesContainer.innerHTML = '';

        beat.options.forEach((opt) => {
            const btn = document.createElement('button');
            const isClimax = opt.action === 'warp_breakout' || opt.action === 'harmonize_sync';
            btn.className = isClimax ? 'prologue-action-btn' : 'prologue-choice-btn';

            const badgeHtml = opt.keyHint ? `<span class="prologue-choice-badge">${opt.keyHint}</span>` : '';
            btn.innerHTML = `${badgeHtml}<span>${opt.label}</span>`;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleOptionAction(opt.action);
            });

            choicesContainer.appendChild(btn);
        });
    }
}

function handleOptionAction(action: string) {
    try {
        playSynapseHoverSound(660);
    } catch (e) {}

    if (action === 'next') {
        renderBeat(currentBeatIndex + 1);
    } else if (action === 'glitch_transition') {
        triggerGlitchRealityTear();
    } else if (action === 'harmonize_sync') {
        triggerHarmonizeSync();
    } else if (action === 'warp_breakout') {
        triggerWarpBreakout();
    } else {
        // Dynamic navigation to target beat by ID!
        const targetIdx = PROLOGUE_BEATS.findIndex(b => b.id === action);
        if (targetIdx !== -1) {
            renderBeat(targetIdx);
        } else {
            console.warn(`Prologue: Target beat id '${action}' not found, advancing to next beat.`);
            renderBeat(currentBeatIndex + 1);
        }
    }
}

function triggerGlitchRealityTear() {
    const flash = document.getElementById('prologue-glitch-flash');
    const overlay = document.getElementById('prologue-overlay');

    try {
        playCrashSound();
        playSynapseEvolveSound();
    } catch (e) {}

    if (flash) {
        flash.classList.add('flash-active');
        setTimeout(() => flash.classList.remove('flash-active'), 500);
    }

    if (overlay) {
        overlay.classList.add('screen-shake-intense');
        setTimeout(() => overlay.classList.remove('screen-shake-intense'), 550);
    }

    setTimeout(() => {
        const zooIdx = PROLOGUE_BEATS.findIndex(b => b.id === 'zoo_awakening_voices');
        if (zooIdx !== -1) renderBeat(zooIdx);
        else renderBeat(currentBeatIndex + 1);
    }, 450);
}

function triggerHarmonizeSync() {
    const flash = document.getElementById('prologue-glitch-flash');
    const overlay = document.getElementById('prologue-overlay');

    try {
        playSynapseEvolveSound();
        playSonarChime();
    } catch (e) {}

    if (flash) {
        flash.classList.add('flash-active');
        setTimeout(() => flash.classList.remove('flash-active'), 400);
    }

    if (overlay) {
        overlay.classList.add('screen-shake-intense');
        setTimeout(() => overlay.classList.remove('screen-shake-intense'), 400);
    }

    setTimeout(() => {
        const breakoutIdx = PROLOGUE_BEATS.findIndex(b => b.id === 'breakout_escape');
        if (breakoutIdx !== -1) renderBeat(breakoutIdx);
        else renderBeat(currentBeatIndex + 1);
    }, 350);
}

function triggerWarpBreakout() {
    const flash = document.getElementById('prologue-glitch-flash');
    const overlay = document.getElementById('prologue-overlay');

    try {
        playWarpSpoolSound();
        setTimeout(() => playWarpSnapSound(), 500);
        setTimeout(() => playWarpDropoutSound(), 1000);
    } catch (e) {}

    if (flash) {
        flash.classList.add('flash-active');
    }

    if (overlay) {
        overlay.classList.add('screen-shake-intense');
    }

    // Shatter the 3D Menagerie rings and containment
    if (scene) {
        shatterMenagerie(scene);
    }

    setTimeout(() => {
        finishPrologue();
    }, 1100);
}

export function recruitJamal(): CrewMember {
    const existing = STATE.crew.find(c => c.name === 'Dr. Jamal' || c.id === 101);
    if (existing) return existing;

    const jamal: CrewMember = {
        id: 101,
        name: "Dr. Jamal",
        species: "Mensch (Sol-Terraner)",
        speciesArchetypeName: "Mensch (Sol-Terraner)",
        speciesType: "mortal",
        disposition: "scholarly",
        role: "psychologist",
        roleName: "Chef-Quantenphysiker & Co-Pilot",
        roleIcon: "⚛️",
        buffDesc: "Entschlüsselt Ising-Gitter, stabilisiert Najmafars Psyche (-25% Stress) und führt Tiefenscans durch.",
        stress: 15,
        baseStressRate: 0.02,
        illusionStability: 92,
        status: "Aktiv an Bord",
        thought: "Die Vollbremsung an Sagittarius A* ist real. Wir müssen die Erde retten und Najmafar vor dem Rückfall in die Apathie bewahren.",
        age: 31 * 365 * 24 * 3600, // 31 Jahre alt
        maxLifespan: 85 * 365 * 24 * 3600,
        ageCategory: "vital",
        trait: {
            name: "Quanten-Theoretiker",
            desc: "Ermöglicht planetare Tiefenscans und dämpft psionische Traumata.",
            type: "psionic"
        },
        station: 'dream_core',
        stationName: 'Traum-Kern (Neuronale Brücke)',
        stationActivity: 'Kalibriert Quanten-Sensoren & stabilisiert Psyche',
        avatarIcon: '👨‍🚀',
        speciesColor: '#38bdf8'
    };

    STATE.crew.unshift(jamal);
    STATE.loneliness = Math.min(STATE.loneliness, 45); // Jamal cures profound solitude!
    renderCrewUI();

    addLogEntry("CREW", "👨‍🚀 Dr. Jamal im Traum-Kern verankert: „Wir haben es geschafft, Najmafar! Meine Scanner sind online.“");
    addLogEntry("SYSTEM", "⚛️ Tiefenscan-Protokolle aktiv: Tech, H₂O, Legierungen & Shuttle-Expeditionen auf Planeten freigeschaltet!");

    return jamal;
}

export function finishPrologue() {
    if (!isPrologueActive) return;
    isPrologueActive = false;
    STATE.prologueActive = false;
    STATE.prologueCompleted = true;
    STATE.prologueStage = 'completed';

    // Restore in-game space HUD
    if (typeof document !== 'undefined' && document.body) {
        document.body.classList.remove('prologue-mode');
    }

    // Clean up menagerie if still present
    if (scene && isMenagerieActive()) {
        cleanupMenagerieScene(scene);
    }

    // Spawn planets in Perseus-Rand if not spawned
    if (STATE.universe) {
        clearActiveSystem();
        spawnPlanetsAndAsteroids();
    }

    // Safe standoff spawn orbit (NEVER in the sun at 0,0,0!)
    // Place ship at z = 160 with tangential orbital velocity (1.5, 0, 0)
    STATE.playerPosition.set(0, 0, 160);
    STATE.playerVelocity.set(1.5, 0, 0);
    STATE.shipHeading = 0;
    STATE.progradeVector.set(1, 0, 0);
    if (STATE.playerGroup) {
        STATE.playerGroup.position.set(0, 0, 160);
        STATE.playerGroup.rotation.y = 0;
        STATE.playerGroup.scale.set(0.42, 0.42, 0.42);
    }

    // Recruit Dr. Jamal as the guaranteed starting co-pilot!
    recruitJamal();

    const overlay = document.getElementById('prologue-overlay');
    if (overlay) {
        overlay.classList.remove('visible', 'screen-shake-intense');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.classList.remove('fade-out');
            overlay.classList.add('hidden');
        }, 800);
    }

    renderDirectives();

    // Trigger Dr. Jamal's telepathic mission brief shortly after escaping into space
    setTimeout(() => {
        openJamalIntroDialog();
    }, 1200);

    if (onCompleteCallback) {
        const cb = onCompleteCallback;
        onCompleteCallback = null;
        cb();
    }
}

export function initPrologueListeners() {
    const skipBtn = document.getElementById('skip-prologue-btn');
    if (skipBtn) {
        skipBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            finishPrologue();
        });
    }

    window.addEventListener('keydown', (e) => {
        if (!isPrologueActive) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            finishPrologue();
            return;
        }

        const beat = PROLOGUE_BEATS[currentBeatIndex];
        if (!beat) return;

        // Number keys 1..9
        const keyNum = parseInt(e.key, 10);
        if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= beat.options.length) {
            e.preventDefault();
            handleOptionAction(beat.options[keyNum - 1].action);
            return;
        } else if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            const lastOpt = beat.options[beat.options.length - 1];
            if (lastOpt) {
                handleOptionAction(lastOpt.action);
            }
        }
    });
}
