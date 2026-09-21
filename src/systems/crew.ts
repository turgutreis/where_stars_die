import { STATE } from '../core/state';
import { addLogEntry } from '../ui/hud';
import { toggleTelepathy } from '../input/controls';
import { playBioHarvestSound, playCrashSound } from '../engine/audio';
import { CrewMember, PrimaryParadigm, SubCodex, SpeciesCluster } from '../types/game';
import { triggerCrewDeathNotification, updatePartyGrid } from '../ui/party-grid';

const expandedClusters = new Set<string>();

export function toggleClusterExpansion(speciesName: string): void {
    if (expandedClusters.has(speciesName)) {
        expandedClusters.delete(speciesName);
    } else {
        expandedClusters.add(speciesName);
    }
    renderCrewUI();
    updatePartyGrid();
}

export function setPrimaryParadigm(paradigm: PrimaryParadigm): void {
    if (STATE.primaryParadigm === paradigm) return;
    STATE.primaryParadigm = paradigm;

    // Reset default sub-codex if mismatched
    if (paradigm === 'domination' && !['iron_discipline', 'gunboat_diplomacy', 'nightmare_terror'].includes(STATE.activeSubCodex)) {
        STATE.activeSubCodex = 'gunboat_diplomacy';
    } else if (paradigm === 'deception' && !['benevolent_facade', 'illusory_matrix', 'nightmare_terror'].includes(STATE.activeSubCodex)) {
        STATE.activeSubCodex = 'benevolent_facade';
    } else if (paradigm === 'symbiosis' && !['living_symbiosis', 'pragmatic_accord', 'gunboat_diplomacy'].includes(STATE.activeSubCodex)) {
        STATE.activeSubCodex = 'living_symbiosis';
    }

    updateParadigmModifiers();
    calculateCrewBuffs();
    renderCrewUI();
    updatePartyGrid();

    const titles: Record<PrimaryParadigm, string> = {
        domination: "⚡ HERRSCHAFT & UNTERWERFUNG (Illithid)",
        deception: "🔮 TÄUSCHUNG & TRAUM-MATRIX (Holodeck)",
        symbiosis: "🌱 SYMBIOSE & HARMONIE (Organisch)"
    };
    addLogEntry("DOKTRIN", `Schiffs-Philosophie gewechselt zu: ${titles[paradigm]}`);
}

export function setActiveSubCodex(subCodex: SubCodex): void {
    STATE.activeSubCodex = subCodex;
    updateParadigmModifiers();
    calculateCrewBuffs();
    renderCrewUI();
    updatePartyGrid();

    const subTitles: Record<SubCodex, string> = {
        iron_discipline: "Eiserne Disziplin (Gewalt + Gewalt)",
        gunboat_diplomacy: "Ehrfurchts-Vertrag (Gewalt + Diplomatie)",
        nightmare_terror: "Albtraum-Matrix (Gewalt + Täuschung)",
        benevolent_facade: "Falsche Utopie (Täuschung + Diplomatie)",
        illusory_matrix: "Perfekte Simulation (Täuschung + Täuschung)",
        living_symbiosis: "Lebendige Symbiose (Harmonie + Harmonie)",
        pragmatic_accord: "Pragmatisches Abkommen (Harmonie + Diplomatie)"
    };
    addLogEntry("DOKTRIN", `Sub-Kodex aktiviert: ${subTitles[subCodex] || subCodex}`);
}

export function updateParadigmModifiers(): void {
    const primary = STATE.primaryParadigm || 'deception';
    const sub = STATE.activeSubCodex || 'benevolent_facade';

    let drainMult = 1.0;
    let stressMod = 0.0;
    let thrustBonus = 0.0;
    let stealthBonus = 0.0;
    let bioBonus = 0.0;
    let harmonyBonus = 0.0;

    let martialCount = 0;
    let scholarlyCount = 0;
    let empathicCount = 0;

    STATE.crew.forEach(c => {
        const disp = c.disposition || 'scholarly';
        if (disp === 'martial') martialCount++;
        else if (disp === 'scholarly') scholarlyCount++;
        else if (disp === 'empathic') empathicCount++;
    });

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

    STATE.paradigmModifiers = {
        mentalDrainMult: Math.max(0.4, Number(drainMult.toFixed(2))),
        stressModifier: Number(stressMod.toFixed(2)),
        thrustBonus: Number(thrustBonus.toFixed(2)),
        stealthBonus: Number(stealthBonus.toFixed(2)),
        bioRegenBonus: Number(bioBonus.toFixed(2)),
        harmonyBonus: Number(harmonyBonus.toFixed(2))
    };
}

