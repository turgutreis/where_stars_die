import { STATE } from '../core/state';
import { 
    playSonarChime, 
    playSynapseEvolveSound, 
    playEmpChargeSound, 
    playCrashSound, 
    playFleetAlarmSound 
} from '../engine/audio';
import { addLogEntry, updateHUDStats } from './hud';
import { advanceFtueStep, renderDirectives } from './directives';

export interface DialogueOption {
    label: string;
    keyHint?: string;
    targetNodeId?: string;
    action?: string;
}

export interface DialogueNode {
    id: string;
    speakerName: string;
    speakerType?: 'character' | 'guide' | 'thoughts' | 'ai' | 'terminal';
    eyebrow: string;
    mainText: string;
    subText: string;
    sound?: 'sonar' | 'synapse' | 'alarm' | 'crash';
    options: DialogueOption[];
}

let isDialogOpen = false;
let currentNodeId: string = 'jamal_orbit_intro';

export function isJamalDialogOpen(): boolean {
    return isDialogOpen;
}

export function getCurrentDialogueNodeId(): string {
    return currentNodeId;
}

export const DIALOGUE_NODES: Record<string, DialogueNode> = {
    // ------------------------------------------------------------------------
    // ACT I: Post-Breakout In-Flight Telepathy (Before scanning the ship)
    // ------------------------------------------------------------------------
    jamal_orbit_intro: {
        id: 'jamal_orbit_intro',
        speakerName: 'Dr. Jamal',
        speakerType: 'character',
        eyebrow: '⚛️ TELEPATHIE • PERSEUS-RAND',
        mainText: '„Najmafar! Wir sind entkommen... Jetzt müssen wir mein Schiff finden.“',
        subText: '„Ich bin nur mit einem unauffälligen Zivil-Touristenshuttle zur Menagerie gereist, um keine Aufmerksamkeit der Psionischen Gilde zu erregen.\n\nMein eigentliches Forschungsschiff – die ISS Ibn Battuta – liegt im Orbit des nahen Planeten versteckt. Fliege zum Planeten und scanne es mit deinen Sensoren [F]!“',
        sound: 'sonar',
        options: [
            { label: '„Verstanden. Ich nehme Kurs auf den Planeten.“', keyHint: '1', action: 'close' },
            { label: '„Wieso wurde dein Raumschiff überhaupt versteckt?“', keyHint: '2', targetNodeId: 'jamal_ship_info' },
            { label: '„Woher kommst du, Jamal? Und warum hast du mich befreit?“', keyHint: '3', targetNodeId: 'jamal_origin' }
        ]
    },

    jamal_ship_info: {
        id: 'jamal_ship_info',
        speakerName: 'Dr. Jamal',
        speakerType: 'character',
        eyebrow: '⚛️ FORSCHUNGSSCHIFF • ISS IBN BATTUTA',
        mainText: '„Ein autonomer Prototyp für Tiefenraum-Aufklärung.“',
        subText: '„Die Ibn Battuta ist vollgestopft mit Quantensensoren, meinen Isolierexperimenten und 50 Einheiten reinem Melange-Gewürz. Ohne dieses Schiff und seine Antennen sind wir im interstellaren Raum blind.\n\nIch habe es im planetaren Orbit geparkt, getarnt hinter der Radiations-Signatur der Atmosphäre.“',
        options: [
            { label: '„Woher kommst du eigentlich und warum hast du mich befreit?“', keyHint: '1', targetNodeId: 'jamal_origin' },
            { label: '„Alles klar. Fliegen wir zum Planeten und orten es.“', keyHint: '2', action: 'close' }
        ]
    },

    jamal_origin: {
        id: 'jamal_origin',
        speakerName: 'Dr. Jamal',
        speakerType: 'character',
        eyebrow: '⚛️ DR. JAMAL • ARCHIVE DER ERDE',
        mainText: '„Ich habe 250 Jahre alte Daten analysiert...“',
        subText: '„Vor zweieinhalb Jahrhunderten bemerkten terranische Observatorien, dass die Sterne sterben. Einer nach dem anderen erlischt am kosmischen Horizont. Ich suchte nach dem Ursprung dessen, was der Erde und dem Kosmos widerfährt.\n\nDie Psionische Gilde hatte dich in der Menagerie gefangen und wollte dein Bewusstsein für ein Experiment ausschlachten. Ich wusste: Du bist kein wildes Tier. Und ich wusste, dass du Spice brauchst, um aus der Apathie zu erwachen.“',
        options: [
            { label: '„Warum sterben die Sterne?“', keyHint: '1', targetNodeId: 'jamal_dying_stars' },
            { label: '„Zurück zum Planeten & dein Schiff suchen.“', keyHint: '2', targetNodeId: 'jamal_orbit_intro' }
        ]
    },

    jamal_dying_stars: {
        id: 'jamal_dying_stars',
        speakerName: 'Dr. Jamal',
        speakerType: 'character',
        eyebrow: '⚛️ ASTROPHYSIK • DUNKLE ENERGIE',
        mainText: '„Das Universum driftet auseinander... beschleunigt durch dunkle Energie.“',
        subText: '„Das Licht erreicht die Systeme nicht mehr. Irgendetwas zerreißt die kosmische Ordnung. Vor zweihundert Jahren hat dein Volk das Echo-Signal gesandt. Die Menschheit hat es nie ganz verstanden, aber unsere Quantenrechner basieren auf eurer Biologie.\n\nWir müssen überleben. Und dafür brauchen wir mein Forschungsschiff.“',
        options: [
            { label: '„Kurs auf das Schiff setzen.“', keyHint: '1', action: 'close' }
        ]
    },

    // ------------------------------------------------------------------------
    // ACT II: Ship Scanned -> Discovery of the Insan Towing Clamp
    // ------------------------------------------------------------------------
    jamal_ship_scanned: {
        id: 'jamal_ship_scanned',
        speakerName: 'Insan-Terminal & Dr. Jamal',
        speakerType: 'ai',
        eyebrow: '🚨 SPEKTRAL-SCAN • ANOMALIE ENTDECKT',
        mainText: '„Die Triebwerke sind mit einer massiven Quanten-Kralle blockiert!“',
        subText: 'Ein blinkendes Hologramm der Insan-Organisation pulsiert über den Hecktriebwerken der ISS Ibn Battuta:\n\n[INSAN-VOLLZUG §42a]: „Widerrechtliches Parken im orbitalen Raum. Parkdauer um 42 Zyklen überschritten. Fahrzeug festgesetzt. Fällige Gebühr: 12.000 galaktische Credits.“\n\nJamal seufzt schwer in deinen Synapsen:\n„Nicht die schon wieder... Das ist eine Parkkralle der Insan-Drohnen!“',
        sound: 'alarm',
        options: [
            { label: '„Frage an Jamal: Wieso wurde dein Raumschiff gesperrt? Wer sind die Insan?“', keyHint: '1', targetNodeId: 'insan_explanation' },
            { label: '„Versuche, das Bußgeld am Terminal zu bezahlen [12.000 Credits]“', keyHint: '2', targetNodeId: 'insan_pay_attempt' },
            { label: '„Können wir die Kralle nicht einfach mit Gewalt zerschlagen?“', keyHint: '3', targetNodeId: 'insan_violence_inquiry' },
            { label: '„Gibt es einen Weg, ihre Basis zu finden, wohin Schiffe gebracht werden?“', keyHint: '4', targetNodeId: 'insan_base_inquiry' },
            { label: '„Später entscheiden [Dialog schließen]“', keyHint: 'ESC', action: 'close' }
        ]
    },

    insan_explanation: {
        id: 'insan_explanation',
        speakerName: 'Dr. Jamal',
        speakerType: 'character',
        eyebrow: '🤖 DIE INSAN-ORGANISATION • AUTONOME BÜROKRATIE',
        mainText: '„Eine Drohnengesellschaft, die völlig außer Kontrolle geraten ist.“',
        subText: '„\'Insan\' steht im Arabischen für künstliche Menschen und Roboter. Vor Jahrhunderten schufen die Kernwelten eine autonome Drohnengesellschaft zur Regelung von Verkehrsströmen und Parkzonen im Weltall.\n\nAls die Zivilisationen untergingen, liefen die Subroutinen der Insan einfach weiter. Jetzt patrouillieren Tausende dieser hirnlosen Drohnen den Kosmos, jagen Falschparker um Planeten und Asteroiden und schleppen Schiffe gnadenlos ab oder verpassen ihnen Krallen!“',
        options: [
            { label: '„Was passiert, wenn wir die geforderten 12.000 Credits zahlen?“', keyHint: '1', targetNodeId: 'insan_pay_attempt' },
            { label: '„Können wir die Kralle gewaltsam zerstören?“', keyHint: '2', targetNodeId: 'insan_violence_inquiry' },
            { label: '„Wo ist die Basis, wohin Schiffe abgeschleppt werden?“', keyHint: '3', targetNodeId: 'insan_base_inquiry' }
        ]
    },

    insan_pay_attempt: {
        id: 'insan_pay_attempt',
        speakerName: 'Insan-Zahlungsterminal TX-9',
        speakerType: 'terminal',
        eyebrow: '💳 INSAN-KREDIT-TRANSFERSYSTEM',
        mainText: '„Verbindungsaufbau zum Galaktischen Bankenkonglomerat...“',
        subText: 'Auf dem Terminal der Kralle rattern kryptische Fehlercodes:\n\n[FEHLER 0xINSAN_TIMEOUT]: „Transaktion fehlgeschlagen! Interstellare Kommunikations-Störung im Perseus-Sektor. Kein Signal zur Zentralbank.\nWiederholen Sie den Bezahlvorgang in: 3 Äonen, 42 Zyklen.“\n\nJamal schüttelt telepathisch den Kopf:\n„Typisch Insan-Bürokratie! Das gesamte Bankennetz ist seit zwei Jahrhunderten tot! Aber ihre Software verlangt stur eine Online-Transaktion. Zahlen ist unmöglich!“',
        sound: 'crash',
        options: [
            { label: '„Kralle gewaltsam zerstören [EMP / Bio-Gewalt]“', keyHint: '1', targetNodeId: 'insan_violence_inquiry' },
            { label: '„Nach der Insan-Basis & Deaktivierungscode forschen“', keyHint: '2', targetNodeId: 'insan_base_inquiry' },
            { label: '„Zurück zu den Optionen“', keyHint: '3', targetNodeId: 'jamal_ship_scanned' }
        ]
    },

    insan_violence_inquiry: {
        id: 'insan_violence_inquiry',
        speakerName: 'Dr. Jamal',
        speakerType: 'character',
        eyebrow: '⚠️ WARNUNG • VOLLSTRECKER-ALARM',
        mainText: '„Du könntest die Kralle zerfetzen... aber sie werden stinksauer sein.“',
        subText: '„Mit deiner gigantischen biologischen Masse oder einem EMP-Schockstoß kannst du die Quanten-Kralle einfach in Stücke reißen. Mein Schiff wäre sofort frei.\n\nABER: Sobald die Kralle bricht, sendet sie einen Notfall-Alarm! Die Insan-Abschleppdrohne und ihre Eskorte werden sofort feindlich und eröffnen das Feuer auf uns!“',
        options: [
            { label: '💥 „Egal! Zerschlage die Kralle mit Bio-Gewalt! [Schiff befreien & Drohnen alarmieren]“', keyHint: '1', action: 'smash_clamp' },
            { label: '„Lieber nicht riskieren. Gibt es einen friedlichen Weg über ihre Basis?“', keyHint: '2', targetNodeId: 'insan_base_inquiry' },
            { label: '„Zurück“', keyHint: '3', targetNodeId: 'jamal_ship_scanned' }
        ]
    },

    insan_base_inquiry: {
        id: 'insan_base_inquiry',
        speakerName: 'Dr. Jamal',
        speakerType: 'character',
        eyebrow: '🛰️ SENSOR-ANALYSE • DIE INSAN-VERWAHRSTELLE',
        mainText: '„Jede Drohne speichert den Leitstrahl zu ihrer Heimatbasis.“',
        subText: '„Die Insan-Organisation bringt alle abgeschleppten Schiffe zu einer riesigen Schrott- und Verwahrbasis. Jede Drohne trägt die Koordinaten und den autorisierten Deaktivierungscode im Speicher.\n\nWenn wir die Drohnendatenbank scannen und hacken, können wir den Deaktivierungscode extrahieren – und die Kralle löst sich friedlich!“',
        options: [
            { label: '📡 „Speicherbank der Drohne anzapfen & Deaktivierungscode extrahieren [Hack / Scan]“', keyHint: '1', action: 'hack_drone_database' },
            { label: '💥 „Zu kompliziert! Zerschlage die Kralle mit Bio-Gewalt! [Kampf]“', keyHint: '2', action: 'smash_clamp' },
            { label: '„Zurück“', keyHint: '3', targetNodeId: 'jamal_ship_scanned' }
        ]
    },

    // ------------------------------------------------------------------------
    // ACT III: Outcomes
    // ------------------------------------------------------------------------
    clamp_smashed_result: {
        id: 'clamp_smashed_result',
        speakerName: 'Dr. Jamal',
        speakerType: 'character',
        eyebrow: '💥 GEWALTIGE BEFREIUNG • DROHNEN-ALARM',
        mainText: '„Die Kralle ist zertrümmert! Aber die Drohnen sind stinksauer!“',
        subText: 'Die Quantenkralle explodiert in einem Funkenregen! Ein gellender Alarmton schallt durch die Frequenzen:\n\n[INSAN-DROHNE TX-9]: „ALARM! Sachbeschädigung an Vollzugseigentum! Aggressor identifiziert als biologischer Leviathan. Kampfprotokoll aktiviert!“\n\nJamal: „Die Ibn Battuta ist frei! Ich habe 50 Melange und alle Daten in deine Neuronen geladen. Aber mach dich bereit – die Drohnen greifen an!“',
        sound: 'alarm',
        options: [
            { label: '⚔️ „Lasst sie nur kommen!“ [Dialog schließen & Gefecht aufnehmen]', keyHint: '1', action: 'close' }
        ]
    },

    drone_hacked_result: {
        id: 'drone_hacked_result',
        speakerName: 'Dr. Jamal',
        speakerType: 'character',
        eyebrow: '✨ ELEGANTER BYPASS • SCHIFF GEBORGEN',
        mainText: '„Unglaublich! Du hast ihre eigene bürokratische Hintertür genutzt!“',
        subText: 'Deine psionischen Synapsen knacken die Speicherbank der Drohne und senden den Insan-Administrator-Code (OVERRIDE_ADMIN_0000).\n\n[INSAN-DROHNE]: „Administrator-Code akzeptiert. Parkkralle entriegelt. Vielen Dank für Ihre Kooperation. Wir wünschen eine angenehme Weiterreise im Perseus-Sektor.“\n\nJamal lacht begeistert:\n„Haha! Sie haben sich sogar bedankt! Die Ibn Battuta ist unversehrt frei, 50 Melange gesichert – und wir haben die Koordinaten ihrer Verwahrstelle im Archiv!“',
        sound: 'synapse',
        options: [
            { label: '🔭 „Sensoren koppeln & System erkunden“ [Dialog schließen]', keyHint: '1', action: 'close' }
        ]
    }
};

