import { STATE } from '../core/state';
import { addLogEntry } from '../ui/hud';
import { toggleTelepathy } from '../input/controls';
import { playBioHarvestSound, playCrashSound } from '../engine/audio';
import { CrewMember, PrimaryParadigm, SubCodex, SpeciesCluster, OrganStationId, PsionicTraumaId, PsionicTrauma, CrewCrisisEvent } from '../types/game';
import { triggerCrewDeathNotification, updatePartyGrid } from '../ui/party-grid';

export function isTraumaActive(traumaId: PsionicTraumaId): boolean {
    if (!STATE.psionicTraumas) return false;
    const t = STATE.psionicTraumas.find(item => item.id === traumaId);
    if (!t) return false;
    return !t.healed || t.flareUp;
}

export function advanceTraumaTherapy(amount: number): boolean {
    if (!STATE.psionicTraumas) return false;
    const target = STATE.psionicTraumas.find(t => !t.healed);
    if (!target) return false;
    target.therapyProgress = Math.min(100, target.therapyProgress + amount);
    if (target.therapyProgress >= 100 && !target.healed) {
        target.healed = true;
        target.flareUp = false;
        addLogEntry("SYSTEM", `✨ PSIONISCHE KATHARSIS: [${target.name}] geheilt! Najmafar hat ein kosmisches Trauma überwunden!`);
        calculateCrewBuffs();
        return true;
    }
    return false;
}

export function performTherapySession(): boolean {
    const mentalCost = 15;
    const bioCost = 10;
    if (STATE.mentalEnergy < mentalCost || STATE.bioEnergy < bioCost) {
        addLogEntry("SYSTEM", `⚠️ Zu wenig Mentalkraft oder Bio-Energie für Katharsis-Sitzung (benötigt ${mentalCost} Mental, ${bioCost} Bio)!`);
        return false;
    }
    const unhealed = STATE.psionicTraumas?.find(t => !t.healed || t.flareUp);
    if (!unhealed) {
        addLogEntry("SYSTEM", "🧠 Alle bekannten Traumata des Big Freeze sind bereits geheilt und stabil!");
        return false;
    }
    STATE.mentalEnergy = Math.max(0, STATE.mentalEnergy - mentalCost);
    STATE.bioEnergy = Math.max(0, STATE.bioEnergy - bioCost);
    if (unhealed.flareUp) {
        unhealed.flareUp = false;
        addLogEntry("CREW", `✨ PSIONISCHE BERUHIGUNG: Akuter Rückfall von [${unhealed.name}] wurde gelindert!`);
    } else {
        advanceTraumaTherapy(25);
        addLogEntry("CREW", `🧠 PSIONISCHE KATHARSIS: Therapiesitzung durchgeführt (+25% Heilung an [${unhealed.name}])!`);
    }
    renderCrewUI(true);
    return true;
}

export function triggerCrewSabotageEvent(c: CrewMember): CrewCrisisEvent {
    const eventTypes: Array<CrewCrisisEvent['type']> = ['hull_tear', 'gland_clog', 'thruster_sabotage', 'psionic_scream'];
    const chosenType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    let title = '';
    let description = '';

    if (chosenType === 'hull_tear') {
        title = 'Chitin-Wanddurchbruch';
        description = `${c.name} reißt im Wahn eine innere Chitin-Membran auf (-15 HP, -10 Silizium)!`;
        STATE.health = Math.max(1, STATE.health - 15);
        STATE.siliconRes = Math.max(0, STATE.siliconRes - 10);
    } else if (chosenType === 'thruster_sabotage') {
        title = 'Schub-Tentakel Sabotage';
        description = `${c.name} blockiert einen Flug-Synapsen-Kanal (-20 Bio-Energie)!`;
        STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 20);
    } else if (chosenType === 'gland_clog') {
        title = 'Sekretions-Verstopfung';
        description = `${c.name} verstopft Naniten-Poren in der Chitin-Drüse (-10 HP)!`;
        STATE.health = Math.max(1, STATE.health - 10);
    } else {
        title = 'Psionischer Verzweiflungsschrei';
        description = `${c.name} stößt einen telepathischen Schrei aus (-25 Mental-Energie, Stress der Crew +15)!`;
        STATE.mentalEnergy = Math.max(0, STATE.mentalEnergy - 25);
        STATE.crew.forEach(other => {
            if (other !== c) other.stress = Math.min(100, other.stress + 15);
        });
    }

    // Crew member partially relieves panic through the catharsis of action
    c.stress = Math.max(50, c.stress - 25);
    c.crisisActive = false;
    c.crisisTimer = 25.0; // 25s cooldown before crisis can begin again

    const crisisEvent: CrewCrisisEvent = {
        id: `crisis_${Date.now()}_${c.id}`,
        crewId: c.id,
        crewName: c.name,
        type: chosenType,
        title,
        description,
        timer: 0,
        maxTimer: 15,
        resolved: true
    };

    if (!STATE.activeCrisisEvents) STATE.activeCrisisEvents = [];
    STATE.activeCrisisEvents.unshift(crisisEvent);
    if (STATE.activeCrisisEvents.length > 5) STATE.activeCrisisEvents.pop();

    addLogEntry("CREW", `💥 SABOTAGE-VORFALL: ${title}! ${description}`);
    return crisisEvent;
}

let radWarningCooldown = 0.0;
let waterWarningCooldown = 0.0;
let foodWarningCooldown = 0.0;

export const ORGAN_STATIONS: Record<OrganStationId, {
    name: string;
    subtitle: string;
    icon: string;
    optimalRoles: string[];
    optimalDispositions: string[];
    description: string;
}> = {
    flight_synapse: {
        name: "Flug-Synapse",
        subtitle: "Nervenknoten des Cockpits",
        icon: "🚀",
        optimalRoles: ['pilot'],
        optimalDispositions: ['martial'],
        description: "+15% Schub & Wendigkeit, dämpft Trägheitsdrift"
    },
    chitin_gland: {
        name: "Chitin-Drüse",
        subtitle: "Panzerung & Nanitenkammer",
        icon: "🛡️",
        optimalRoles: ['engineer'],
        optimalDispositions: ['lithoid'],
        description: "+Hüllenhärte, passive Rumpf-Reparatur im Flug"
    },
    bio_incubator: {
        name: "Bio-Inkubator",
        subtitle: "Stoffwechsel- & Telomerbecken",
        icon: "🧪",
        optimalRoles: ['biologist'],
        optimalDispositions: ['synthetic'],
        description: "-25% Verjüngungskosten, +30% Biomasse-Ernte"
    },
    dream_core: {
        name: "Traum-Kern",
        subtitle: "Seelen-Resonanzraum",
        icon: "🔮",
        optimalRoles: ['psychologist', 'cryptologist'],
        optimalDispositions: ['empathic', 'scholarly'],
        description: "-Einsamkeit, +Mentale Regeneration, beschleunigt Umwälzung"
    }
};

export function assignCrewToOptimalStation(c: CrewMember): void {
    if (!c.station || !ORGAN_STATIONS[c.station as OrganStationId]) {
        if (c.role === 'pilot') c.station = 'flight_synapse';
        else if (c.role === 'engineer') c.station = 'chitin_gland';
        else if (c.role === 'biologist') c.station = 'bio_incubator';
        else if (c.role === 'psychologist' || c.role === 'cryptologist') c.station = 'dream_core';
        else if (c.disposition === 'martial') c.station = 'flight_synapse';
        else if (c.disposition === 'lithoid') c.station = 'chitin_gland';
        else if (c.disposition === 'synthetic') c.station = 'bio_incubator';
        else c.station = 'dream_core';
    }
    c.stationName = ORGAN_STATIONS[c.station as OrganStationId]?.name || 'Organ-Station';
    updateSingleCrewActivity(c);
}

export function updateSingleCrewActivity(c: CrewMember): void {
    const s = (c.station as OrganStationId) || 'dream_core';
    if (s === 'flight_synapse') {
        c.stationActivity = `${c.name} synchronisiert neuronale Reflexe mit den Steuer-Tentakeln.`;
    } else if (s === 'chitin_gland') {
        c.stationActivity = `${c.name} leitet Silizium-Naniten in rissige Chitin-Poren.`;
    } else if (s === 'bio_incubator') {
        c.stationActivity = `${c.name} synthetisiert Telomer-Enzyme im Nährstoffbecken.`;
    } else {
        c.stationActivity = `${c.name} meditiert und glättet psionische Resonanzwellen.`;
    }
}

export function setCrewStation(crewId: number, stationId: OrganStationId): void {
    const member = STATE.crew.find(c => c.id === crewId);
    if (!member) return;
    member.station = stationId;
    member.stationName = ORGAN_STATIONS[stationId].name;
    updateSingleCrewActivity(member);
    calculateCrewBuffs();
    renderCrewUI(true);
    updatePartyGrid();
    addLogEntry("CREW", `🫀 STATION: ${member.name} (${member.roleName}) an [${ORGAN_STATIONS[stationId].icon} ${ORGAN_STATIONS[stationId].name}] gebunden.`);
}

export function setSpeciesClusterStation(speciesName: string, stationId: OrganStationId): void {
    let count = 0;
    STATE.crew.forEach(c => {
        const sName = c.speciesArchetypeName || c.species.split(' (')[0];
        if (sName === speciesName) {
            c.station = stationId;
            c.stationName = ORGAN_STATIONS[stationId].name;
            updateSingleCrewActivity(c);
            count++;
        }
    });
    calculateCrewBuffs();
    renderCrewUI(true);
    updatePartyGrid();
    addLogEntry("CREW", `🫀 KOLLEKTIV-STATION: ${count}x ${speciesName} an [${ORGAN_STATIONS[stationId].icon} ${ORGAN_STATIONS[stationId].name}] gebunden.`);
}

export function getStationCrewCounts(): Record<OrganStationId, number> {
    const counts: Record<OrganStationId, number> = {
        flight_synapse: 0,
        chitin_gland: 0,
        bio_incubator: 0,
        dream_core: 0
    };
    STATE.crew.forEach(c => {
        assignCrewToOptimalStation(c);
        if (counts[c.station as OrganStationId] !== undefined) {
            counts[c.station as OrganStationId]++;
        }
    });
    return counts;
}

const expandedClusters = new Set<string>();

export function getExpandedClustersKey(): string {
    return Array.from(expandedClusters).sort().join(',');
}

export function clearExpandedClusters(): void {
    expandedClusters.clear();
}

export function toggleClusterExpansion(speciesName: string): void {
    if (expandedClusters.has(speciesName)) {
        expandedClusters.delete(speciesName);
    } else {
        expandedClusters.add(speciesName);
    }
    renderCrewUI(true);
    updatePartyGrid();
}

export function cyclePrimaryParadigm(instant: boolean = false): void {
    if (STATE.primaryParadigm === 'neutral') {
        if (STATE.crew.length === 0) {
            addLogEntry("DOKTRIN", "🌌 Najmafar ist in mentaler Einsamkeit gefangen. Erstkontakt mit einer Spezies erforderlich!");
            return;
        } else {
            if (typeof (window as any).openFirstContactModal === 'function') {
                (window as any).openFirstContactModal();
            } else {
                setPrimaryParadigm('deception', instant);
            }
            return;
        }
    }
    const list: PrimaryParadigm[] = ['deception', 'domination', 'symbiosis'];
    const currentBase = STATE.doctrineTransition?.active ? STATE.doctrineTransition.targetParadigm : STATE.primaryParadigm;
    const currentIdx = list.indexOf(currentBase);
    const next = list[(currentIdx + 1) % list.length];
    setPrimaryParadigm(next, instant);
}

