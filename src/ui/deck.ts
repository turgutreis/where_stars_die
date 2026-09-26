import { STATE } from '../core/state';
import { playSiliconCollectSound } from '../engine/audio';
import { addLogEntry } from './hud';
import { calculateCrewBuffs, renderCrewUI } from '../systems/crew';
import { renderFactionReputationUI } from '../systems/factions';
import { dismissScannerPanel } from '../systems/scanner';
import { initEvolutionTree, updateEvolutionTreeUI, startNeuralCanvasLoop, stopNeuralCanvasLoop } from './evolution-tree';

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
}

export function buyMutation(type: string) {
    const mut = (STATE.mutations as any)[type];
    if (!mut || mut.purchased) return;

    if (STATE.bioRes >= mut.bioCost && STATE.siliconRes >= mut.siliconCost) {
        STATE.bioRes -= mut.bioCost;
        STATE.siliconRes -= mut.siliconCost;
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
    } else {
        addLogEntry("SYSTEM", `Evolution fehlgeschlagen: Nicht genügend Ressourcen (${mut.bioCost} Bio | ${mut.siliconCost} Silizium benötigt)!`);
    }
}

export function updateMutationUI() {
    const bioEl = document.getElementById('res-bio-count');
    const silEl = document.getElementById('res-silicon-count');
    if (bioEl) bioEl.innerText = `${Math.floor(STATE.bioRes)}`;
    if (silEl) silEl.innerText = `${Math.floor(STATE.siliconRes)}`;

    Object.keys(STATE.mutations).forEach(key => {
        const mut = (STATE.mutations as any)[key];
        const btn = document.querySelector(`.mut-btn[data-mutation="${key}"]`) as HTMLButtonElement;
        if (btn) {
            if (mut.purchased) {
                btn.disabled = true;
                btn.classList.add('purchased');
                btn.innerText = "Aktiviert ✓";
            } else {
                const canAfford = STATE.bioRes >= mut.bioCost && STATE.siliconRes >= mut.siliconCost;
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