/**
 * Opens the right-docked dialogue card with the requested node.
 */
export function openNpcDialogue(nodeId: string) {
    const node = DIALOGUE_NODES[nodeId] || DIALOGUE_NODES['jamal_orbit_intro'];
    currentNodeId = node.id;
    isDialogOpen = true;

    const card = document.getElementById('npc-dialog-card');
    const eyebrowText = document.getElementById('npc-dialog-eyebrow-text');
    const speakerBadge = document.getElementById('npc-speaker-badge');
    const mainTextEl = document.getElementById('npc-dialog-main-text');
    const subTextEl = document.getElementById('npc-dialog-sub-text');
    const choicesContainer = document.getElementById('npc-dialog-choices');

    if (!card) return;

    card.classList.remove('hidden');

    if (eyebrowText) eyebrowText.innerText = node.eyebrow;
    if (speakerBadge) {
        speakerBadge.innerText = node.speakerName;
        speakerBadge.className = `prologue-speaker-badge speaker-${node.speakerType || 'character'}`;
    }

    if (mainTextEl) {
        mainTextEl.innerText = node.mainText;
    }

    if (subTextEl) {
        // Simple paragraph parsing
        subTextEl.innerHTML = node.subText.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    }

    // Play sound if defined
    try {
        if (node.sound === 'sonar') playSonarChime();
        else if (node.sound === 'synapse') playSynapseEvolveSound();
        else if (node.sound === 'alarm') playFleetAlarmSound();
        else if (node.sound === 'crash') playCrashSound();
    } catch (e) {}

    // Populate choices
    if (choicesContainer) {
        choicesContainer.innerHTML = '';

        node.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = opt.action === 'smash_clamp' ? 'prologue-action-btn' : 'prologue-choice-btn';

            const keyHint = opt.keyHint || `${idx + 1}`;
            btn.innerHTML = `<span class="prologue-choice-badge">${keyHint}</span><span>${opt.label}</span>`;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleDialogueChoice(opt);
            });

            choicesContainer.appendChild(btn);
        });
    }

    renderDirectives();
}