export function setPrimaryParadigm(paradigm: PrimaryParadigm, instant: boolean = false): void {
    if (STATE.primaryParadigm === paradigm && (!STATE.doctrineTransition || !STATE.doctrineTransition.active)) {
        return;
    }
    if (STATE.doctrineTransition?.active && STATE.doctrineTransition.targetParadigm === paradigm) {
        return;
    }

    if (instant) {
        completeDoctrineShift(paradigm);
        return;
    }

    // Initiate Psionic Upheaval (Transition)
    const fromP = STATE.primaryParadigm;
    STATE.doctrineTransition = {
        active: true,
        fromParadigm: fromP,
        targetParadigm: paradigm,
        progress: 0.0,
        duration: 25.0 // seconds
    };

    const titles: Record<PrimaryParadigm, string> = {
        domination: "⚡ Herrschaft & Zwang",
        deception: "🔮 Täuschung & Traum-Matrix",
        symbiosis: "🌱 Symbiose & Harmonie",
        neutral: "🌌 Neutrale Leere"
    };

    if (fromP === 'neutral') {
        addLogEntry("DOKTRIN", `✨ PSIONISCHES ERWACHEN: Najmafars Geist verlässt die Einsamkeit und richtet sich auf ${titles[paradigm]} aus...`);
    } else if (fromP === 'deception' && paradigm === 'domination') {
        STATE.crew.forEach(c => {
            if (c.disposition !== 'martial') {
                c.stress = Math.min(100, c.stress + 18);
                c.illusionStability = Math.max(0, c.illusionStability - 25);
                c.thought = "Panisch: 'Der Himmel reißt auf... das ist kein Schiff, das ist ein Ungeheuer!'";
            }
        });
        addLogEntry("DOKTRIN", `🌀 PSIONISCHE UMWÄLZUNG: [Täuschung ➔ Herrschaft] eingeleitet! Die Scheinwelt flackert – Panik bricht aus!`);
    } else if (paradigm === 'symbiosis') {
        STATE.crew.forEach(c => {
            c.stress = Math.max(0, c.stress - 10);
            c.thought = "Verblüfft: 'Die Tentakel entspannen sich... das Wesen tastet nach unseren Gedanken.'";
        });
        addLogEntry("DOKTRIN", `🌀 PSIONISCHE UMWÄLZUNG: [➔ Symbiose] eingeleitet! Organische Synapsen öffnen sich für Harmonie.`);
    } else if (paradigm === 'deception') {
        STATE.crew.forEach(c => {
            c.status = "Traum-Trance";
            c.thought = "Benommen: 'Eine warme Welle umhüllt mich... war das alles nur ein Albtraum?'";
        });
        addLogEntry("DOKTRIN", `🌀 PSIONISCHE UMWÄLZUNG: [➔ Täuschung] eingeleitet! Psionischer Traum-Schleier senkt sich herab.`);
    } else {
        addLogEntry("DOKTRIN", `🌀 PSIONISCHE UMWÄLZUNG: Geisteszustand wandelt sich zu ${titles[paradigm]}...`);
    }

    renderCrewUI(true);
    updatePartyGrid();
}

export function completeDoctrineShift(paradigm: PrimaryParadigm): void {
    STATE.primaryParadigm = paradigm;
    if (STATE.doctrineTransition) {
        STATE.doctrineTransition.active = false;
        STATE.doctrineTransition.progress = 1.0;
    }

    // Reset default sub-codex if mismatched
    if (paradigm === 'neutral') {
        STATE.activeSubCodex = 'none';
    } else if (paradigm === 'domination' && !['iron_discipline', 'gunboat_diplomacy', 'nightmare_terror'].includes(STATE.activeSubCodex)) {
        STATE.activeSubCodex = 'gunboat_diplomacy';
    } else if (paradigm === 'deception' && !['benevolent_facade', 'illusory_matrix', 'nightmare_terror'].includes(STATE.activeSubCodex)) {
        STATE.activeSubCodex = 'benevolent_facade';
    } else if (paradigm === 'symbiosis' && !['living_symbiosis', 'pragmatic_accord', 'gunboat_diplomacy'].includes(STATE.activeSubCodex)) {
        STATE.activeSubCodex = 'living_symbiosis';
    }

    updateParadigmModifiers();
    calculateCrewBuffs();
    renderCrewUI(true);
    updatePartyGrid();

    const titles: Record<PrimaryParadigm, string> = {
        domination: "⚡ HERRSCHAFT & UNTERWERFUNG (Illithid)",
        deception: "🔮 TÄUSCHUNG & TRAUM-MATRIX (Holodeck)",
        symbiosis: "🌱 SYMBIOSE & HARMONIE (Organisch)",
        neutral: "🌌 NEUTRALE LEERE (Kosmische Einsamkeit)"
    };
    addLogEntry("DOKTRIN", `✨ PSIONISCHE UMWÄLZUNG VOLLENDET: ${titles[paradigm]}`);
}

export function setActiveSubCodex(subCodex: SubCodex): void {
    STATE.activeSubCodex = subCodex;
    updateParadigmModifiers();
    calculateCrewBuffs();
    renderCrewUI(true);
    updatePartyGrid();

    const subTitles: Record<SubCodex, string> = {
        none: "Kein Sub-Kodex (Neutral)",
        iron_discipline: "Eiserne Disziplin (Gewalt + Gewalt)",
        gunboat_diplomacy: "Ehrfurchts-Vertrag (Gewalt + Diplomatie)",
        nightmare_terror: "Albtraum-Matrix (Gewalt + Täuschung)",
        benevolent_facade: "Falsche Utopie (Täuschung + Diplomatie)",
        illusory_matrix: "Perfekte Simulation (Täuschung + Täuschung)",
        living_symbiosis: "Lebendige Symbiose (Harmonie + Harmonie)",
        pragmatic_accord: "Pragmatisches Abkommen (Harmonie + Diplomatie)"
    };
    if (subCodex !== 'none') {
        addLogEntry("DOKTRIN", `Sub-Kodex aktiviert: ${subTitles[subCodex] || subCodex}`);
    }
}

export function calculateParadigmBaseModifiers(primary: PrimaryParadigm, sub: SubCodex, martialCount: number, scholarlyCount: number) {
    let drainMult = 1.0;
    let stressMod = 0.0;
    let thrustBonus = 0.0;
    let stealthBonus = 0.0;
    let bioBonus = 0.0;
    let harmonyBonus = 0.0;

    if (primary === 'domination') {
        thrustBonus = 0.25;
        drainMult = 1.35;
        stressMod = 0.3;

        if (sub === 'iron_discipline') {
            thrustBonus = 0.45;
            drainMult = 1.55;
            stressMod = 0.7;
            if (martialCount > 0) {
                drainMult += martialCount * 0.12;
                stressMod += martialCount * 0.25;
            }
        } else if (sub === 'gunboat_diplomacy') {
            thrustBonus = 0.30;
            drainMult = 1.15;
            stressMod = -0.2;
            if (martialCount > 0) {
                stressMod -= martialCount * 0.15;
            }
        } else if (sub === 'nightmare_terror') {
            thrustBonus = 0.50;
            drainMult = 1.65;
            stressMod = 1.6;
        }
    } else if (primary === 'deception') {
        stealthBonus = 0.35;
        drainMult = 1.0;
        stressMod = -0.5;

        if (sub === 'benevolent_facade') {
            stealthBonus = 0.45;
            harmonyBonus = 0.15;
            stressMod = -1.2;
            if (scholarlyCount > 0) {
                drainMult += scholarlyCount * 0.08;
            }
        } else if (sub === 'illusory_matrix') {
            stealthBonus = 0.70;
            drainMult = 1.25;
            stressMod = -0.8;
        }
    } else if (primary === 'symbiosis') {
        bioBonus = 0.35;
        harmonyBonus = 0.30;
        stressMod = -1.5;
        drainMult = 0.85;

        if (sub === 'living_symbiosis') {
            bioBonus = 0.60;
            harmonyBonus = 0.45;
            stressMod = -2.2;
            if (martialCount > 0) {
                stressMod += martialCount * 0.10;
            }
        } else if (sub === 'pragmatic_accord') {
            bioBonus = 0.40;
            harmonyBonus = 0.25;
            stressMod = -1.0;
        }
    }

    return { drainMult, stressMod, thrustBonus, stealthBonus, bioBonus, harmonyBonus };
}

export function calculateRadiationProtection(): number {
    let res = 0.0;
    if (STATE.mutations.organic_siphon?.purchased) res += 0.25;
    if (STATE.mutations.chitin_armor?.purchased || STATE.mutations.armor?.purchased) res += 0.25;
    if (STATE.mutations.blade_armor?.purchased) res += 0.35;
    STATE.radiationResistance = Math.min(0.95, res);
    return STATE.radiationResistance;
}

export function updateParadigmModifiers(): void {
    let martialCount = 0;
    let scholarlyCount = 0;
    let empathicCount = 0;

    STATE.crew.forEach(c => {
        const disp = c.disposition || 'scholarly';
        if (disp === 'martial') martialCount++;
        else if (disp === 'scholarly') scholarlyCount++;
        else if (disp === 'empathic') empathicCount++;
    });

    const primary = STATE.primaryParadigm || 'deception';
    const sub = STATE.activeSubCodex || 'benevolent_facade';

    if (STATE.doctrineTransition && STATE.doctrineTransition.active) {
        const t = Math.max(0, Math.min(1, STATE.doctrineTransition.progress));
        const fromMods = calculateParadigmBaseModifiers(STATE.doctrineTransition.fromParadigm, sub, martialCount, scholarlyCount);
        const toMods = calculateParadigmBaseModifiers(STATE.doctrineTransition.targetParadigm, sub, martialCount, scholarlyCount);

        const lerp = (a: number, b: number) => a + (b - a) * t;

        STATE.paradigmModifiers = {
            mentalDrainMult: Math.max(0.4, Number(lerp(fromMods.drainMult, toMods.drainMult).toFixed(2))),
            stressModifier: Number(lerp(fromMods.stressMod, toMods.stressMod).toFixed(2)),
            thrustBonus: Number(lerp(fromMods.thrustBonus, toMods.thrustBonus).toFixed(2)),
            stealthBonus: Number(lerp(fromMods.stealthBonus, toMods.stealthBonus).toFixed(2)),
            bioRegenBonus: Number(lerp(fromMods.bioBonus, toMods.bioBonus).toFixed(2)),
            harmonyBonus: Number(lerp(fromMods.harmonyBonus, toMods.harmonyBonus).toFixed(2))
        };
    } else {
        const mods = calculateParadigmBaseModifiers(primary, sub, martialCount, scholarlyCount);
        STATE.paradigmModifiers = {
            mentalDrainMult: Math.max(0.4, Number(mods.drainMult.toFixed(2))),
            stressModifier: Number(mods.stressMod.toFixed(2)),
            thrustBonus: Number(mods.thrustBonus.toFixed(2)),
            stealthBonus: Number(mods.stealthBonus.toFixed(2)),
            bioRegenBonus: Number(mods.bioBonus.toFixed(2)),
            harmonyBonus: Number(mods.harmonyBonus.toFixed(2))
        };
    }
}

export function getSpeciesClusters(): SpeciesCluster[] {
    const map = new Map<string, CrewMember[]>();

    STATE.crew.forEach(c => {
        const rawSpecies = c.species || 'Unbekannt';
        const key = c.speciesArchetypeName || rawSpecies.split(' (')[0] || rawSpecies;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
    });

    const clusters: SpeciesCluster[] = [];

    map.forEach((members, speciesName) => {
        const first = members[0];
        let totalLifeRatio = 0;
        let totalStress = 0;
        let totalStability = 0;
        const roleCounts: Record<string, number> = {};

        members.forEach(m => {
            const maxLife = m.maxLifespan || 540;
            const currentAge = Math.min(maxLife, Math.floor(m.age || 0));
            totalLifeRatio += Math.max(0, Math.min(100, Math.round((1.0 - (currentAge / maxLife)) * 100)));
            totalStress += m.stress;
            totalStability += m.illusionStability;

            const r = m.roleName || m.role;
            roleCounts[r] = (roleCounts[r] || 0) + 1;
        });

        let dominantRole = first.roleName || first.role;
        let maxCount = 0;
        Object.entries(roleCounts).forEach(([r, count]) => {
            if (count > maxCount) {
                maxCount = count;
                dominantRole = r;
            }
        });

        const count = members.length;
        clusters.push({
            speciesName: speciesName,
            speciesColor: first.speciesColor || '#38bdf8',
            avatarIcon: first.avatarIcon || '👤',
            disposition: first.disposition || 'scholarly',
            count: count,
            members: members,
            avgAgePercent: Math.round(totalLifeRatio / count),
            avgStress: Math.round(totalStress / count),
            avgStability: Math.round(totalStability / count),
            dominantRole: dominantRole,
            isExpanded: expandedClusters.has(speciesName)
        });
    });

    return clusters;
}

