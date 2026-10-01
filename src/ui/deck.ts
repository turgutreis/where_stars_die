import { STATE } from '../core/state';
import { playSiliconCollectSound } from '../engine/audio';
import { addLogEntry } from './hud';
import { calculateCrewBuffs, renderCrewUI, performTherapySession } from '../systems/crew';
import { renderFactionReputationUI } from '../systems/factions';
import { initEvolutionTree, updateEvolutionTreeUI, startNeuralCanvasLoop, stopNeuralCanvasLoop } from './evolution-tree';
import { triggerAutoSave } from '../systems/save-manager';
import { dismissScannerPanel } from '../systems/scanner';

export function isDeckOpen(): boolean {
    const modal = document.getElementById('deck-modal');
    return modal ? modal.style.display === 'flex' : false;
}

export function toggleDeckModal(force?: boolean) {
    const modal = document.getElementById('deck-modal');
    if (!modal) return;
    const isVisible = modal.style.display === 'flex';
    const nextState = force !== undefined ? force : !isVisible;
    modal.style.display = nextState ? 'flex' : 'none';
    if (nextState) {
        renderCrewUI(true);
        updateMutationUI();
        renderFactionReputationUI();
        startNeuralCanvasLoop();
    } else {
        stopNeuralCanvasLoop();
    }
}

export function initDeckUI() {
    const leftCollapseBtn = document.getElementById('left-collapse-btn');
    if (leftCollapseBtn) {
        leftCollapseBtn.addEventListener('click', () => {
            dismissScannerPanel();
        });
    }

    const tabButtons = document.querySelectorAll('#right-deck-tabs .tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const crewContent = document.getElementById('tab-content-crew');
            const evoContent = document.getElementById('tab-content-evolution');
            const facContent = document.getElementById('tab-content-factions');
            const logContent = document.getElementById('tab-content-log');

            if (crewContent) {
                crewContent.classList.toggle('active', targetTab === 'crew');
                if (targetTab === 'crew') {
                    renderCrewUI(true);
                }
            }
            if (evoContent) {
                evoContent.classList.toggle('active', targetTab === 'evolution');
                if (targetTab === 'evolution') {
                    startNeuralCanvasLoop();
                    updateEvolutionTreeUI();
                } else {
                    stopNeuralCanvasLoop();
                }
            }
            if (logContent) logContent.classList.toggle('active', targetTab === 'log');
            if (facContent) {
                facContent.classList.toggle('active', targetTab === 'factions');
                if (targetTab === 'factions') {
                    renderFactionReputationUI();
                }
            }
        });
    });

    renderFactionReputationUI();
    initEvolutionTree();

    const mutButtons = document.querySelectorAll('.mut-btn');
    mutButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mutType = btn.getAttribute('data-mutation');
            if (mutType) {
                buyMutation(mutType);
            }
        });
    });

    const repairHullAlloyBtn = document.getElementById('repair-hull-alloy-btn');
    if (repairHullAlloyBtn) {
        repairHullAlloyBtn.addEventListener('click', () => {
            if ((STATE.alloyRes || 0) >= 5) {
                if (STATE.health >= STATE.maxHealth) {
                    addLogEntry("SYSTEM", "Biologische Hülle ist bereits vollständig intakt (100%).");
                    return;
                }
                STATE.alloyRes -= 5;
                STATE.health = Math.min(STATE.maxHealth, STATE.health + 25);
                playSiliconCollectSound();
                addLogEntry("HÜLLE", "🛡️ Chitin-Legierungs-Matrix appliziert: +25 HP Hülle regeneriert!");
                renderCrewUI(true);
            } else {
                addLogEntry("SYSTEM", "Zu wenig Legierungen für Hüllen-Reparatur (5 Legierungen benötigt)!");
            }
        });
    }

    const repairShuttleAlloyBtn = document.getElementById('repair-shuttle-alloy-btn');
    if (repairShuttleAlloyBtn) {
        repairShuttleAlloyBtn.addEventListener('click', () => {
            if (!STATE.bioShuttle) return;
            if ((STATE.alloyRes || 0) >= 10) {
                if (STATE.bioShuttle.hull >= STATE.bioShuttle.maxHull) {
                    addLogEntry("SYSTEM", "Bio-Shuttle Hülle ist bereits makellos (100%).");
                    return;
                }
                STATE.alloyRes -= 10;
                STATE.bioShuttle.hull = STATE.bioShuttle.maxHull;
                playSiliconCollectSound();
                addLogEntry("SHUTTLE", "🚀 Bio-Shuttle generalüberholt: Hülle mit Legierungen auf 100% wiederhergestellt!");
                renderCrewUI(true);
            } else {
                addLogEntry("SYSTEM", "Zu wenig Legierungen für Shuttle-Generalüberholung (10 Legierungen benötigt)!");
            }
        });
    }

    const therapyBtn = document.getElementById('therapy-session-btn');
    if (therapyBtn) {
        therapyBtn.addEventListener('click', () => {
            performTherapySession();
        });
    }
}