/**
 * Closes the right-docked dialogue card.
 */
export function closeNpcDialogue() {
    const card = document.getElementById('npc-dialog-card');
    if (card) {
        card.classList.add('hidden');
    }
    isDialogOpen = false;
    renderDirectives();
}

/**
 * Handles choice selection in dialogue tree.
 */
export function handleDialogueChoice(optionOrTarget: DialogueOption | string) {
    if (typeof optionOrTarget === 'string') {
        if (optionOrTarget === 'close') {
            closeNpcDialogue();
            return;
        }
        if (optionOrTarget === 'smash_clamp') {
            executeSmashClamp();
            return;
        }
        if (optionOrTarget === 'hack_drone_database') {
            executeHackDroneDatabase();
            return;
        }
        if (DIALOGUE_NODES[optionOrTarget]) {
            openNpcDialogue(optionOrTarget);
            return;
        }
        closeNpcDialogue();
        return;
    }

    const option = optionOrTarget;
    if (option.action === 'close') {
        closeNpcDialogue();
        return;
    }

    if (option.action === 'smash_clamp') {
        executeSmashClamp();
        return;
    }

    if (option.action === 'hack_drone_database') {
        executeHackDroneDatabase();
        return;
    }

    if (option.targetNodeId && DIALOGUE_NODES[option.targetNodeId]) {
        openNpcDialogue(option.targetNodeId);
        return;
    }

    closeNpcDialogue();
}