export function getSpeciesClusters(): SpeciesCluster[] {
    const map = new Map<string, CrewMember[]>();

    STATE.crew.forEach(c => {
        const key = c.speciesArchetypeName || c.species.split(' (')[0] || c.species;
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

    let successCount = 0;
    clusterMembers.forEach(m => {
        if (STATE.bioEnergy >= 20 && STATE.bioRes >= 10) {
            STATE.bioEnergy -= 20;
            STATE.bioRes -= 10;
            m.age = Math.max(0, m.age - (m.maxLifespan * 0.35));
            m.stress = Math.max(0, m.stress - 25);
            m.rejuvenationCount = (m.rejuvenationCount || 0) + 1;
            m.ageCategory = m.age / m.maxLifespan < 0.5 ? 'vital' : (m.age / m.maxLifespan < 0.75 ? 'mature' : 'senescent');
            successCount++;
        }
    });

    if (successCount > 0) {
        addLogEntry("SYSTEM", `💉 KOLLEKTIV-VERJÜNGUNG: ${successCount}x ${speciesName} regeneriert!`);
        calculateCrewBuffs();
        renderCrewUI();
        updatePartyGrid();
    } else {
        addLogEntry("SYSTEM", `Zu wenig Bio-Energie / Biomasse für Kollektiv-Verjüngung (20 Bio / 10 Biomasse pro Wesen).`);
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

    STATE.crew.forEach(c => {
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

    STATE.crewBuffs = {
        thrust: Number(thrustMult.toFixed(2)),
        bioGain: Number(bioMult.toFixed(2)),
        scanSpeed: Number(scanMult.toFixed(2)),
        repairRate: Number(repair.toFixed(2)),
        stressDampening: Number(Math.max(0.1, stressDamp).toFixed(2)),
        psionicBonus: Math.round(psioBonus)
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

    const totalCrew = STATE.crew.length;
    const uniqueRoles = new Set(STATE.crew.map(c => c.role)).size;

    // 1. Loneliness & Satiety Decay System
    let targetLoneliness = 100;
    let isHarmony = false;

    if (totalCrew === 0) {
        targetLoneliness = 100;
    } else if (totalCrew === 1) {
        STATE.crewSatietyTimer += dt;
        const decay = Math.min(20, (STATE.crewSatietyTimer / 120) * 20);
        targetLoneliness = 45 + decay; // Single companion: 45-65% loneliness
    } else if (totalCrew === 2) {
        targetLoneliness = uniqueRoles === 2 ? 20 : 30; // 2 crew: 20-30% loneliness
    } else if (totalCrew >= 3) {
        if (uniqueRoles >= 3) {
            targetLoneliness = Math.max(0, 5 - (totalCrew - 3) * 2);
            isHarmony = true; // Complete Trio Harmony
        } else {
            targetLoneliness = Math.max(5, 15 - (totalCrew - 3) * 3);
            if (totalCrew >= 4) isHarmony = true;
        }
    }

    if (STATE.loneliness < targetLoneliness) {
        STATE.loneliness = Math.min(targetLoneliness, STATE.loneliness + 3 * dt);
    } else if (STATE.loneliness > targetLoneliness) {
        STATE.loneliness = Math.max(targetLoneliness, STATE.loneliness - 18 * dt);
    }

    if (isHarmony) {
        STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + 0.5 * dt);
        STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 0.3 * dt);
    }

    // 2. Individual Dream Matrix, Aging & Stress Loop
    let speed = STATE.playerVelocity.length();
    let speedStressModifier = speed > 10.0 ? 0.6 : 0;

    for (let i = STATE.crew.length - 1; i >= 0; i--) {
        const c = STATE.crew[i];

        // Aging Process
        c.age = (c.age || 0) + dt;
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

        // Panic Sabotage at extreme stress
        if (c.stress >= 80) {
            STATE.health = Math.max(0, STATE.health - 3.2 * dt);
            if (Math.random() < 0.008) {
                addLogEntry("CREW", `MATRIX-ALARM: ${c.name} randaliert in Panik und beschädigt Zellwände! Beruhige mit [LEERTASTE]!`);
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
        const regenSpeed = STATE.mutations.synapses && STATE.mutations.synapses.purchased ? 7.0 * dt : 3.5 * dt;
        STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + regenSpeed);
    }

    // 4. Periodic Multi-Crew Dialogue
    STATE.crewDialogueTimer -= dt;
    if (STATE.crewDialogueTimer <= 0 && STATE.crew.length >= 2) {
        STATE.crewDialogueTimer = 20 + Math.random() * 8;
        triggerMultiCrewDialogue();
    }

    // Update Crew DOM cards periodically
    renderCrewUI();
}

// User Action: Bio-Rejuvenation (Extends Lifespan & Reduces Age)
export function rejuvenateCrewMember(id: number) {
    const member = STATE.crew.find(c => c.id === id);
    if (!member) return;

    if (STATE.bioEnergy < 20 || STATE.bioRes < 10) {
        addLogEntry("SYSTEM", `Zu wenig Bio-Energie oder Biomasse für Zell-Verjüngung (benötigt 20 Bio / 10 Biomasse)!`);
        return;
    }

    STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 20);
    STATE.bioRes = Math.max(0, STATE.bioRes - 10);

    const maxLife = member.maxLifespan || 540;
    member.age = Math.max(0, member.age - maxLife * 0.35);
    if (member.age / maxLife < 0.85) {
        member.criticalAlertTriggered = false;
    }
    member.stress = Math.max(0, member.stress - 25);
    member.rejuvenationCount = (member.rejuvenationCount || 0) + 1;

    playBioHarvestSound();
    addLogEntry("SYSTEM", `💉 ZELL-REGENERATION: Telomere von ${member.name} erneuert (-35% Alter)! Lebenszeit verlängert.`);
    calculateCrewBuffs();
    renderCrewUI();
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
    renderCrewUI();
}

export function renderCrewUI() {
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

    if (!container) return;

    // Build Paradigm & Sub-Codex Header Selector
    const p = STATE.primaryParadigm || 'deception';
    const sub = STATE.activeSubCodex || 'benevolent_facade';
    const mods = STATE.paradigmModifiers || { thrustBonus: 0, stealthBonus: 0, mentalDrainMult: 1.0, bioRegenBonus: 0, harmonyBonus: 0 };

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

    let paradigmHtml = `
        <div class="paradigm-control-card glass-panel" style="margin-bottom: 12px; padding: 8px 10px; border: 1px solid rgba(168,85,247,0.3); border-radius: 6px; background: rgba(15,23,42,0.75);">
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

    const clusters = getSpeciesClusters();
    const useClustering = STATE.crew.length >= 6 || clusters.some(cl => cl.count >= 4);

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
                <div class="species-cluster-card glass-panel" style="margin-bottom: 10px; padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(30,41,59,0.5);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.2rem;">${cl.avatarIcon}</span>
                            <div>
                                <span style="font-weight: 700; color: ${cl.speciesColor}; font-size: 0.82rem;">${cl.speciesName}</span>
                                <span style="font-size: 0.65rem; background: rgba(56,189,248,0.2); color: #38bdf8; padding: 1px 5px; border-radius: 3px; margin-left: 4px;">${cl.count}x Individuen</span>
                                <span style="font-size: 0.65rem; color: #94a3b8; margin-left: 4px;">${dispIcon} ${dispLabel}</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button class="crew-action-btn" onclick="window.rejuvenateCluster('${cl.speciesName}')" style="padding: 2px 6px; font-size: 0.62rem; cursor: pointer; background: rgba(16,185,129,0.3); border: 1px solid #10b981; color: #fff; border-radius: 3px;" title="Verjüngt alle Individuen dieser Spezies (-35% Alter, 20 Bio / 10 Biomasse pro Wesen)">
                                💉 Kollektiv-Verjüngung
                            </button>
                            <button class="crew-action-btn" onclick="window.toggleCluster('${cl.speciesName}')" style="padding: 2px 6px; font-size: 0.62rem; cursor: pointer; background: rgba(168,85,247,0.3); border: 1px solid #a855f7; color: #fff; border-radius: 3px;">
                                ${cl.isExpanded ? '▲ Zuklappen' : '▼ Aufklappen (' + cl.count + ')'}
                            </button>
                        </div>
                    </div>

                    <!-- Clustered Averages Bars -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-top: 6px; font-size: 0.65rem;">
                        <div>
                            <span style="color: #94a3b8;">⏳ Vitalität:</span> <strong style="color: #10b981;">${cl.avgAgePercent}%</strong>
                        </div>
                        <div>
                            <span style="color: #94a3b8;">🔮 Stabilität:</span> <strong style="color: #a855f7;">${cl.avgStability}%</strong>
                        </div>
                        <div>
                            <span style="color: #94a3b8;">⚡ Stress:</span> <strong style="color: ${cl.avgStress > 50 ? '#ef4444' : '#f59e0b'};">${cl.avgStress}%</strong>
                        </div>
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

    return `
        <div class="${cardClass}" style="margin-bottom: 6px;">
            <div class="crew-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span class="crew-name" style="font-weight: 700; color: #f8fafc; font-size: 0.8rem;">${c.name}</span>
                    <span style="font-size: 0.65rem; color: #94a3b8; margin-left: 4px;">(${speciesTag})</span>
                </div>
                <span class="crew-role-badge">${c.roleIcon || '👤'} ${c.roleName || c.role}</span>
            </div>
            <div class="crew-buff-tag">⚡ ${c.buffDesc || c.perk}</div>

            <!-- Lifespan & Biological Age Bar -->
            <div class="lifespan-container" style="margin: 4px 0; background: rgba(15,23,42,0.6); padding: 4px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.06);">
                <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: #cbd5e1; margin-bottom: 2px;">
                    <span>⏳ Alter: ${ageMin}:${ageSec} / ${maxMin}:00 Min.</span>
                    <span style="color: ${ageColor}; font-weight: 700;">${ageLabel} (${lifePercent}% übrig)</span>
                </div>
                <div class="lifespan-bar-bg" style="height: 4px; background: rgba(0,0,0,0.5); border-radius: 2px; overflow: hidden;">
                    <div class="lifespan-bar" style="width: ${lifePercent}%; height: 100%; background: ${ageColor}; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            <div class="stability-container">
                <span class="stability-label">Traum-Stabilität:</span>
                <div class="stability-bar-bg">
                    <div class="stability-bar" style="width: ${c.illusionStability}%;"></div>
                </div>
                <span style="color: #a855f7; font-size: 0.68rem; font-weight: 700;">${Math.round(c.illusionStability)}%</span>
            </div>

            <div class="stress-container" style="display: flex; align-items: center; gap: 6px;">
                <span class="stress-label" style="width: 90px; font-size: 0.68rem; color: #94a3b8;">Stress:</span>
                <div class="stress-bar-bg" style="flex: 1; height: 5px; background: rgba(0,0,0,0.5); border-radius: 3px; overflow: hidden;">
                    <div class="stress-bar" style="width: ${c.stress}%; height: 100%; background: ${c.stress > 70 ? '#ef4444' : '#f59e0b'};"></div>
                </div>
                <span class="stress-percentage" style="font-size: 0.68rem;">${Math.round(c.stress)}%</span>
            </div>

            <div class="thought-whisper ${c.illusionStability < 35 ? 'terrified' : ''}">
                💭 "${c.thought}"
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