export function rejuvenateSpeciesCluster(speciesName: string): void {
    const clusterMembers = STATE.crew.filter(c => (c.speciesArchetypeName || c.species.split(' (')[0]) === speciesName);
    if (clusterMembers.length === 0) return;

    const stationCounts = getStationCrewCounts();
    const bioDiscount = Math.min(0.5, stationCounts.bio_incubator * 0.15);
    const requiredBio = Math.round(20 * (1 - bioDiscount));
    const requiredRes = Math.round(10 * (1 - bioDiscount));

    let successCount = 0;
    clusterMembers.forEach(m => {
        if (STATE.bioEnergy >= requiredBio && STATE.bioRes >= requiredRes) {
            STATE.bioEnergy -= requiredBio;
            STATE.bioRes -= requiredRes;
            m.age = Math.max(0, m.age - (m.maxLifespan * 0.35));
            m.stress = Math.max(0, m.stress - 25);
            m.rejuvenationCount = (m.rejuvenationCount || 0) + 1;
            m.ageCategory = m.age / m.maxLifespan < 0.5 ? 'vital' : (m.age / m.maxLifespan < 0.75 ? 'mature' : 'senescent');
            successCount++;
        }
    });

    if (successCount > 0) {
        addLogEntry("SYSTEM", `💉 KOLLEKTIV-VERJÜNGUNG: ${successCount}x ${speciesName} regeneriert (-35% Alter)! Kosten: je ${requiredBio} Bio / ${requiredRes} Biomasse.`);
        calculateCrewBuffs();
        renderCrewUI(true);
        updatePartyGrid();
    } else {
        addLogEntry("SYSTEM", `Zu wenig Bio-Energie / Biomasse für Kollektiv-Verjüngung (${requiredBio} Bio / ${requiredRes} Biomasse pro Wesen).`);
    }
}

export function calculateCrewBuffs() {
    updateParadigmModifiers();

    let thrustMult = 1.0 + (STATE.paradigmModifiers?.thrustBonus || 0);
    let bioMult = 1.0 + (STATE.paradigmModifiers?.bioRegenBonus || 0);
    let scanMult = 1.0 + (STATE.paradigmModifiers?.harmonyBonus || 0);
    let repair = 0;
    let stressDamp = 1.0;
    let psioBonus = 0;

    const hiveBonus = STATE.mutations.hivemind && STATE.mutations.hivemind.purchased ? 1.2 : 1.0;

    const roleCounts: Record<string, number> = {};

    // Station Synergy Bonuses
    let flightCount = 0;
    let chitinCount = 0;
    let bioCount = 0;
    let dreamCount = 0;

    STATE.crew.forEach(c => {
        assignCrewToOptimalStation(c);

        const isSevered = (c.stress || 0) >= 70;
        if (isSevered) {
            c.connectionStatus = 'severed';
            c.escalationStage = (c.stress || 0) >= 85 ? 3 : 2;
            return;
        } else if ((c.stress || 0) >= 45) {
            c.connectionStatus = 'dissonant';
            c.escalationStage = 1;
        } else {
            c.connectionStatus = 'connected';
            c.escalationStage = 1;
        }

        if (c.station === 'flight_synapse') flightCount++;
        else if (c.station === 'chitin_gland') chitinCount++;
        else if (c.station === 'bio_incubator') bioCount++;
        else if (c.station === 'dream_core') dreamCount++;

        roleCounts[c.role] = (roleCounts[c.role] || 0) + 1;
        const count = roleCounts[c.role];
        const dimFactor = 1.0 / Math.sqrt(Math.max(1, count * 0.6));

        const agePenalty = c.ageCategory === 'critical' ? 0.6 : (c.ageCategory === 'senescent' ? 0.85 : 1.0);

        if (c.role === 'pilot') thrustMult += 0.15 * hiveBonus * agePenalty * dimFactor;
        if (c.role === 'biologist') {
            bioMult += 0.30 * hiveBonus * agePenalty * dimFactor;
            scanMult += 0.25 * hiveBonus * agePenalty * dimFactor;
        }
        if (c.role === 'engineer') repair += 0.6 * hiveBonus * agePenalty * dimFactor;
        if (c.role === 'psychologist') stressDamp *= (1.0 - 0.35 * hiveBonus * agePenalty * dimFactor);
        if (c.role === 'cryptologist') psioBonus += 30 * hiveBonus * agePenalty * dimFactor;

        // Specialized biological trait buffs
        if (c.trait) {
            if (c.trait.type === 'bio') bioMult += 0.15 * hiveBonus * agePenalty * dimFactor;
            if (c.trait.type === 'speed') thrustMult += 0.12 * hiveBonus * agePenalty * dimFactor;
            if (c.trait.type === 'repair') repair += 0.35 * hiveBonus * agePenalty * dimFactor;
            if (c.trait.type === 'stress') stressDamp *= (1.0 - 0.12 * hiveBonus * agePenalty * dimFactor);
            if (c.trait.type === 'psionic') psioBonus += 20 * hiveBonus * agePenalty * dimFactor;
        }
    });

    // Add Direct Station Synergies
    thrustMult += flightCount * 0.08;
    repair += chitinCount * 0.4;
    bioMult += bioCount * 0.15;
    scanMult += bioCount * 0.10;
    psioBonus += dreamCount * 25;
    stressDamp *= Math.pow(0.88, dreamCount);

    // Apply Big Freeze Trauma 'cryo_apathy' (-15% thrust & agility)
    if (isTraumaActive('cryo_apathy')) {
        thrustMult *= 0.85;
    }

    // Biologist & Scientist Mutation Boost (reduces cost of all mutations by 20% per researcher, max 50%)
    const bioScientists = STATE.crew.filter(c => c.role === 'biologist' || c.role === 'scientist').length;
    const mutationDiscount = Math.min(0.50, bioScientists * 0.20);
    STATE.mutationDiscount = Number(mutationDiscount.toFixed(2));

    // Life Support: Water & Food Consumption Rates (Synthetic/Cyborg crew have zero consumption)
    const isSynthetic = (c: CrewMember) => c.species === 'Cyborg' || c.species === 'Synthetisch' || c.disposition === 'synthetic';
    const organicCount = STATE.crew.filter(c => !isSynthetic(c)).length;
    const waterRecyclers = STATE.crew.filter(c => c.role === 'biologist' || c.role === 'medic').length;
    const waterDiscount = Math.min(0.60, waterRecyclers * 0.15 + (bioCount > 0 ? 0.15 : 0));
    const netWaterRate = organicCount * 0.06 * (1.0 - waterDiscount);
    const foodProduced = bioCount * 0.08;
    const netFoodRate = Math.max(0, (organicCount * 0.05) - foodProduced);

    STATE.waterConsumptionRate = Number(netWaterRate.toFixed(3));
    STATE.foodConsumptionRate = Number(netFoodRate.toFixed(3));

    STATE.crewBuffs = {
        thrust: Number(thrustMult.toFixed(2)),
        bioGain: Number(bioMult.toFixed(2)),
        scanSpeed: Number(scanMult.toFixed(2)),
        repairRate: Number(repair.toFixed(2)),
        stressDampening: Number(Math.max(0.1, stressDamp).toFixed(2)),
        psionicBonus: Math.round(psioBonus),
        mutationDiscount: STATE.mutationDiscount
    };

    const basePsio = STATE.mutations.synapses && STATE.mutations.synapses.purchased ? 140 : 75;
    STATE.psionicRange = basePsio + STATE.crewBuffs.psionicBonus;
}

const STORY_LOGS = [
    { time: 6, sender: "Capt. Miller", text: "Das Ding lebt! Wir sind im Bauch eines biologischen Leviathans gefangen... uralte Glyphen nennen es 'Najmafar'! Wo ist die Luft?" },
    { time: 24, sender: "Dr. Song", text: "Die Schiffswände atmen... Valeria, die Najmafar absorbiert Weltraummaterie um sich zu heilen!" },
    { time: 48, sender: "Valeria", text: "Jamal, guck dir die Messgeräte an. Die kosmische Hintergrundstrahlung... Die Sterne am Rand der Galaxie verglühen!" },
    { time: 70, sender: "Jamal", text: "Das ist kein Messfehler. Die Entropie beschleunigt sich. Die Najmafar... reist sie dorthin, wo die Sterne sterben?" },
    { time: 95, sender: "Capt. Miller", text: "Es sendet Gedankenwellen. Die Software übersetzt es als... Dschinn? Die Najmafar ist einsam." }
];
let storyIndex = 0;
let playTime = 0;

export function encryptText(text: string): string {
    const alienGlyphs = "⏁⊑⟒⋔⍜⋏☿⏁⟒⍃⍜⌰⎍⌇⌇⊑⟟⌿⌇⏃⋏⎅⌇⏁⏃⍀⌇⏁⍀⟒☍⏁⊑⟒⌇⊑⟟⌿⟟⌇⏃⌰⟟⎎⟒";
    return text.split('').map(char => {
        if (char === ' ' || char === '"' || char === '\'' || char === ':' || char === '.' || char === ',' || char === '?' || char === '!' || char === '-' || char === '(' || char === ')') return char;
        return alienGlyphs[Math.floor(Math.random() * alienGlyphs.length)];
    }).join('');
}

export function encryptCrewMessage(sender: string, text: string): string {
    let outText = text;
    if (!STATE.mutations.translator.purchased) {
        outText = encryptText(text);
    }
    return `${sender}: "${outText}"`;
}