/**
 * Player chooses to destroy the clamp violently:
 * Ship freed, rewards granted, BUT drone becomes hostile and attacks!
 */
export function executeSmashClamp() {
    if (STATE.jamalShipLiberated) return;
    STATE.jamalShipLiberated = true;
    STATE.jamalMissionCompleted = true;

    try {
        playCrashSound();
        playEmpChargeSound();
        playFleetAlarmSound();
    } catch (e) {}

    // Overload clamp & free ship
    if (STATE.jamalShip) {
        if (STATE.jamalShip.setLiberated) STATE.jamalShip.setLiberated(true);
        STATE.jamalShip.name = "Forschungsschiff 'ISS Ibn Battuta' [GEBORGEN]";
    }

    // Drone becomes furious / hostile!
    if (STATE.towingDrone) {
        STATE.towingDrone.name = "KI-Abschleppdrohne TX-9 [AGGRESSIV • VOLLSTRECKUNG]";
        STATE.towingDrone.isHostile = true;
        STATE.towingDrone.status = 'hostile';
    }

    STATE.systemAlertLevel = 'alert';

    grantJamalRewards();

    addLogEntry("PARK-KI", "🚨 [INSAN-VOLLZUG]: ALARM! Sachbeschädigung an orbitaler Parkkralle! Eliminierungsprotokoll aktiviert!");
    addLogEntry("SYSTEM", "💥 GEWALTIGE BEFREIUNG: Die Kralle wurde zerschlagen. Die Drohnen sind stinksauer und eröffnen das Feuer!");

    openNpcDialogue('clamp_smashed_result');
    advanceFtueStep(2);
}

