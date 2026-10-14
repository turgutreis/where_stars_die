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

export interface PrologueBeat {
    id: string;
    stage: 'office_dream' | 'alien_zoo' | 'jamal_contact' | 'breakout_warp';
    eyebrow: string;
    stepCounter: string;
    mainText: string;
    subText: string;
    sound?: 'heartbeat' | 'glitch' | 'sonar' | 'synapse' | 'alarm' | 'warp';
    options: {
        label: string;
        action: 'next' | 'glitch_transition' | 'warp_breakout';
        keyHint?: string;
    }[];
}

const PROLOGUE_BEATS: PrologueBeat[] = [
    // ==========================================
    // AKT I: DIE TRAUM-EBENE (DAS NÄCHTLICHE BÜRO)
    // ==========================================
    {
        id: 'office_stars',
        stage: 'office_dream',
        eyebrow: '🖥️ ASTROPHYSIKALISCHES INSTITUT • 23:47 UHR',
        stepCounter: 'Szene 1 / 10 • Akt I: Das Büro',
        mainText: '23:47 Uhr. Das Observatorium liegt im Halbdunkel.',
        subText: 'Auf deinen holografischen Bildschirmen flackern die Spektren der kosmischen Hintergrundstrahlung. Es ist kein Messfehler: Weit entfernte Galaxienhaufen zeigen keine Rotverschiebung mehr. Das Universum driftet durch die Dunkle Energie unaufhaltsam auseinander. Die Sterne sterben nicht an Altersschwäche – sie sterben, weil ihr Licht kein sehendes Auge mehr erreichen wird. Eine endlose, eisige Einsamkeit breitet sich im Vakuum aus.',
        sound: 'heartbeat',
        options: [
            { label: 'Spektrogramm der Dunklen Energie kalibrieren & Simulation verifizieren', action: 'next', keyHint: '1' }
        ]
    },
    {
        id: 'office_knock',
        stage: 'office_dream',
        eyebrow: '🚪 BÜROTRAKT B • DR. ARIS',
        stepCounter: 'Szene 2 / 10 • Akt I: Das Büro',
        mainText: 'Ein trockenes Klopfen zerreißt die Stille.',
        subText: 'Dein Kollege Dr. Aris schiebt die schwere Glastür auf und mustert deine geröteten Augen. „Immer noch hier? Mach Feierabend. Der Wachdienst schaltet gleich das Hauptlicht im gesamten Trakt ab. ... Und ganz unter uns: Zeig diese Zahlen morgen nicht im Fakultätsrat. Die da oben wollen keine Panik.“ Er nickt dir ernst zu und geht. Hinter ihm erlöschen die Deckenleuchten des Flurs eine nach der anderen.',
        sound: 'synapse',
        options: [
            { label: 'Dr. Aris zunicken & den Schreibtisch aufräumen', action: 'next', keyHint: '1' }
        ]
    },
    {
        id: 'office_drink',
        stage: 'office_dream',
        eyebrow: '🥤 DER SCHREIBTISCH • EINE KÜHLE DOSE',
        stepCounter: 'Szene 3 / 10 • Akt I: Das Büro',
        mainText: 'Ein brennender Durst schnürt dir die Kehle zu.',
        subText: 'Neben der Tastatur steht eine ungeöffnete Dose Energy Drink, an deren Metall kaltes Kondenswasser herabperlt. Du greifst danach, ziehst die Lasche auf und nimmst einen gierigen Schluck. Doch der Geschmack ist unmöglich: Scharf wie Ozon, schneidend wie flüssiges Helium, uralt wie Sternenstaub. Dein Herz rast. Deine Schläfen explodieren im Takt pulsierender Quasare!',
        sound: 'heartbeat',
        options: [
            { label: 'Die Dose fallen lassen & dem Schwindel nachgeben...', action: 'glitch_transition', keyHint: '1' }
        ]
    },

    // ==========================================
    // AKT II: DAS ERWACHEN (DER INTERGALAKTISCHE ZOO)
    // ==========================================
    {
        id: 'zoo_awakening',
        stage: 'alien_zoo',
        eyebrow: '🛸 MENAGERIE VON CERES-9 • DÄMPFUNGSKÄFIG 0-ALPHA • ASCHE-GILDE',
        stepCounter: 'Szene 4 / 10 • Akt II: Der Alien-Zoo',
        mainText: 'Die Illusion zersplittert. Du bist kein Mensch.',
        subText: 'Mit einem brutalen Ruck stürzt die echte Realität über dein Bewusstsein ein. Du bist Najmafar. Ein gigantischer, bio-organischer Leviathan aus den Abgründen des Vakuums – über drei Kilometer lang, massiv wie ein imperialer Sternenzerstörer oder Manhattan, mit uralten Chitin-Panzern und glühenden Nervensträngen. Und du schwebst in einem zylindrischen Käfig aus rotierenden Plasma-Dämpfungsfeldern!',
        sound: 'sonar',
        options: [
            { label: 'Die Sinne durch die Plasma-Barriere tasten lassen', action: 'next', keyHint: '1' }
        ]
    },
    {
        id: 'zoo_fans',
        stage: 'alien_zoo',
        eyebrow: '👁️ DIE ZUSCHAUER-TRIBÜNEN • DIE GROSSE ATTRAKTION',
        stepCounter: 'Szene 5 / 10 • Akt II: Der Alien-Zoo',
        mainText: 'Zehntausende fremdartige Augen starren auf dich herab.',
        subText: 'Du bist die Hauptattraktion des intergalaktischen Zirkus. Alien-Enthusiasten und Schaulustige aus jedem Sektor drängen sich auf den schwebenden Aussichtsplattformen hinter den Energieschilden. Lautsprecher dröhnen: „DIE BESTIE DES LEERRAUMS – TELEPATHISCHE SITZUNGEN FÜR 50 CREDITS!“ Doch die Touristen, die sich wagen, telepathisch mit dir in Kontakt zu treten, brechen unter der unermesslichen Tragik deines Wissens zusammen: Ihr Verstand brennt durch, und Stations-Sanitäter schleifen sie als sabbernde Lappen von den Plattformen.',
        sound: 'synapse',
        options: [
            { label: 'Die Schmerzen an deinen Chitin-Flossen spüren', action: 'next', keyHint: '1' }
        ]
    },
    {
        id: 'zoo_whalers',
        stage: 'alien_zoo',
        eyebrow: '🩸 ASCHE-GILDE BIO-HARVESTER • VIVISEKTION',
        stepCounter: 'Szene 6 / 10 • Akt II: Der Alien-Zoo',
        mainText: 'Automatische Plasmasägen ritzen an deinen Flossen.',
        subText: 'Walfänger-Drohnen der Asche-Gilde zapfen dein Rückenmark als Quanten-Kühlmittel ab und schmelzen Chitin für Kriegsschiffe ein. Warum hast du dich fangen lassen? Weil du die Sterne sterben sahst. Weil du deine Heimat nicht mehr erreichen konntest. In deiner bodenlosen kosmischen Depression hattest du dich einfach aufgegeben. Es war dir schlicht egal gewesen – bis jetzt.',
        sound: 'heartbeat',
        options: [
            { label: 'Eine fremde, menschliche Präsenz wahrnehmen...', action: 'next', keyHint: '1' }
        ]
    },

    // ==========================================
    // AKT III: JAMAL & DIE GILDE DER PSIONISCH VERSCHRÄNKTEN
    // ==========================================
    {
        id: 'jamal_voice',
        stage: 'jamal_contact',
        eyebrow: '👤 SUBRAUM-RESONANZ • DR. JAMAL',
        stepCounter: 'Szene 7 / 10 • Akt III: Jamal & Die Gilde',
        mainText: '„Najmafar! Hörst du mich? Jamal hier!“',
        subText: 'Direkt vor deinem riesigen Hauptauge steht ein menschlicher Quantenphysiker im verschmierten Techniker-Anzug auf einem Wartungssteg. Auf seiner Brust summt ein modifizierter tragbarer Quantencomputer. Er blickt furchtlos in deine gigantische, glühende Pupille: „Das Melange-Spice in deinem Nährstoffinjektor ... es hat gewirkt! Dein Bewusstsein ist zurück!“',
        sound: 'synapse',
        options: [
            { label: 'Jamals telepathische Frequenz öffnen', action: 'next', keyHint: '1' }
        ]
    },
    {
        id: 'jamal_echo',
        stage: 'jamal_contact',
        eyebrow: '📡 DAS ECHO-SIGNAL • 200 JAHRE VERGANGENHEIT',
        stepCounter: 'Szene 8 / 10 • Akt III: Jamal & Die Gilde',
        mainText: '„Wir reisen auf den Schultern deines Volkes!“',
        subText: '„Vor zweihundert Jahren hat dein Volk – die Mu\'ammirun – das adaptive Echo-Signal gesandt! Die Menschheit hat eure Botschaft nicht verstanden, aber wir haben den Algorithmus ausgeschlachtet. Unsere gesamte interstellare Raumfahrt, meine Quantenrechner, unsere Sprungtore ... alles basiert auf eurer Technologie! Doch jetzt seid ihr fast alle verschwunden.“',
        sound: 'sonar',
        options: [
            { label: '„Warum bist du hier, Jamal? Was droht uns?“', action: 'next', keyHint: '1' }
        ]
    },
    {
        id: 'jamal_threat',
        stage: 'jamal_contact',
        eyebrow: '⚠️ DOCK 7 • ANKUNFT DER SCHLÄCHTER',
        stepCounter: 'Szene 9 / 10 • Akt III: Jamal & Die Gilde',
        mainText: '„Sie wollen dein Gehirn lebendig herausschneiden.“',
        subText: '„Die Gilde der Psionisch Verschränkten hat an Dock 7 angelegt! Sie haben dich der Asche-Gilde abgekauft. Ein Bio-Skalpell-Team ist im Anmarsch, um dein zentrales Nervensystem als biologischen Subraum-Rechner für ihre Flotte auszubauen! Und das ist noch nicht alles: Das Universum stirbt nicht an Ausdehnung – Sagittarius A* drückt auf die Vollbremsung! Tödliche Magnetare grillen ganze Sektoren! Du bist das einzige Wesen, das die Raumzeit falten kann. Jamal braucht dich ... und du brauchst eine Crew, damit du nicht wieder in den Wahn verfällst!“',
        sound: 'alarm',
        options: [
            { label: 'Die Stations-Sirenen heulen auf! Notfall-Alarm!', action: 'next', keyHint: '1' }
        ]
    },
    {
        id: 'jamal_breakout',
        stage: 'breakout_warp',
        eyebrow: '🚨 ROT-ALARM • EINDÄMMUNGS-KOLLAPS • STATION CERES-9',
        stepCounter: 'Szene 10 / 10 • Akt III: Jamal & Die Gilde',
        mainText: '„NAJMAFAR! FALTE DEN RAUM! JETZT!“',
        subText: 'Schwere Ionen-Geschütze der Asche-Gilde feuern auf Dr. Jamal! Er hechtet über das Geländer der Wartungsrampe und klammert sich an die Chitin-Schuppen deiner dorsalen Atemöffnung: „Sie fluten den Käfig mit Neurotoxin! Spring! Wir treffen uns im Perseus-Rand wieder!“ Das Spice brennt in deinem Blut wie flüssiges Plasma. Deine psionischen Flügel spannen sich. Die Raumzeit beginnt zu zersplittern.',
        sound: 'alarm',
        options: [
            { label: '⚡ LEVIATHAN-WILLENSKRAFT BÜNDELN: RAUMFALTUNGS-SPRUNG [LEERTASTE]', action: 'warp_breakout', keyHint: 'LEERTASTE' }
        ]
    }
];