export function updateCrewSimulation(dt: number) {
    playTime += dt;
    if (storyIndex < STORY_LOGS.length && playTime >= STORY_LOGS[storyIndex].time) {
        const logObj = STORY_LOGS[storyIndex];
        storyIndex++;
        addLogEntry("CREW", encryptCrewMessage(logObj.sender, logObj.text));
    }

    // Advance Psionic Upheaval (Doctrine Transition)
    if (STATE.doctrineTransition && STATE.doctrineTransition.active) {
        const counts = getStationCrewCounts();
        const dreamBoost = 1.0 + (counts.dream_core * 0.35); // +35% transition speed per mind in dream core
        const telepathyBoost = STATE.telepathyActive ? 2.0 : 1.0; // 2x speed when telepathy actively guides minds
        const rate = (1.0 / (STATE.doctrineTransition.duration || 25.0)) * dreamBoost * telepathyBoost;
        STATE.doctrineTransition.progress = Math.min(1.0, STATE.doctrineTransition.progress + rate * dt);
        updateParadigmModifiers();

        if (STATE.doctrineTransition.progress >= 1.0) {
            completeDoctrineShift(STATE.doctrineTransition.targetParadigm);
        }
    }

    // Active Organ-Station Real-Time Effects
    const stationCounts = getStationCrewCounts();

    // Chitin-Drüse: Auto-repair using silicon reserves when damaged
    if (stationCounts.chitin_gland > 0 && STATE.health < STATE.maxHealth) {
        const siliconCostPerHp = isTraumaActive('void_nihilism') ? 0.075 : 0.05;
        if (STATE.siliconRes >= siliconCostPerHp * dt) {
            const repairRate = 0.5 * stationCounts.chitin_gland;
            const actualRepair = Math.min(STATE.maxHealth - STATE.health, repairRate * dt);
            STATE.health += actualRepair;
            STATE.siliconRes = Math.max(0, STATE.siliconRes - siliconCostPerHp * actualRepair);
        }
    }

    // Traum-Kern: Extra mental regeneration & loneliness soothing
    if (stationCounts.dream_core > 0) {
        const mentalRegenBonus = 0.8 * stationCounts.dream_core * dt;
        STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + mentalRegenBonus);
        STATE.loneliness = Math.max(0, STATE.loneliness - 0.2 * stationCounts.dream_core * dt);

        // Passive Therapy for Big Freeze Traumas
        const ibadBonus = STATE.mutations.ibad?.purchased ? 2.0 : 1.0;
        advanceTraumaTherapy(0.35 * stationCounts.dream_core * ibadBonus * dt);
    }

    // Bio-Inkubator: Bio-energy trickle & enzyme synthesis
    if (stationCounts.bio_incubator > 0) {
        const bioTrickle = 0.2 * stationCounts.bio_incubator * dt;
        STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + bioTrickle);
    }

    // Life Support: Water & Food Consumption
    const isSynthetic = (c: CrewMember) => c.species === 'Cyborg' || c.species === 'Synthetisch' || c.disposition === 'synthetic';
    const organicMembers = STATE.crew.filter(c => !isSynthetic(c));
    const organicCount = organicMembers.length;

    const wRate = STATE.waterConsumptionRate !== undefined ? STATE.waterConsumptionRate : 0;
    const fRate = STATE.foodConsumptionRate !== undefined ? STATE.foodConsumptionRate : 0;

    if (wRate > 0) {
        STATE.waterRes = Math.max(0, (STATE.waterRes || 0) - wRate * dt);
    }
    if (fRate > 0) {
        STATE.foodRes = Math.max(0, (STATE.foodRes || 0) - fRate * dt);
    }

    const bioIncubatorCount = stationCounts.bio_incubator || 0;
    const foodProduced = bioIncubatorCount * 0.08;
    if (foodProduced > organicCount * 0.05) {
        const excessFood = (foodProduced - organicCount * 0.05) * dt;
        STATE.foodRes = Math.min(250, (STATE.foodRes || 0) + excessFood);
    }

    const isDehydrated = organicCount > 0 && (STATE.waterRes || 0) <= 0;
    const isStarving = organicCount > 0 && (STATE.foodRes || 0) <= 0;

    if (isDehydrated) {
        waterWarningCooldown -= dt;
        if (waterWarningCooldown <= 0) {
            waterWarningCooldown = 12.0;
            addLogEntry("CREW", "⚠️ DEHYDRIERUNG: Wasservorräte erschöpft! Organische Crew leidet unter akutem Durst & Panik!");
        }
    } else {
        waterWarningCooldown = Math.max(0, waterWarningCooldown - dt);
    }

    if (isStarving) {
        foodWarningCooldown -= dt;
        if (foodWarningCooldown <= 0) {
            foodWarningCooldown = 12.0;
            addLogEntry("CREW", "⚠️ NAHRUNGSMANGEL: Nährstoff-Gel aufgebraucht! Zelltod & Alterung beschleunigt!");
        }
    } else {
        foodWarningCooldown = Math.max(0, foodWarningCooldown - dt);
    }

    const totalCrew = STATE.crew.length;
    const connectedCrew = STATE.crew.filter(c => (c.stress || 0) < 70);
    const connectedCount = connectedCrew.length;
    const severedCount = totalCrew - connectedCount;
    const uniqueRoles = new Set(connectedCrew.map(c => c.role)).size;

    // 1. Loneliness & Satiety Decay System
    let targetLoneliness = 100;
    let isHarmony = false;

    if (totalCrew === 0 || connectedCount === 0) {
        targetLoneliness = 100;
    } else if (connectedCount === 1) {
        STATE.crewSatietyTimer += dt;
        const decay = Math.min(20, (STATE.crewSatietyTimer / 120) * 20);
        targetLoneliness = 45 + decay; // Single companion: 45-65% loneliness
    } else if (connectedCount === 2) {
        targetLoneliness = uniqueRoles === 2 ? 20 : 30; // 2 crew: 20-30% loneliness
    } else if (connectedCount >= 3) {
        if (uniqueRoles >= 3) {
            targetLoneliness = Math.max(0, 5 - (connectedCount - 3) * 2);
            isHarmony = true; // Complete Trio Harmony
        } else {
            targetLoneliness = Math.max(5, 15 - (connectedCount - 3) * 3);
            if (connectedCount >= 4) isHarmony = true;
        }
    }

    // Severed minds increase Najmafar's loneliness/frustration (+15% per severed crew)
    if (severedCount > 0 && connectedCount > 0) {
        targetLoneliness = Math.min(100, targetLoneliness + (severedCount * 15));
    }

    if (STATE.loneliness < targetLoneliness) {
        STATE.loneliness = Math.min(targetLoneliness, STATE.loneliness + 3 * dt);
    } else if (STATE.loneliness > targetLoneliness) {
        STATE.loneliness = Math.max(targetLoneliness, STATE.loneliness - 18 * dt);
    }

    // Relapse / Flare-Up trigger at 100% loneliness
    if (STATE.loneliness >= 100) {
        const healedTrauma = STATE.psionicTraumas?.find(t => t.healed && !t.flareUp);
        if (healedTrauma) {
            healedTrauma.flareUp = true;
            addLogEntry("CREW", `🌌 TRAUMA-RÜCKFALL: Kosmische Einsamkeit des Big Freeze holt Najmafar wieder ein! [${healedTrauma.name}] bricht auf!`);
            calculateCrewBuffs();
        }
    } else if (STATE.loneliness < 50) {
        let hadFlare = false;
        STATE.psionicTraumas?.forEach(t => {
            if (t.healed && t.flareUp) {
                t.flareUp = false;
                hadFlare = true;
            }
        });
        if (hadFlare) {
            addLogEntry("CREW", `✨ Seelische Geborgenheit: Der psionische Trauma-Rückfall klingt wieder ab.`);
            calculateCrewBuffs();
        }
    }

    if (isHarmony) {
        STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + 0.5 * dt);
        STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 0.3 * dt);
    }

    // Environmental Cosmic & Solar Radiation Check
    let ambientRadiation = 0.0;
    let radSource = '';

    if (STATE.playerPosition) {
        const distToCenterStar = STATE.playerPosition.length();
        if (distToCenterStar < 45) {
            // Solar radiation scales as player approaches central star (inside 45 units)
            const solarIntensity = Math.min(1.0, Math.max(0, (1.0 - (distToCenterStar / 45)) * 0.55));
            if (solarIntensity > ambientRadiation) {
                ambientRadiation = solarIntensity;
                radSource = distToCenterStar < 18 ? 'Solare Korona (Extrem)' : 'Zentralstern-Heliosphäre';
            }
        }
    }

    if (STATE.nearestPlanet && (STATE.nearestPlanet as any).attributes?.radiationLevel) {
        const radLevel = (STATE.nearestPlanet as any).attributes.radiationLevel;
        const radBase = radLevel === 'Extreme' ? 0.90 : (radLevel === 'High' ? 0.65 : (radLevel === 'Moderate' ? 0.35 : 0.10));
        
        let planetDist = 0;
        let hasDist = false;
        const pObj = STATE.nearestPlanet as any;
        const pPos = pObj.mesh ? pObj.mesh.position : pObj.position;
        if (STATE.playerPosition && pPos) {
            planetDist = STATE.playerPosition.distanceTo(pPos);
            hasDist = true;
        } else if (pObj.distToPlayer !== undefined) {
            planetDist = pObj.distToPlayer;
            hasDist = true;
        }

        // Planetary magnetospheric radiation zone extends up to 55 units
        if (!hasDist || planetDist < 55) {
            const falloff = hasDist ? Math.max(0.2, 1.0 - (planetDist / 55) * 0.45) : 1.0;
            const planetIntensity = radBase * falloff;
            if (planetIntensity > ambientRadiation) {
                ambientRadiation = planetIntensity;
                radSource = `${pObj.name || 'Planet'} [${radLevel}]`;
            }
        } else if (planetDist < 90) {
            const planetIntensity = radBase * 0.3;
            if (planetIntensity > ambientRadiation) {
                ambientRadiation = planetIntensity;
                radSource = `${pObj.name || 'Planet'} Magnetosphäre`;
            }
        }
    }

    const radProtection = calculateRadiationProtection();
    const effectiveRadiation = Math.max(0, ambientRadiation * (1.0 - radProtection));

    STATE.ambientRadiation = ambientRadiation;
    STATE.effectiveRadiation = effectiveRadiation;
    STATE.radiationSource = radSource;

    // Radiation causes active hull erosion if unshielded in hazardous zones (> 0.15 threshold)
    if (effectiveRadiation > 0.15) {
        const radHullDmg = (effectiveRadiation - 0.15) * 2.8 * dt;
        STATE.health = Math.max(1, STATE.health - radHullDmg);

        radWarningCooldown -= dt;
        if (radWarningCooldown <= 0) {
            radWarningCooldown = 8.0;
            const effPercent = Math.round(effectiveRadiation * 100);
            const protPercent = Math.round(radProtection * 100);
            addLogEntry("SYSTEM", `⚠️ STRAHLUNGS-EROSION: Biologische Hülle nimmt Schaden (${effPercent}% Belastung, ${protPercent}% Bio-Filterung). Schalte Chitin-Panzerung im Bio-Deck frei!`);
        }
    } else {
        radWarningCooldown = Math.max(0, radWarningCooldown - dt);
    }

    // 2. Individual Dream Matrix, Aging & Stress Loop
    let speed = STATE.playerVelocity.length();
    let speedStressModifier = speed > 10.0 ? 0.6 : 0;

    for (let i = STATE.crew.length - 1; i >= 0; i--) {
        const c = STATE.crew[i];

        // Aging Process: Radiation accelerates cellular degradation if unshielded
        const radAgingMult = 1.0 + (effectiveRadiation * 1.5);
        c.age = (c.age || 0) + (dt * radAgingMult);
        if (effectiveRadiation > 0.15) {
            c.stress = Math.min(100, c.stress + (effectiveRadiation * 1.5) * dt);
        }
        const maxLife = c.maxLifespan || 540;
        const lifeRatio = Math.min(1.0, c.age / maxLife);

        if (lifeRatio < 0.50) {
            c.ageCategory = 'vital';
        } else if (lifeRatio < 0.75) {
            c.ageCategory = 'mature';
            c.stress = Math.min(100, c.stress + 0.35 * dt);
        } else if (lifeRatio < 0.90) {
            c.ageCategory = 'senescent';
            c.stress = Math.min(100, c.stress + 0.9 * dt);
        } else {
            c.ageCategory = 'critical';
            c.stress = Math.min(100, c.stress + 1.8 * dt);
        }

        // Critical senescence warning trigger (< 10% life left)
        if (lifeRatio >= 0.90 || c.ageCategory === 'critical') {
            if (!c.criticalAlertTriggered) {
                c.criticalAlertTriggered = true;
                addLogEntry("CREW", `⚠️ KRITISCHE SENESZENZ: ${c.name} (${c.species}) erreicht das Ende der natürlichen Lebensspanne! Nutze [💉] im Party-HUD vor dem Zelltod!`);
            }
        }

        // Biological Death from Old Age
        if (c.age >= maxLife) {
            triggerCrewDeathNotification(c.name, c.species, c.avatarIcon || '👤');
            addLogEntry("SYSTEM", `⚰️ BIOLOGISCHER ZELLTOD: ${c.name} (${c.species}) ist an Altersschwäche gestorben. Biomasse resorbiert (+45 Bio-Energie).`);
            STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 45);
            STATE.loneliness = Math.min(100, STATE.loneliness + 20);

            STATE.crew.forEach(other => {
                if (other !== c) {
                    other.stress = Math.min(100, other.stress + 20);
                    other.illusionStability = Math.max(0, other.illusionStability - 15);
                }
            });

            STATE.crew.splice(i, 1);
            calculateCrewBuffs();
            continue;
        }

        // Dream Stability & Mental Stress
        const decayRate = (0.35 + c.stress * 0.006) * dt;
        c.illusionStability = Math.max(0, c.illusionStability - decayRate);

        // Paradigm-specific cognitive dissonance & stress impacts
        const disp = c.disposition || 'scholarly';
        const paradigmStressBonus = (STATE.paradigmModifiers?.stressModifier || 0) * dt;

        if (STATE.primaryParadigm === 'domination') {
            if (STATE.mentalEnergy <= 10) {
                // Shackles slipping when mental energy is low
                c.stress = Math.min(100, c.stress + 5.0 * dt);
                c.thought = "Wut flammt auf: 'Das psionische Joch schwächelt... MEUTEREI!'";
                if (Math.random() < 0.006) {
                    addLogEntry("DOKTRIN", `⚠️ MEUTEREI-ALARM: ${c.name} spürt schwindende Unterwerfungskraft und sabotiert!`);
                }
            }
        } else if (STATE.primaryParadigm === 'deception') {
            if (disp === 'scholarly' && !STATE.telepathyActive) {
                // Scholarly minds slowly pierce the matrix
                c.illusionStability = Math.max(0, c.illusionStability - 0.5 * dt);
                if (c.illusionStability < 55) {
                    c.thought = "Misstrauisch: 'Diese Station ist eine Illusion... die Sensordaten sind eine Schleife!'";
                }
            }
        } else if (STATE.primaryParadigm === 'symbiosis') {
            // Symbiotic organic health & bio-regeneration
            STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 0.15 * dt);
        }

        c.stress = Math.max(0, Math.min(100, c.stress + paradigmStressBonus));

        if (STATE.telepathyActive && STATE.mentalEnergy > 0) {
            c.stress = Math.max(0, c.stress - 7.5 * dt);
            c.illusionStability = Math.min(100, c.illusionStability + 8.0 * dt);
            c.status = "Traum-Trance";
            c.thought = "Fühlt eine warme, beruhigende Welle... 'Alles ist friedlich.'";
        } else {
            if (c.illusionStability < 35) {
                c.stress = Math.min(100, c.stress + (4.5 + speedStressModifier) * dt);
                c.status = "Panik";
                c.thought = "Verzweifelt: 'Die Wände pulsieren... das ist keine Station!'";
            } else if (c.illusionStability < 65) {
                c.stress = Math.min(100, c.stress + (1.2 + speedStressModifier) * dt);
                c.status = "Misstrauisch";
                c.thought = "Stutzt: 'Höre ich ein Atmen in den Lüftungsschächten?'";
            } else {
                c.stress = Math.max(0, c.stress - 2.0 * dt);
                c.status = "Arbeitet";
                if (c.ageCategory === 'senescent') {
                    c.thought = "Erschöpft: 'Die Jahre vergehen... aber die Sterne bleiben ewig.'";
                } else {
                    c.thought = "Konzentriert: 'Sternenkartierung verläuft nach Plan.'";
                }
            }
        }

        // Life Support: Dehydration & Starvation on organic crew members
        if (!isSynthetic(c)) {
            if (isDehydrated) {
                c.stress = Math.min(100, c.stress + 1.2 * dt);
                c.illusionStability = Math.max(0, c.illusionStability - 1.0 * dt);
            }
            if (isStarving) {
                c.stress = Math.min(100, c.stress + 0.9 * dt);
                c.age = (c.age || 0) + 0.5 * dt; // Accelerated aging
            }
            if (!isDehydrated && !isStarving) {
                c.stress = Math.max(0, c.stress - 0.25 * dt); // Satiated comfort
            }
        }

        // Symbiotic Perks from calm minds
        if (c.illusionStability >= 50) {
            if (c.role === 'engineer') {
                STATE.health = Math.min(STATE.maxHealth, STATE.health + 0.25 * dt);
            } else if (c.role === 'biologist') {
                STATE.bioRes += 0.1 * dt;
            } else if (c.role === 'psychologist') {
                STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + 1.5 * dt);
            }
        }

        // Multi-Stage Stress Escalation & Crisis Management
        if (c.stress >= 85) {
            c.escalationStage = 3;
            c.connectionStatus = 'severed';

            if (c.crisisTimer !== undefined && c.crisisTimer > 0 && !c.crisisActive) {
                // In post-sabotage cooldown
                c.crisisTimer = Math.max(0, c.crisisTimer - dt);
            } else if (!c.crisisActive) {
                // Start crisis countdown! 15 seconds reaction window
                c.crisisActive = true;
                c.crisisTimer = 15.0;
                addLogEntry("CREW", `⚠️ KRISEN-WARNUNG: ${c.name} steht vor einem Nervenzusammenbruch! Sabotage in 15s – Beruhige den Geist via [LEERTASTE] oder Traum-Kern!`);
            } else {
                c.crisisTimer = Math.max(0, c.crisisTimer - dt);
                if (c.crisisTimer <= 0) {
                    triggerCrewSabotageEvent(c);
                }
            }
        } else if (c.stress >= 70) {
            c.escalationStage = 2;
            c.connectionStatus = 'severed';
            if (c.crisisActive && c.stress < 80) {
                c.crisisActive = false;
                c.crisisTimer = undefined;
                addLogEntry("CREW", `✨ KRISE ABGEWENDET: ${c.name} hat sich beruhigt. Sabotagegefahr gebannt.`);
            }
            c.status = "Verbindung gekappt";
        } else if (c.stress >= 45) {
            c.escalationStage = 1;
            c.connectionStatus = 'dissonant';
            if (c.crisisActive) {
                c.crisisActive = false;
                c.crisisTimer = undefined;
            }
        } else {
            c.escalationStage = 1;
            c.connectionStatus = 'connected';
            if (c.crisisActive) {
                c.crisisActive = false;
                c.crisisTimer = undefined;
            }
        }
    }

    // 3. Mental Energy Drain / Regen
    if (STATE.telepathyActive) {
        const drain = 8.5 * (STATE.paradigmModifiers?.mentalDrainMult || 1.0);
        STATE.mentalEnergy = Math.max(0, STATE.mentalEnergy - drain * dt);
        if (STATE.mentalEnergy === 0) {
            toggleTelepathy();
            addLogEntry("SYSTEM", "Mentale Reserven erschöpft! Telepathische Traum-Matrix flackert.");
        }
    } else {
        let regenSpeed = STATE.mutations.synapses && STATE.mutations.synapses.purchased ? 7.0 * dt : 3.5 * dt;
        if (isTraumaActive('echo_paranoia')) {
            regenSpeed *= 0.75; // -25% mental regen debuff from Echo-Paranoia
        }
        STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + regenSpeed);
    }

    // 4. Periodic Multi-Crew Dialogue
    STATE.crewDialogueTimer -= dt;
    if (STATE.crewDialogueTimer <= 0 && STATE.crew.length >= 2) {
        STATE.crewDialogueTimer = 20 + Math.random() * 8;
        triggerMultiCrewDialogue();
    }

    // Update Crew DOM cards throttled when deck modal is open (smooth live-ticks)
    deckLiveUpdateTimer += dt;
    if (deckLiveUpdateTimer >= 0.2) {
        deckLiveUpdateTimer = 0;
        renderCrewUI(false);
    }
}