/**
 * Player chooses to hack the drone's memory bank:
 * Unlocks the Insan Verwahrstelle coordinates and releases clamp via admin override peacefully!
 */
export function executeHackDroneDatabase() {
    if (STATE.jamalShipLiberated) return;
    STATE.jamalShipLiberated = true;
    STATE.jamalMissionCompleted = true;

    try {
        playSynapseEvolveSound();
        playSonarChime();
    } catch (e) {}

    // Peaceful bypass
    if (STATE.jamalShip) {
        if (STATE.jamalShip.setLiberated) STATE.jamalShip.setLiberated(true);
        STATE.jamalShip.name = "Forschungsschiff 'ISS Ibn Battuta' [GEBORGEN]";
    }

    if (STATE.towingDrone) {
        STATE.towingDrone.name = "KI-Abschleppdrohne TX-9 [ADMIN-BYPASS • HARMLOS]";
        STATE.towingDrone.status = 'neutral';
        STATE.towingDrone.isHostile = false;
        if (STATE.towingDrone.triggerOverload) STATE.towingDrone.triggerOverload();
    }

    grantJamalRewards();

    addLogEntry("PARK-KI", "🤖 [INSAN-SYSTEM]: Administrator-Code (OVERRIDE_ADMIN_0000) verifiziert. Parkkralle ordnungsgemäß entriegelt.");
    addLogEntry("NAV", "🛰️ DATENBANK-HACK: Koordinaten der Insan-Verwahrstelle (Sektor-Schrottwerft) in Sternenkarte gespeichert!");
    addLogEntry("SYSTEM", "✨ ELEGANTER BYPASS: Forschungsschiff friedlich befreit ohne Drohnen-Alarm!");

    openNpcDialogue('drone_hacked_result');
    advanceFtueStep(2);
}