export function buyMutation(type: string) {
    const mut = (STATE.mutations as any)[type];
    if (!mut || mut.purchased) return;

    const discount = STATE.mutationDiscount || 0;
    const effBioCost = Math.round(mut.bioCost * (1 - discount));
    const effSilCost = Math.round(mut.siliconCost * (1 - discount));
    const effTechCost = Math.round((mut.techCost || 0) * (1 - discount));

    if (STATE.bioRes >= effBioCost && STATE.siliconRes >= effSilCost && (STATE.techRes || 0) >= effTechCost) {
        STATE.bioRes -= effBioCost;
        STATE.siliconRes -= effSilCost;
        if (effTechCost > 0) {
            STATE.techRes = Math.max(0, (STATE.techRes || 0) - effTechCost);
        }
        mut.purchased = true;

        playSiliconCollectSound();

        const btn = document.querySelector(`.mut-btn[data-mutation="${type}"]`);
        if (btn) {
            btn.classList.add('purchased');
            btn.innerHTML = "Aktiviert ✓";
        }

        if (type === 'armor' || type === 'chitin_armor') {
            if (STATE.mutations.armor) STATE.mutations.armor.purchased = true;
            if (STATE.mutations.chitin_armor) STATE.mutations.chitin_armor.purchased = true;
            addLogEntry("EVOLUTION", "Organischer Chitin-Panzer gehärtet. Kollisionsschaden um 50% reduziert & Besatzung vor kosmischer Strahlung geschützt.");
            const hull = document.getElementById('schematic-hull');
            if (hull) hull.setAttribute('stroke-width', '4');
        } else if (type === 'organic_siphon') {
            addLogEntry("EVOLUTION", "Organischer Siphon ausgebildet! Ernte-Geschwindigkeit +35% & Strahlungs-Bio-Filter aktiv (-25% Strahlungsschaden).");
        } else if (type === 'vector_tentacles') {
            STATE.thrustStrength = 20.6;
            STATE.turnSpeed = 3.2;
            addLogEntry("EVOLUTION", "Vektor-Tentakel erwacht! +25% Schub, +35% Wendigkeit & hydrodynamische Bio-Bremse online.");
        } else if (type === 'blade_armor') {
            addLogEntry("EVOLUTION", "Klingen-Panzerung assimiliert! Dornen-Chitin reflektiert Schaden & bildet dichte magnetische Barriere (-80% Strahlung).");
        } else if (type === 'o2') {
            addLogEntry("EVOLUTION", "Metabolische O2-Synthese aktiviert. Stress-Zuwachs halbiert.");
        } else if (type === 'synapses' || type === 'psionic_pulse') {
            if (STATE.mutations.synapses) STATE.mutations.synapses.purchased = true;
            if (STATE.mutations.psionic_pulse) STATE.mutations.psionic_pulse.purchased = true;
            STATE.psionicRange = 140;
            STATE.maxMentalEnergy = 150;
            calculateCrewBuffs();
            addLogEntry("EVOLUTION", "Psionischer Impuls entfesselt! Gedanken-Echo Reichweite auf 140 LJ vergrößert & Mentalkraft auf 150.");
        } else if (type === 'chimera_veil') {
            if (!STATE.paradigmModifiers) STATE.paradigmModifiers = { thrustBonus: 0, stealthBonus: 0, mentalDrainMult: 1, bioRegenBonus: 0, harmonyBonus: 0, stressModifier: 0 };
            STATE.paradigmModifiers.stealthBonus += 0.40;
            addLogEntry("EVOLUTION", "Schimären-Schleier aktiv! Psionische Lichtbrechung gewährt +40% Tarnung (Stealth) & Schutz vor Sensor-Stress.");
        } else if (type === 'resonance_screech') {
            addLogEntry("EVOLUTION", "Resonanz-Schrei assimiliert! Bio-EMP Schockwelle lähmt Drohnen 50% länger und sendet panikbrechende Wellen.");
        } else if (type === 'cocoon') {
            STATE.maxCrewCapacity = 4;
            addLogEntry("EVOLUTION", "Neuronales Kokon-Gewebe mutiert! Maximale Crew-Kapazität auf 4 erweitert.");
            renderCrewUI();
        } else if (type === 'hivemind') {
            STATE.maxCrewCapacity = 6;
            calculateCrewBuffs();
            addLogEntry("EVOLUTION", "Symbiotische Synapsen-Kammer erwacht! Kapazität auf 6 erhöht & alle Spezialisten-Buffs um +20% verstärkt!");
            renderCrewUI();
        } else if (type === 'neural_cluster') {
            STATE.maxCrewCapacity = 10;
            calculateCrewBuffs();
            addLogEntry("EVOLUTION", "Neuronale Waben-Kammer expandiert! Max 10 Crew-Mitglieder & Dissonanz-Dämpfung aktiv.");
            renderCrewUI();
        } else if (type === 'cryo_matrix') {
            STATE.maxCrewCapacity = 20;
            calculateCrewBuffs();
            addLogEntry("EVOLUTION", "Bio-Kryo-Kaverne herangewachsen! Max 20 Crew-Mitglieder & Zelltod um 25% verlangsamt.");
            renderCrewUI();
        } else if (type === 'hive_cerebrum') {
            STATE.maxCrewCapacity = 30;
            calculateCrewBuffs();
            addLogEntry("EVOLUTION", "Schwarm-Zerebrum erwacht! Max 30 Crew-Mitglieder • Volle telepathische Schwarm-Resonanz aktiv!");
            renderCrewUI();
        } else if (type === 'folddrive') {
            STATE.warpRange = 160;
            addLogEntry("EVOLUTION", "Raumfaltungs-Membran mutiert! Warp-Reichweite auf 160 LJ erweitert, Faltungskosten um 30% gesenkt.");
        } else if (type === 'translator' || type === 'telepathic_focus') {
            if (STATE.mutations.translator) STATE.mutations.translator.purchased = true;
            if (STATE.mutations.telepathic_focus) STATE.mutations.telepathic_focus.purchased = true;
            addLogEntry("EVOLUTION", "Telepathischer Fokus synchronisiert! Alien-Funksignale & Crew-Dialoge werden dechiffriert.");
        }

        updateMutationUI();
        triggerAutoSave(`Mutation: ${mut.name || type}`);
    } else {
        addLogEntry("SYSTEM", `Evolution fehlgeschlagen: Nicht genügend Ressourcen (${effBioCost} Bio | ${effSilCost} Silizium${effTechCost > 0 ? ` | ${effTechCost} Tech` : ''} benötigt)!`);
    }
}