// User Action: Bio-Rejuvenation (Extends Lifespan & Reduces Age)
export function rejuvenateCrewMember(id: number) {
    const member = STATE.crew.find(c => c.id === id);
    if (!member) return;

    const stationCounts = getStationCrewCounts();
    const bioDiscount = Math.min(0.5, stationCounts.bio_incubator * 0.15);
    const requiredBio = Math.round(20 * (1 - bioDiscount));
    const requiredRes = Math.round(10 * (1 - bioDiscount));

    if (STATE.bioEnergy < requiredBio || STATE.bioRes < requiredRes) {
        addLogEntry("SYSTEM", `Zu wenig Bio-Energie oder Biomasse für Zell-Verjüngung (benötigt ${requiredBio} Bio / ${requiredRes} Biomasse)!`);
        return;
    }

    STATE.bioEnergy = Math.max(0, STATE.bioEnergy - requiredBio);
    STATE.bioRes = Math.max(0, STATE.bioRes - requiredRes);

    const maxLife = member.maxLifespan || 540;
    member.age = Math.max(0, member.age - maxLife * 0.35);
    if (member.age / maxLife < 0.85) {
        member.criticalAlertTriggered = false;
    }
    member.stress = Math.max(0, member.stress - 25);
    member.rejuvenationCount = (member.rejuvenationCount || 0) + 1;

    playBioHarvestSound();
    addLogEntry("SYSTEM", `💉 ZELL-REGENERATION: Telomere von ${member.name} erneuert (-35% Alter)! Kosten: ${requiredBio} Bio / ${requiredRes} Biomasse.`);
    calculateCrewBuffs();
    renderCrewUI(true);
    updatePartyGrid();
}

// User Action: Genome Assimilation (Sacrifice crew for permanent resources)
export function assimilateCrewMember(id: number) {
    const idx = STATE.crew.findIndex(c => c.id === id);
    if (idx === -1) return;
    const member = STATE.crew[idx];

    STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 50);
    STATE.bioRes += 35;
    STATE.siliconRes += 20;

    addLogEntry("SYSTEM", `🧬 GENOM-ASSIMILATION: ${member.name} (${member.species}) aufgelöst: +50 Bio-Energie, +35 Biomasse & +20 Silizium.`);
    playCrashSound();

    STATE.crew.splice(idx, 1);
    calculateCrewBuffs();
    renderCrewUI(true);
    updatePartyGrid();
}

let lastRenderedDeckStructure = '';
let deckLiveUpdateTimer = 0;

function updateDeckLiveElements(): void {
    const clusters = getSpeciesClusters();
    clusters.forEach(cl => {
        const clusterEl = document.getElementById(`deck-cluster-${cl.speciesName}`);
        if (clusterEl) {
            let col = '#10b981';
            if (cl.avgAgePercent < 15) col = '#f43f5e';
            else if (cl.avgAgePercent < 45) col = '#fb923c';

            const vitVal = clusterEl.querySelector<HTMLElement>('.deck-cluster-vitality-val');
            if (vitVal) {
                vitVal.innerText = `${cl.avgAgePercent}%`;
                vitVal.style.color = col;
            }
            const stabVal = clusterEl.querySelector<HTMLElement>('.deck-cluster-stability-val');
            if (stabVal) stabVal.innerText = `${cl.avgStability}%`;

            const stressVal = clusterEl.querySelector<HTMLElement>('.deck-cluster-stress-val');
            if (stressVal) {
                stressVal.innerText = `${cl.avgStress}%`;
                stressVal.style.color = cl.avgStress > 50 ? '#ef4444' : '#f59e0b';
            }
        }
    });

    STATE.crew.forEach(c => {
        const card = document.getElementById(`deck-crew-card-${c.id}`);
        if (!card) return;

        const maxLife = c.maxLifespan || 540;
        const currentAge = Math.min(maxLife, Math.floor(c.age || 0));
        const lifePercent = Math.max(0, Math.min(100, Math.round((1.0 - (currentAge / maxLife)) * 100)));

        let ageLabel = '🟢 Vital';
        let ageColor = '#00ff88';
        if (c.ageCategory === 'mature') {
            ageLabel = '🟡 Reife';
            ageColor = '#facc15';
        } else if (c.ageCategory === 'senescent') {
            ageLabel = '🟠 Seneszenz';
            ageColor = '#fb923c';
        } else if (c.ageCategory === 'critical') {
            ageLabel = '🔴 Altersschwäche';
            ageColor = '#f43f5e';
        }

        const ageMin = Math.floor(currentAge / 60);
        const ageSec = String(currentAge % 60).padStart(2, '0');
        const maxMin = Math.floor(maxLife / 60);

        const ageText = card.querySelector<HTMLElement>('.deck-age-text');
        if (ageText) ageText.innerText = `⏳ Alter: ${ageMin}:${ageSec} / ${maxMin}:00 Min.`;

        const agePill = card.querySelector<HTMLElement>('.deck-age-pill');
        if (agePill) {
            agePill.innerText = `${ageLabel} (${lifePercent}% übrig)`;
            agePill.style.color = ageColor;
        }

        const ageFill = card.querySelector<HTMLElement>('.deck-age-fill');
        if (ageFill) {
            ageFill.style.width = `${lifePercent}%`;
            ageFill.style.background = ageColor;
        }

        const stabFill = card.querySelector<HTMLElement>('.deck-stability-fill');
        if (stabFill) stabFill.style.width = `${c.illusionStability}%`;

        const stabVal = card.querySelector<HTMLElement>('.deck-stability-val');
        if (stabVal) stabVal.innerText = `${Math.round(c.illusionStability)}%`;

        const stressFill = card.querySelector<HTMLElement>('.deck-stress-fill');
        if (stressFill) {
            stressFill.style.width = `${c.stress}%`;
            stressFill.style.background = c.stress > 70 ? '#ef4444' : '#f59e0b';
        }

        const stressVal = card.querySelector<HTMLElement>('.deck-stress-val');
        if (stressVal) stressVal.innerText = `${Math.round(c.stress)}%`;

        const thoughtEl = card.querySelector<HTMLElement>('.deck-thought-text');
        if (thoughtEl) thoughtEl.innerText = `💭 "${c.thought}"`;

        const connBadge = card.querySelector<HTMLElement>('.deck-connection-badge');
        if (connBadge) {
            if (c.crisisActive && c.crisisTimer !== undefined) {
                connBadge.innerText = `⚠️ SABOTAGE IN ${Math.ceil(c.crisisTimer)}s`;
                connBadge.style.color = '#fff';
                connBadge.style.background = '#ef4444';
            } else if (c.connectionStatus === 'severed') {
                connBadge.innerText = '🔒 Verbindung gekappt';
                connBadge.style.color = '#ef4444';
                connBadge.style.background = 'rgba(239,68,68,0.15)';
            } else if (c.connectionStatus === 'dissonant') {
                connBadge.innerText = '⚡ Dissonant';
                connBadge.style.color = '#f59e0b';
                connBadge.style.background = 'rgba(245,158,11,0.15)';
            } else {
                connBadge.innerText = '✓ Verbunden';
                connBadge.style.color = '#10b981';
                connBadge.style.background = 'rgba(16,185,129,0.15)';
            }
        }
    });

    if (STATE.psionicTraumas) {
        const traumaBadge = document.getElementById('big-freeze-trauma-status-badge');
        const activeCount = STATE.psionicTraumas.filter(t => !t.healed || t.flareUp).length;
        if (traumaBadge) {
            traumaBadge.innerText = activeCount === 0 ? '✓ Alle Geheilt' : `${activeCount} Aktiv`;
            traumaBadge.style.color = activeCount === 0 ? '#10b981' : '#f43f5e';
        }
        STATE.psionicTraumas.forEach(t => {
            const bar = document.getElementById(`trauma-prog-${t.id}`);
            if (bar) bar.style.width = `${t.therapyProgress}%`;
            const val = document.getElementById(`trauma-status-${t.id}`);
            if (val) {
                if (t.flareUp) {
                    val.innerText = '⚠️ Rückfall (Einsamkeit)';
                    val.style.color = '#f43f5e';
                } else if (t.healed) {
                    val.innerText = '✓ Geheilt';
                    val.style.color = '#10b981';
                } else {
                    val.innerText = `${Math.round(t.therapyProgress)}% Verarbeitet`;
                    val.style.color = '#c084fc';
                }
            }
        });
    }
}