function grantJamalRewards() {
    const spiceBonus = 50;
    const siliconBonus = 60;
    const mentalBonus = 40;

    STATE.spiceRes = (STATE.spiceRes || 0) + spiceBonus;
    STATE.bioRes = (STATE.bioRes || 0) + spiceBonus;
    STATE.siliconRes = (STATE.siliconRes || 0) + siliconBonus;
    STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, (STATE.mentalEnergy || 50) + mentalBonus);
    STATE.loneliness = Math.max(5, (STATE.loneliness || 30) - 20);

    updateHUDStats();
    addLogEntry("SYSTEM", `🎉 BELOHNUNG ERHALTEN: +${spiceBonus} Melange-Gewürz | +${siliconBonus} Silizium | +${mentalBonus} Mentalkraft!`);
}

/**
 * Opens initial telepathic intro brief from Dr. Jamal in right-docked dialogue panel.
 */
export function openJamalIntroDialog() {
    if (STATE.jamalIntroModalSeen) return;
    STATE.jamalIntroModalSeen = true;
    STATE.jamalMissionActive = true;

    openNpcDialogue('jamal_orbit_intro');
}

/**
 * Triggers when player scans Jamal's ship in orbit!
 */
export function triggerJamalShipScannedDialogue() {
    openNpcDialogue('jamal_ship_scanned');
}

// Backward-compatibility wrappers
export function closeJamalDialog() {
    closeNpcDialogue();
}

export function openJamalLiberatedDialog() {
    openNpcDialogue('drone_hacked_result');
}

export function liberateJamalShip() {
    executeHackDroneDatabase();
}

/**
 * Initializes listeners for the right-docked dialogue panel.
 */
export function initJamalDialogListeners() {
    const closeBtn = document.getElementById('close-npc-dialog-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeNpcDialogue();
        });
    }

    // Number keys 1-9 to trigger options
    window.addEventListener('keydown', (e) => {
        if (!isDialogOpen) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            closeNpcDialogue();
            return;
        }

        const node = DIALOGUE_NODES[currentNodeId];
        if (!node) return;

        const num = parseInt(e.key);
        if (!isNaN(num) && num >= 1 && num <= node.options.length) {
            e.preventDefault();
            handleDialogueChoice(node.options[num - 1]);
        }
    });
}