let isPrologueActive = false;
let currentBeatIndex = 0;
let onCompleteCallback: (() => void) | null = null;

export function isPrologueRunning(): boolean {
    return isPrologueActive;
}

export function getCurrentPrologueBeatIndex(): number {
    return currentBeatIndex;
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
    const mainTextEl = document.getElementById('prologue-main-text');
    const subTextEl = document.getElementById('prologue-sub-text');
    const stepCounterEl = document.getElementById('prologue-step-counter');
    const choicesContainer = document.getElementById('prologue-choices-container');

    if (overlay) {
        overlay.classList.remove('stage-office', 'stage-zoo', 'stage-jamal', 'stage-warp');
        overlay.classList.add(`stage-${beat.stage === 'office_dream' ? 'office' : beat.stage === 'alien_zoo' ? 'zoo' : beat.stage === 'jamal_contact' ? 'jamal' : 'warp'}`);
    }

    if (eyebrowText) eyebrowText.innerText = beat.eyebrow;
    if (stepCounterEl) stepCounterEl.innerText = beat.stepCounter;

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

        beat.options.forEach((opt, optIdx) => {
            const btn = document.createElement('button');
            const isClimax = opt.action === 'warp_breakout';
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

function handleOptionAction(action: 'next' | 'glitch_transition' | 'warp_breakout') {
    try {
        playSynapseHoverSound(660);
    } catch (e) {}

    if (action === 'next') {
        renderBeat(currentBeatIndex + 1);
    } else if (action === 'glitch_transition') {
        triggerGlitchRealityTear();
    } else if (action === 'warp_breakout') {
        triggerWarpBreakout();
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
        renderBeat(currentBeatIndex + 1);
    }, 450);
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
        stationActivity: 'Kalibriert Quanten-Sensoren',
        avatarIcon: '👨‍🚀',
        speciesColor: '#38bdf8'
    };

    STATE.crew.unshift(jamal);
    STATE.loneliness = Math.min(STATE.loneliness, 45); // Jamal cures profound solitude!
    renderCrewUI();

    addLogEntry("CREW", "👨‍🚀 Dr. Jamal hat sich im Synapsen-Kern verankert: „Wir haben es geschafft, Najmafar! Meine Scanner sind online.“");
    addLogEntry("SYSTEM", "⚛️ Tiefenscan-Protokolle aktiv: Tech, H₂O, Legierungen & Shuttle-Expeditionen auf Planeten freigeschaltet!");

    return jamal;
}

export function finishPrologue() {
    if (!isPrologueActive) return;
    isPrologueActive = false;
    STATE.prologueActive = false;
    STATE.prologueCompleted = true;
    STATE.prologueStage = 'completed';

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

        // Number keys 1..3
        if (e.key === '1' && beat.options.length >= 1) {
            e.preventDefault();
            handleOptionAction(beat.options[0].action);
        } else if (e.key === '2' && beat.options.length >= 2) {
            e.preventDefault();
            handleOptionAction(beat.options[1].action);
        } else if (e.key === '3' && beat.options.length >= 3) {
            e.preventDefault();
            handleOptionAction(beat.options[2].action);
        } else if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            const lastOpt = beat.options[beat.options.length - 1];
            if (lastOpt) {
                handleOptionAction(lastOpt.action);
            }
        }
    });
}