export function renderCrewUI(force = false) {
    const modal = document.getElementById('deck-modal');
    const isModalOpen = modal ? modal.style.display === 'flex' : false;
    if (!isModalOpen && !force) return;

    const container = document.getElementById('crew-list-container');
    const badge = document.getElementById('crew-count-badge');
    const capText = document.getElementById('crew-capacity-text');
    const synTitle = document.getElementById('crew-synergy-title');
    const synDesc = document.getElementById('crew-synergy-desc');
    const synBanner = document.getElementById('crew-synergy-banner');

    if (badge) badge.innerText = String(STATE.crew.length);
    if (capText) capText.innerText = `${STATE.crew.length} / ${STATE.maxCrewCapacity}`;

    const uniqueRoles = new Set(STATE.crew.map(c => c.role)).size;
    const totalCrew = STATE.crew.length;
    const rolesPresent = new Set(STATE.crew.map(c => c.role));

    // Update Role Synergy Slot visual highlights
    const slotPilot = document.getElementById('slot-pilot');
    const slotBio = document.getElementById('slot-biologist');
    const slotEng = document.getElementById('slot-engineer');
    const slotPsych = document.getElementById('slot-psychologist');

    if (slotPilot) slotPilot.className = rolesPresent.has('pilot') ? 'role-slot active' : 'role-slot';
    if (slotBio) slotBio.className = rolesPresent.has('biologist') ? 'role-slot active' : 'role-slot';
    if (slotEng) slotEng.className = rolesPresent.has('engineer') ? 'role-slot active' : 'role-slot';
    if (slotPsych) slotPsych.className = (rolesPresent.has('psychologist') || rolesPresent.has('cryptologist')) ? 'role-slot active' : 'role-slot';

    // Render Organ Stations Grid in left schematic column
    const stationsGrid = document.getElementById('organ-stations-grid');
    if (stationsGrid) {
        const counts = getStationCrewCounts();
        const stationKeys: OrganStationId[] = ['flight_synapse', 'chitin_gland', 'bio_incubator', 'dream_core'];
        stationsGrid.innerHTML = stationKeys.map(key => {
            const st = ORGAN_STATIONS[key];
            const cCount = counts[key] || 0;
            return `
                <div class="organ-station-card ${cCount > 0 ? 'active' : ''}">
                    <div class="organ-station-header">
                        <span>${st.icon} ${st.name}</span>
                        <span class="organ-station-count">${cCount}</span>
                    </div>
                    <div class="organ-station-desc">${st.description}</div>
                </div>
            `;
        }).join('');
    }

    // Update Life Support and Commodity Status in Left Column
    const lifeBadge = document.getElementById('life-support-status-badge');
    const waterStatusEl = document.getElementById('deck-water-status');
    const foodStatusEl = document.getElementById('deck-food-status');
    const biologistBoostText = document.getElementById('deck-biologist-boost-text');

    const waterRate = STATE.waterConsumptionRate || 0;
    const foodRate = STATE.foodConsumptionRate || 0;
    const isSyntheticMember = (c: CrewMember) => c.species === 'Cyborg' || c.species === 'Synthetisch' || c.disposition === 'synthetic';
    const organicCount = STATE.crew.filter(c => !isSyntheticMember(c)).length;

    if (waterStatusEl) {
        waterStatusEl.innerHTML = `💧 ${Math.floor(STATE.waterRes || 0)}L <span style="font-size:0.6rem; color:#94a3b8;">(-${waterRate.toFixed(2)}/s)</span>`;
    }
    if (foodStatusEl) {
        foodStatusEl.innerHTML = `🍞 ${Math.floor(STATE.foodRes || 0)}kg <span style="font-size:0.6rem; color:#94a3b8;">(-${foodRate.toFixed(2)}/s)</span>`;
    }
    if (lifeBadge) {
        if (organicCount === 0) {
            lifeBadge.innerText = "Synthetisch / Leer";
            lifeBadge.style.color = "#94a3b8";
        } else if ((STATE.waterRes || 0) <= 0 || (STATE.foodRes || 0) <= 0) {
            lifeBadge.innerText = "⚠️ KRITISCHER MANGEL";
            lifeBadge.style.color = "#ef4444";
        } else {
            lifeBadge.innerText = "✓ Stabil";
            lifeBadge.style.color = "#10b981";
        }
    }
    if (biologistBoostText) {
        const discountPct = Math.round((STATE.mutationDiscount || 0) * 100);
        if (discountPct > 0) {
            biologistBoostText.innerText = `🧪 Biologen-Boost aktiv: -${discountPct}% Mutationskosten`;
            biologistBoostText.style.display = 'block';
        } else {
            biologistBoostText.style.display = 'none';
        }
    }

    if (synBanner && synTitle && synDesc) {
        if (totalCrew === 0) {
            synBanner.className = 'crew-synergy-banner';
            synTitle.innerText = "🌌 Kosmische Einsamkeit (100%)";
            synDesc.innerText = "Keine Geister im Kollektiv. Entführe Wesen von habitablen Planeten, um Einsamkeit zu lindern.";
        } else if (totalCrew === 1) {
            synBanner.className = 'crew-synergy-banner';
            synTitle.innerText = `🌱 Erste Bindung (${Math.round(STATE.loneliness)}% Einsamkeit)`;
            synDesc.innerText = `1 Geist an Bord (${STATE.crew[0]?.roleName || 'Begleiter'}). Finde weitere Wesen mit anderen Rollen für Synergien!`;
        } else if (totalCrew >= 2 && uniqueRoles === 1) {
            synBanner.className = 'crew-synergy-banner';
            synTitle.innerText = `👥 Doppelter Rollen-Fokus (${Math.round(STATE.loneliness)}% Einsamkeit)`;
            synDesc.innerText = `${totalCrew}x selbe Rolle an Bord: Rollen-Effekt verstärkt! Finde eine andere Rolle für "Duale Resonanz".`;
        } else if (uniqueRoles === 2) {
            synBanner.className = 'crew-synergy-banner';
            synTitle.innerText = `✨ Duale Resonanz (${Math.round(STATE.loneliness)}% Einsamkeit)`;
            synDesc.innerText = "2 verschiedene Rollen im Einklang! Einsamkeit stark gesenkt. Noch 1 weitere Rolle für 'Kosmische Harmonie'.";
        } else if (uniqueRoles >= 3 || totalCrew >= 3) {
            synBanner.className = 'crew-synergy-banner harmony';
            synTitle.innerText = "💫 Kosmische Harmonie (0% Einsamkeit)";
            synDesc.innerText = "Diverses Trio aktiv! Einsamkeit vollständig beseitigt & passive Bio-/Mentalenergie-Regeneration online!";
        }
    }

    // Update Big Freeze Trauma Panel
    const traumaList = document.getElementById('big-freeze-trauma-list');
    const traumaBadge = document.getElementById('big-freeze-trauma-status-badge');
    if (traumaList && STATE.psionicTraumas) {
        const activeCount = STATE.psionicTraumas.filter(t => !t.healed || t.flareUp).length;
        if (traumaBadge) {
            traumaBadge.innerText = activeCount === 0 ? '✓ Alle Geheilt' : `${activeCount} Aktiv`;
            traumaBadge.style.color = activeCount === 0 ? '#10b981' : '#f43f5e';
        }

        traumaList.innerHTML = STATE.psionicTraumas.map(t => {
            const isActive = !t.healed || t.flareUp;
            const isFlare = t.flareUp;
            let statusText = '✓ Geheilt';
            let statusColor = '#10b981';
            if (isFlare) {
                statusText = '⚠️ Rückfall (Einsamkeit)';
                statusColor = '#f43f5e';
            } else if (!t.healed) {
                statusText = `${Math.round(t.therapyProgress)}% Verarbeitet`;
                statusColor = '#c084fc';
            }

            return `
                <div class="trauma-item" style="background: rgba(30,41,59,0.6); padding: 5px 7px; border-radius: 4px; border: 1px solid ${isActive ? 'rgba(192,132,252,0.3)' : 'rgba(16,185,129,0.3)'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                        <span style="font-size: 0.68rem; font-weight: 700; color: ${isActive ? '#f8fafc' : '#94a3b8'};">
                            ${t.icon} ${t.name}
                        </span>
                        <span id="trauma-status-${t.id}" style="font-size: 0.60rem; font-weight: bold; color: ${statusColor};">${statusText}</span>
                    </div>
                    <div style="font-size: 0.58rem; color: #94a3b8; margin-bottom: 3px;">
                        ${t.effectDescription}
                    </div>
                    ${!t.healed ? `
                        <div style="height: 3px; background: rgba(0,0,0,0.5); border-radius: 2px; overflow: hidden;">
                            <div id="trauma-prog-${t.id}" style="width: ${t.therapyProgress}%; height: 100%; background: linear-gradient(90deg, #c084fc, #38bdf8);"></div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    if (!container) return;

    // Build Paradigm & Sub-Codex Header Selector
    const p = STATE.primaryParadigm || 'deception';
    const sub = STATE.activeSubCodex || 'benevolent_facade';
    const mods = STATE.paradigmModifiers || { thrustBonus: 0, stealthBonus: 0, mentalDrainMult: 1.0, bioRegenBonus: 0, harmonyBonus: 0 };

    let paradigmHtml = '';
    if (p === 'neutral') {
        if (STATE.crew.length === 0) {
            paradigmHtml = `
                <div class="paradigm-control-card glass-panel" style="margin-bottom: 12px; padding: 10px; border: 1px solid rgba(148,163,184,0.3); border-radius: 6px; background: rgba(15,23,42,0.85); text-align: center;">
                    <div style="font-size: 0.78rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                        🌌 Kosmische Isolation • Neutrale Haltung
                    </div>
                    <div style="font-size: 0.65rem; color: #cbd5e1; line-height: 1.4;">
                        Najmafar schweift einsam durch das All. Ohne Kontakt zu intelligentem Leben ist noch keine Doktrin erwacht.
                    </div>
                </div>
            `;
        } else {
            paradigmHtml = `
                <div class="paradigm-control-card glass-panel" style="margin-bottom: 12px; padding: 10px; border: 1px solid #c084fc; border-radius: 6px; background: rgba(88,28,135,0.3); text-align: center;">
                    <div style="font-size: 0.78rem; font-weight: 700; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                        ✨ Erstkontakt: Doktrin-Entscheidung
                    </div>
                    <div style="font-size: 0.65rem; color: #cbd5e1; margin-bottom: 8px;">
                        Ein fremdes Wesen ist an Bord! Wähle Najmafars prägende Gesinnung:
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
                        <button onclick="window.chooseFirstContactDoctrine('domination')" style="padding: 6px; font-size: 0.68rem; font-weight: bold; border-radius: 4px; border: 1px solid #ef4444; background: rgba(239,68,68,0.3); color: #fff; cursor: pointer;">
                            ⚡ Herrschaft
                        </button>
                        <button onclick="window.chooseFirstContactDoctrine('deception')" style="padding: 6px; font-size: 0.68rem; font-weight: bold; border-radius: 4px; border: 1px solid #38bdf8; background: rgba(56,189,248,0.3); color: #fff; cursor: pointer;">
                            🔮 Täuschung
                        </button>
                        <button onclick="window.chooseFirstContactDoctrine('symbiosis')" style="padding: 6px; font-size: 0.68rem; font-weight: bold; border-radius: 4px; border: 1px solid #10b981; background: rgba(16,185,129,0.3); color: #fff; cursor: pointer;">
                            🌱 Symbiose
                        </button>
                    </div>
                </div>
            `;
        }
    } else {
        let subOptions: { id: SubCodex; label: string }[] = [];
        if (p === 'domination') {
            subOptions = [
                { id: 'gunboat_diplomacy', label: '⚔️🤝 Ehrfurchts-Vertrag (Gewalt + Diplo)' },
                { id: 'iron_discipline', label: '⚔️⛓️ Eiserne Disziplin (Gewalt + Gewalt)' },
                { id: 'nightmare_terror', label: '⚔️👁️ Albtraum-Matrix (Gewalt + Horror)' }
            ];
        } else if (p === 'deception') {
            subOptions = [
                { id: 'benevolent_facade', label: '🔮🤝 Falsche Utopie (Täuschung + Diplo)' },
                { id: 'illusory_matrix', label: '🔮✨ Perfekte Matrix (Hoher Stealth)' },
                { id: 'nightmare_terror', label: '🔮👁️ Albtraum-Matrix (Schockstarre)' }
            ];
        } else {
            subOptions = [
                { id: 'living_symbiosis', label: '🌱🧬 Lebendige Symbiose (Reine Harmonie)' },
                { id: 'pragmatic_accord', label: '🌱⚖️ Pragmatisches Abkommen (Diplo)' },
                { id: 'gunboat_diplomacy', label: '🌱⚔️ Schutz-Pakt (Stärke + Diplo)' }
            ];
        }

        let transitionHtml = '';
        if (STATE.doctrineTransition && STATE.doctrineTransition.active) {
            const prog = Math.min(100, Math.round(STATE.doctrineTransition.progress * 100));
            const toNames: Record<PrimaryParadigm, string> = {
                domination: "⚡ Herrschaft",
                deception: "🔮 Täuschung",
                symbiosis: "🌱 Symbiose",
                neutral: "🌌 Neutral"
            };
            const targetTitle = toNames[STATE.doctrineTransition.targetParadigm];
            transitionHtml = `
                <div class="doctrine-transition-card" style="margin-bottom: 8px; padding: 6px 8px; border-radius: 4px; background: rgba(88,28,135,0.4); border: 1px solid rgba(168,85,247,0.7);">
                    <div style="display: flex; justify-content: space-between; font-size: 0.65rem; font-weight: 700; color: #f8fafc; margin-bottom: 3px;">
                        <span>🌀 Psionische Umwälzung ➔ ${targetTitle}</span>
                        <span style="color: #38bdf8;">${prog}%</span>
                    </div>
                    <div style="height: 5px; background: rgba(0,0,0,0.5); border-radius: 3px; overflow: hidden;">
                        <div class="transition-fill-bar" style="width: ${prog}%; height: 100%; background: linear-gradient(90deg, #a855f7, #38bdf8);"></div>
                    </div>
                    <div style="font-size: 0.58rem; color: #cbd5e1; margin-top: 3px;">
                        Geisteshaltung wandelt sich... <em>(Traum-Kern & Telepathie beschleunigen)</em>
                    </div>
                </div>
            `;
        }

        paradigmHtml = `
            <div class="paradigm-control-card glass-panel" style="margin-bottom: 12px; padding: 8px 10px; border: 1px solid rgba(168,85,247,0.3); border-radius: 6px; background: rgba(15,23,42,0.75);">
                ${transitionHtml}
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 0.72rem; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.5px;">🧠 Psionische Schiffs-Doktrin</span>
                    <span style="font-size: 0.65rem; color: #38bdf8;">Schub: +${Math.round(mods.thrustBonus * 100)}% | Stealth: +${Math.round(mods.stealthBonus * 100)}% | Drain: x${mods.mentalDrainMult.toFixed(2)}</span>
                </div>
                
                <!-- Primary Paradigm Tabs -->
                <div class="paradigm-tabs" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-bottom: 6px;">
                    <button class="paradigm-btn ${p === 'domination' ? 'active' : ''}" onclick="window.setPrimaryParadigm('domination')" style="padding: 4px 6px; font-size: 0.68rem; border-radius: 4px; border: 1px solid ${p === 'domination' ? '#ef4444' : 'rgba(255,255,255,0.1)'}; background: ${p === 'domination' ? 'rgba(239,68,68,0.25)' : 'rgba(0,0,0,0.3)'}; color: #f8fafc; cursor: pointer;">
                        ⚡ Herrschaft
                    </button>
                    <button class="paradigm-btn ${p === 'deception' ? 'active' : ''}" onclick="window.setPrimaryParadigm('deception')" style="padding: 4px 6px; font-size: 0.68rem; border-radius: 4px; border: 1px solid ${p === 'deception' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background: ${p === 'deception' ? 'rgba(56,189,248,0.25)' : 'rgba(0,0,0,0.3)'}; color: #f8fafc; cursor: pointer;">
                        🔮 Täuschung
                    </button>
                    <button class="paradigm-btn ${p === 'symbiosis' ? 'active' : ''}" onclick="window.setPrimaryParadigm('symbiosis')" style="padding: 4px 6px; font-size: 0.68rem; border-radius: 4px; border: 1px solid ${p === 'symbiosis' ? '#10b981' : 'rgba(255,255,255,0.1)'}; background: ${p === 'symbiosis' ? 'rgba(16,185,129,0.25)' : 'rgba(0,0,0,0.3)'}; color: #f8fafc; cursor: pointer;">
                        🌱 Symbiose
                    </button>
                </div>

                <!-- Sub-Codex Row -->
                <div class="sub-codex-row" style="display: flex; gap: 4px; flex-wrap: wrap;">
                    ${subOptions.map(opt => `
                        <button class="sub-codex-btn ${sub === opt.id ? 'active' : ''}" onclick="window.setActiveSubCodex('${opt.id}')" style="flex: 1; padding: 3px 6px; font-size: 0.62rem; border-radius: 3px; border: 1px solid ${sub === opt.id ? '#c084fc' : 'rgba(255,255,255,0.08)'}; background: ${sub === opt.id ? 'rgba(192,132,252,0.3)' : 'rgba(0,0,0,0.25)'}; color: ${sub === opt.id ? '#fff' : '#cbd5e1'}; cursor: pointer;">
                            ${opt.label}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    const clusters = getSpeciesClusters();
    const useClustering = STATE.crew.length >= 6 || clusters.some(cl => cl.count >= 4);
    const expandedKey = getExpandedClustersKey();
    const transKey = STATE.doctrineTransition?.active ? Math.round(STATE.doctrineTransition.progress * 10) : 'none';
    const stationKey = STATE.crew.map(c => `${c.id}_${c.station}`).join('_');
    const structureKey = `${p}_${sub}_${useClustering}_${expandedKey}_${transKey}_${stationKey}_` + STATE.crew.map(c => `${c.id}_${c.ageCategory}`).join('|');

    if (!force && structureKey === lastRenderedDeckStructure) {
        updateDeckLiveElements();
        return;
    }
    lastRenderedDeckStructure = structureKey;

    if (STATE.crew.length === 0) {
        container.innerHTML = paradigmHtml + `
            <div class="matrix-empty-card">
                <span class="highlight">Keine Vernunftbegabten Wesen</span>
                Die psionische Traum-Matrix ist leer. Das Schiff leidet unter existenzieller kosmischer Einsamkeit.<br><br>
                <em>Scanne habitable Planeten nach intelligentem Leben und starte eine psionische Entführung [F]!</em>
            </div>
        `;
        return;
    }

    let html = paradigmHtml;

    if (useClustering) {
        // Render Clustered Species Views
        clusters.forEach(cl => {
            let dispIcon = '🔬';
            let dispLabel = 'Wissenschaft';
            if (cl.disposition === 'martial') { dispIcon = '⚔️'; dispLabel = 'Kriegerisch'; }
            else if (cl.disposition === 'empathic') { dispIcon = '🍄'; dispLabel = 'Empathisch'; }
            else if (cl.disposition === 'synthetic') { dispIcon = '🤖'; dispLabel = 'Synthetisch'; }
            else if (cl.disposition === 'lithoid') { dispIcon = '💠'; dispLabel = 'Lithoid'; }

            html += `
                <div id="deck-cluster-${cl.speciesName}" class="species-cluster-card glass-panel" style="margin-bottom: 10px; padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(30,41,59,0.5);">
                    <div class="species-cluster-header" onclick="window.toggleCluster('${cl.speciesName.replace(/'/g, "\\'")}')" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.2rem;">${cl.avatarIcon}</span>
                            <div>
                                <span style="font-weight: 700; color: ${cl.speciesColor}; font-size: 0.82rem;">${cl.speciesName}</span>
                                <span style="font-size: 0.65rem; background: rgba(56,189,248,0.2); color: #38bdf8; padding: 1px 5px; border-radius: 3px; margin-left: 4px;">${cl.count}x Individuen</span>
                                <span style="font-size: 0.65rem; color: #94a3b8; margin-left: 4px;">${dispIcon} ${dispLabel}</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 6px;" onclick="event.stopPropagation()">
                            <button class="crew-action-btn" onclick="event.stopPropagation(); window.rejuvenateCluster('${cl.speciesName.replace(/'/g, "\\'")}')" style="padding: 2px 6px; font-size: 0.62rem; cursor: pointer; background: rgba(16,185,129,0.3); border: 1px solid #10b981; color: #fff; border-radius: 3px;" title="Verjüngt alle Individuen dieser Spezies (-35% Alter)">
                                💉 Kollektiv-Verjüngung
                            </button>
                            <button class="crew-action-btn" onclick="event.stopPropagation(); window.toggleCluster('${cl.speciesName.replace(/'/g, "\\'")}')" style="padding: 2px 6px; font-size: 0.62rem; cursor: pointer; background: rgba(168,85,247,0.3); border: 1px solid #a855f7; color: #fff; border-radius: 3px;">
                                ${cl.isExpanded ? '▲ Zuklappen' : '▼ Aufklappen (' + cl.count + ')'}
                            </button>
                        </div>
                    </div>

                    <!-- Clustered Averages Bars -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-top: 6px; font-size: 0.65rem;">
                        <div>
                            <span style="color: #94a3b8;">⏳ Vitalität:</span> <strong class="deck-cluster-vitality-val" style="color: #10b981;">${cl.avgAgePercent}%</strong>
                        </div>
                        <div>
                            <span style="color: #94a3b8;">🔮 Stabilität:</span> <strong class="deck-cluster-stability-val" style="color: #a855f7;">${cl.avgStability}%</strong>
                        </div>
                        <div>
                            <span style="color: #94a3b8;">⚡ Stress:</span> <strong class="deck-cluster-stress-val" style="color: ${cl.avgStress > 50 ? '#ef4444' : '#f59e0b'};">${cl.avgStress}%</strong>
                        </div>
                    </div>

                    <!-- Collective Station Assignment Row -->
                    <div class="station-switch-row" onclick="event.stopPropagation()" style="margin-top: 6px; padding: 4px 0 0 0; border-top: 1px solid rgba(255,255,255,0.06);">
                        <span style="font-size: 0.60rem; color: #94a3b8;">Kollektiv-Station:</span>
                        <button class="station-mini-btn" onclick="window.setSpeciesClusterStation('${cl.speciesName.replace(/'/g, "\\'")}', 'flight_synapse')" title="Alle auf Flug-Synapse">🚀 Flug</button>
                        <button class="station-mini-btn" onclick="window.setSpeciesClusterStation('${cl.speciesName.replace(/'/g, "\\'")}', 'chitin_gland')" title="Alle auf Chitin-Drüse">🛡️ Chitin</button>
                        <button class="station-mini-btn" onclick="window.setSpeciesClusterStation('${cl.speciesName.replace(/'/g, "\\'")}', 'bio_incubator')" title="Alle auf Bio-Inkubator">🧪 Inkubator</button>
                        <button class="station-mini-btn" onclick="window.setSpeciesClusterStation('${cl.speciesName.replace(/'/g, "\\'")}', 'dream_core')" title="Alle auf Traum-Kern">🔮 Traum</button>
                    </div>

                    <!-- Expanded Nested Cards -->
                    ${cl.isExpanded ? `
                        <div class="cluster-expanded-list" style="margin-top: 8px; padding-left: 8px; border-left: 2px solid ${cl.speciesColor};">
                            ${cl.members.map(c => renderSingleCrewMemberHTML(c)).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        });
    } else {
        // Render Individual Cards Directly
        STATE.crew.forEach(c => {
            html += renderSingleCrewMemberHTML(c);
        });
    }

    container.innerHTML = html;
}

function renderSingleCrewMemberHTML(c: CrewMember): string {
    let cardClass = 'crew-member';
    if (c.illusionStability < 35 || c.stress > 70) cardClass += ' panic';
    else if (c.illusionStability < 65 || c.stress > 45) cardClass += ' suspicious';

    const maxLife = c.maxLifespan || 540;
    const currentAge = Math.min(maxLife, Math.floor(c.age || 0));
    const lifePercent = Math.max(0, Math.min(100, Math.round((1.0 - (currentAge / maxLife)) * 100)));

    let speciesTag = '👨‍🚀 Mortal';
    if (c.speciesType === 'ephemeral') speciesTag = '🪲 Ephemeral';
    else if (c.speciesType === 'longlived') speciesTag = '🤖 Synthet';
    else if (c.speciesType === 'ancient') speciesTag = '💎 Uralt';

    let ageLabel = '🟢 Vital';
    let ageColor = '#00ff88';
    if (c.ageCategory === 'mature') {
        ageLabel = '🟡 Reife';
        ageColor = '#facc15';
    } else if (c.ageCategory === 'senescent') {
        ageLabel = '🟠 Seneszenz';
        ageColor = '#fb923c';
    } else if (c.ageCategory === 'critical') {
        ageLabel = '🔴 Altersschwäche';
        ageColor = '#f43f5e';
    }

    const ageMin = Math.floor(currentAge / 60);
    const ageSec = String(currentAge % 60).padStart(2, '0');
    const maxMin = Math.floor(maxLife / 60);

    let connBadgeHtml = '<span class="deck-connection-badge" style="font-size: 0.6rem; color: #10b981; background: rgba(16,185,129,0.15); padding: 1px 5px; border-radius: 3px;">✓ Verbunden</span>';
    if (c.crisisActive && c.crisisTimer !== undefined) {
        connBadgeHtml = `<span class="deck-connection-badge" style="font-size: 0.6rem; color: #fff; background: #ef4444; padding: 1px 5px; border-radius: 3px; font-weight: bold;">⚠️ SABOTAGE IN ${Math.ceil(c.crisisTimer)}s</span>`;
    } else if (c.connectionStatus === 'severed') {
        connBadgeHtml = '<span class="deck-connection-badge" style="font-size: 0.6rem; color: #ef4444; background: rgba(239,68,68,0.15); padding: 1px 5px; border-radius: 3px;">🔒 Verbindung gekappt</span>';
    } else if (c.connectionStatus === 'dissonant') {
        connBadgeHtml = '<span class="deck-connection-badge" style="font-size: 0.6rem; color: #f59e0b; background: rgba(245,158,11,0.15); padding: 1px 5px; border-radius: 3px;">⚡ Dissonant</span>';
    }

    const isSevered = c.connectionStatus === 'severed';

    return `
        <div id="deck-crew-card-${c.id}" class="${cardClass}" style="margin-bottom: 6px;">
            <div class="crew-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="crew-name" style="font-weight: 700; color: #f8fafc; font-size: 0.8rem;">${c.name}</span>
                    <span style="font-size: 0.65rem; color: #94a3b8;">(${speciesTag})</span>
                    ${connBadgeHtml}
                </div>
                <span class="crew-role-badge">${c.roleIcon || '👤'} ${c.roleName || c.role}</span>
            </div>
            <div class="crew-buff-tag" style="${isSevered ? 'color: #94a3b8; text-decoration: line-through;' : ''}">
                ⚡ ${c.buffDesc || c.perk}${isSevered ? ' (Inaktiv - Geist getrennt)' : ''}
            </div>

            <!-- Lifespan & Biological Age Bar -->
            <div class="lifespan-container" style="margin: 4px 0; background: rgba(15,23,42,0.6); padding: 4px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.06);">
                <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: #cbd5e1; margin-bottom: 2px;">
                    <span class="deck-age-text">⏳ Alter: ${ageMin}:${ageSec} / ${maxMin}:00 Min.</span>
                    <span class="deck-age-pill" style="color: ${ageColor}; font-weight: 700;">${ageLabel} (${lifePercent}% übrig)</span>
                </div>
                <div class="lifespan-bar-bg" style="height: 4px; background: rgba(0,0,0,0.5); border-radius: 2px; overflow: hidden;">
                    <div class="deck-age-fill lifespan-bar" style="width: ${lifePercent}%; height: 100%; background: ${ageColor}; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            <div class="stability-container">
                <span class="stability-label">Traum-Stabilität:</span>
                <div class="stability-bar-bg">
                    <div class="deck-stability-fill stability-bar" style="width: ${c.illusionStability}%;"></div>
                </div>
                <span class="deck-stability-val" style="color: #a855f7; font-size: 0.68rem; font-weight: 700;">${Math.round(c.illusionStability)}%</span>
            </div>

            <div class="stress-container" style="display: flex; align-items: center; gap: 6px;">
                <span class="stress-label" style="width: 90px; font-size: 0.68rem; color: #94a3b8;">Stress:</span>
                <div class="stress-bar-bg" style="flex: 1; height: 5px; background: rgba(0,0,0,0.5); border-radius: 3px; overflow: hidden;">
                    <div class="deck-stress-fill stress-bar" style="width: ${c.stress}%; height: 100%; background: ${c.stress > 70 ? '#ef4444' : '#f59e0b'};"></div>
                </div>
                <span class="deck-stress-val stress-percentage" style="font-size: 0.68rem;">${Math.round(c.stress)}%</span>
            </div>

            <div class="thought-whisper deck-thought-text ${c.illusionStability < 35 ? 'terrified' : ''}">
                💭 "${c.thought}"
            </div>

            <!-- Station Assignment & Activity -->
            <div class="crew-station-box" style="margin: 4px 0; padding: 4px 6px; background: rgba(15,23,42,0.5); border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.63rem;">
                    <span style="color: #94a3b8;">Station:</span>
                    <span style="color: #38bdf8; font-weight: 600;">${c.stationName || 'Organ-Station'}</span>
                </div>
                <div class="station-switch-row">
                    <button class="station-mini-btn ${c.station === 'flight_synapse' ? 'active' : ''}" onclick="window.setCrewStation(${c.id}, 'flight_synapse')" title="🚀 Flug-Synapse (+Schub & Wendigkeit)">🚀 Flug</button>
                    <button class="station-mini-btn ${c.station === 'chitin_gland' ? 'active' : ''}" onclick="window.setCrewStation(${c.id}, 'chitin_gland')" title="🛡️ Chitin-Drüse (Rumpfhärte & Reparatur)">🛡️ Chitin</button>
                    <button class="station-mini-btn ${c.station === 'bio_incubator' ? 'active' : ''}" onclick="window.setCrewStation(${c.id}, 'bio_incubator')" title="🧪 Bio-Inkubator (Verjüngung & Biomasse)">🧪 Inkubator</button>
                    <button class="station-mini-btn ${c.station === 'dream_core' ? 'active' : ''}" onclick="window.setCrewStation(${c.id}, 'dream_core')" title="🔮 Traum-Kern (Mentale Kraft & Umwälzung)">🔮 Traum</button>
                </div>
                <div style="font-size: 0.58rem; color: #94a3b8; font-style: italic; margin-top: 3px;">
                    ⚙️ ${c.stationActivity || ''}
                </div>
            </div>

            <!-- Interactive Crew Care & Action Buttons -->
            <div class="crew-actions" style="display: flex; gap: 6px; margin-top: 6px;">
                <button class="crew-action-btn rejuv-btn" onclick="window.rejuvenateCrew(${c.id})" title="Zell-Verjüngung: -35% Alter (Kosten: 20 Bio / 10 Biomasse)">
                    💉 Verjüngen
                </button>
                <button class="crew-action-btn assimilate-btn" onclick="window.assimilateCrew(${c.id})" title="Genom-Assimilation: Löst das Wesen in +50 Bio-Energie, +35 Biomasse & +20 Silizium auf">
                    🧬 Assimilieren
                </button>
            </div>
        </div>
    `;
}

// Expose handlers to window for inline onclick execution
if (typeof window !== 'undefined') {
    (window as any).rejuvenateCrew = (id: number) => rejuvenateCrewMember(id);
    (window as any).assimilateCrew = (id: number) => assimilateCrewMember(id);
    (window as any).toggleCluster = (speciesName: string) => toggleClusterExpansion(speciesName);
    (window as any).rejuvenateCluster = (speciesName: string) => rejuvenateSpeciesCluster(speciesName);
    (window as any).setPrimaryParadigm = (p: string) => setPrimaryParadigm(p as any);
    (window as any).setActiveSubCodex = (sub: string) => setActiveSubCodex(sub as any);
    (window as any).cyclePrimaryParadigm = () => cyclePrimaryParadigm();
    (window as any).setCrewStation = (id: number, s: string) => setCrewStation(id, s as any);
    (window as any).setSpeciesClusterStation = (sp: string, s: string) => setSpeciesClusterStation(sp, s as any);
    (window as any).performTherapySession = () => performTherapySession();
}

const crewDialogueBank: Record<string, { lineA: string; lineB: string }[]> = {
    pilot_engineer: [
        { lineA: 'Miller: "Petrov, diese biomolekularen Trägheitsdämpfer... das Schiff richtet die Schubvektoren aus, bevor ich überhaupt lenke."', lineB: 'Petrov: "Die Naniten im Chitin leiten unsere Gedanken direkt weiter. Das ist kein Raumschiff, das ist ein lebendes Cockpit."' },
        { lineA: 'Miller: "Wie sieht die Hüllenintegrität aus, wenn wir durch Asteroidengürtel tauchen?"', lineB: 'Petrov: "Silizium-Naniten schließen Risse im Flug. Solange wir Mineralien aufnehmen, hält die organische Panzerung stand."' }
    ],
    biologist_psychologist: [
        { lineA: 'Dr. Song: "Die Traum-Matrix synchronisiert unsere neuronalen REM-Phasen. Es absorbiert nicht unsere Körper, sondern unsere Gefühle."', lineB: 'Dr. Vance: "Ein psionischer Stoffwechsel. Solange wir Gelassenheit und Zuversicht ausstrahlen, ernährt sich die Entität von Harmonie statt Verzweiflung."' },
        { lineA: 'Dr. Song: "Die Biolumineszenz an den Synapsen-Wänden pulsiert im Takt unseres Herzschlags."', lineB: 'Dr. Vance: "Ein biologischer Resonanzraum. Wir halten das Wesen am Leben – und es beschützt uns vor der tödlichen Kälte des Alls."' }
    ],
    cryptologist_pilot: [
        { lineA: 'Novak: "Ich fange schwache Tachyonen-Echos aus dem nächsten Sternensystem auf. Psio-Sensorhorizont erweitert."', lineB: 'Miller: "Kurs ist korrigiert, Novak. Bringen wir uns in den nächsten planetaren Orbit."' }
    ],
    engineer_biologist: [
        { lineA: 'Petrov: "Dr. Song, die organischen Leitungen um die Faltungsmembran regenerieren erstaunlich schnell."', lineB: 'Dr. Song: "Es ist ein symbiotisches Ökosystem. Jede Ressource, die wir assimilieren, stärkt die Zellwände des Schiffes."' }
    ],
    general: [
        { lineA: 'Crew-Funk: "Die Traum-Matrix flüstert Erinnerungen an Sternensysteme, die Lichtjahre entfernt liegen..."', lineB: 'Crew-Funk: "Wir reisen durch das Herz einer Galaxie, die kein Mensch zuvor erblickt hat."' }
    ]
};

export function triggerMultiCrewDialogue() {
    if (STATE.crew.length < 2) return;

    const hasTranslator = STATE.mutations.translator && STATE.mutations.translator.purchased;

    const c1 = STATE.crew[Math.floor(Math.random() * STATE.crew.length)];
    const others = STATE.crew.filter(c => c !== c1);
    const c2 = others[Math.floor(Math.random() * others.length)];

    let pairKey = `${c1.role}_${c2.role}`;
    let revPairKey = `${c2.role}_${c1.role}`;
    let dialogues = crewDialogueBank[pairKey] || crewDialogueBank[revPairKey] || crewDialogueBank.general;

    const dialog = dialogues[Math.floor(Math.random() * dialogues.length)];

    const name1 = c1.name.split(' ')[1] || c1.name;
    const name2 = c2.name.split(' ')[1] || c2.name;

    if (hasTranslator) {
        addLogEntry("CREW", dialog.lineA.replace("Miller", name1).replace("Petrov", name2).replace("Dr. Song", c1.name).replace("Dr. Vance", c2.name).replace("Novak", name1));
        setTimeout(() => {
            addLogEntry("CREW", dialog.lineB.replace("Miller", name1).replace("Petrov", name2).replace("Dr. Song", c1.name).replace("Dr. Vance", c2.name).replace("Novak", name2));
        }, 3200);
    } else {
        addLogEntry("CREW", `[Verschlüsselter Datenstrom zwischen ${c1.name} & ${c2.name}... Dschinn-Übersetzer benötigt!]`);
    }
}