export function updateMutationUI() {
    const bioEl = document.getElementById('res-bio-count');
    const silEl = document.getElementById('res-silicon-count');
    if (bioEl) bioEl.innerText = `${Math.floor(STATE.bioRes)}`;
    if (silEl) silEl.innerText = `${Math.floor(STATE.siliconRes)}`;

    const discount = STATE.mutationDiscount || 0;
    Object.keys(STATE.mutations).forEach(key => {
        const mut = (STATE.mutations as any)[key];
        const btn = document.querySelector(`.mut-btn[data-mutation="${key}"]`) as HTMLButtonElement;
        if (btn) {
            if (mut.purchased) {
                btn.disabled = true;
                btn.classList.add('purchased');
                btn.innerText = "Aktiviert ✓";
            } else {
                const effBio = Math.round(mut.bioCost * (1 - discount));
                const effSil = Math.round(mut.siliconCost * (1 - discount));
                const effTech = Math.round((mut.techCost || 0) * (1 - discount));
                const canAfford = STATE.bioRes >= effBio && STATE.siliconRes >= effSil && (STATE.techRes || 0) >= effTech;
                btn.disabled = !canAfford;
            }
        }
    });

    const ibadCard = document.getElementById('mut-ibad');
    if (ibadCard) {
        ibadCard.style.display = (STATE.mutations.ibad && STATE.mutations.ibad.purchased) ? 'flex' : 'none';
    }

    updateEvolutionTreeUI();
}

export function reapplyAllMutations() {
    let capacity = 4;
    let thrust = 16.5;
    let turn = 2.85;
    let psionicRange = 75;
    let maxMental = 100;
    let stealthBonus = 0;

    const m = STATE.mutations;
    if (m) {
        if (m.hive_cerebrum?.purchased) capacity = 30;
        else if (m.cryo_matrix?.purchased) capacity = 20;
        else if (m.neural_cluster?.purchased) capacity = 10;
        else if (m.hivemind?.purchased) capacity = 6;
        else if (m.cocoon?.purchased) capacity = 4;

        if (m.vector_tentacles?.purchased) {
            thrust = 20.6;
            turn = 3.2;
        }
        if (m.psionic_pulse?.purchased || m.synapses?.purchased) {
            psionicRange = 140;
            maxMental = 150;
        }
        if (m.chimera_veil?.purchased) {
            stealthBonus = 0.40;
        }
    }

    STATE.maxCrewCapacity = capacity;
    STATE.thrustStrength = thrust;
    STATE.turnSpeed = turn;
    STATE.psionicRange = psionicRange;
    STATE.maxMentalEnergy = maxMental;

    if (!STATE.paradigmModifiers) {
        STATE.paradigmModifiers = { thrustBonus: 0, stealthBonus: 0, mentalDrainMult: 1, bioRegenBonus: 0, harmonyBonus: 0, stressModifier: 0 };
    }
    STATE.paradigmModifiers.stealthBonus = stealthBonus;

    calculateCrewBuffs();
    updateMutationUI();
    updateEvolutionTreeUI();
}
