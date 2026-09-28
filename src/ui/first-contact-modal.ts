import { STATE } from '../core/state';
import { CrewMember, PrimaryParadigm } from '../types/game';
import { addLogEntry, updateHUDStats } from './hud';
import { playBioHarvestSound, playLockOnSound } from '../engine/audio';
import { setPrimaryParadigm, renderCrewUI, calculateCrewBuffs } from '../systems/crew';
import { updatePartyGrid } from './party-grid';
import { triggerAutoSave } from '../systems/save-manager';

let isModalOpen = false;

export function isFirstContactModalOpen(): boolean {
    return isModalOpen;
}

export function openFirstContactModal(candidate: CrewMember): void {
    const modal = document.getElementById('first-contact-modal');
    if (!modal) return;

    // Fill candidate details into modal
    const nameEl = document.getElementById('fc-candidate-name');
    const speciesEl = document.getElementById('fc-candidate-species');
    const roleEl = document.getElementById('fc-candidate-role');
    const avatarEl = document.getElementById('fc-candidate-avatar');
    const thoughtEl = document.getElementById('fc-candidate-thought');
    const ringEl = document.getElementById('fc-candidate-ring');

    if (nameEl) nameEl.innerText = candidate.name;
    if (speciesEl) speciesEl.innerText = candidate.species;
    if (roleEl) roleEl.innerText = `${candidate.roleIcon || '👤'} ${candidate.roleName || candidate.role} • ${candidate.disposition || 'scholarly'}`;
    if (avatarEl) avatarEl.innerText = candidate.avatarIcon || '👤';
    if (thoughtEl) thoughtEl.innerText = `💭 "${candidate.thought}"`;
    if (ringEl && candidate.speciesColor) {
        ringEl.style.borderColor = candidate.speciesColor;
        ringEl.style.boxShadow = `0 0 20px ${candidate.speciesColor}88`;
    }

    modal.style.display = 'flex';
    isModalOpen = true;

    try {
        playLockOnSound();
    } catch (e) {
        // audio safeguard
    }

    addLogEntry("DOKTRIN", `🌌 ERSTKONTAKT: Najmafars Geist berührt das Bewusstsein von ${candidate.name} (${candidate.species})!`);
}

export function closeFirstContactModal(): void {
    const modal = document.getElementById('first-contact-modal');
    if (modal) modal.style.display = 'none';
    isModalOpen = false;
}

export function chooseFirstContactDoctrine(paradigm: PrimaryParadigm): void {
    if (paradigm === 'neutral') return;

    setPrimaryParadigm(paradigm, true); // Initial awakening is instant and defining
    closeFirstContactModal();

    const titles: Record<PrimaryParadigm, string> = {
        domination: "⚡ HERRSCHAFT & UNTERWERFUNG",
        deception: "🔮 TÄUSCHUNG & TRAUM-MATRIX",
        symbiosis: "🌱 SYMBIOSE & HARMONIE",
        neutral: "🌌 NEUTRAL"
    };

    const descs: Record<PrimaryParadigm, string> = {
        domination: "Najmafars Wille zwingt das fremde Bewusstsein unter psionischen Gehorsam! Triebwerke und Hülle entfalten rohe Kraft.",
        deception: "Ein psionischer Traum-Schleier senkt sich herab. Die sterblichen Wesen glauben sich in einer vertrauten Forschungsstation.",
        symbiosis: "Najmafars Nervenbahnen verbinden sich in ehrlicher Resonanz mit dem Gast. Ein neues Zeitalter der Symbiose bricht an.",
        neutral: ""
    };

    try {
        playBioHarvestSound();
    } catch (e) {
        // audio safeguard
    }

    addLogEntry("DOKTRIN", `✨ ERSTKONTAKT BESIEGELT: Najmafar wählt den Pfad [${titles[paradigm]}]!`);
    addLogEntry("CREW", descs[paradigm]);

    updateHUDStats();
    calculateCrewBuffs();
    renderCrewUI(true);
    updatePartyGrid();
    triggerAutoSave(`Doktrin gewählt: ${titles[paradigm]}`);
}

export function initFirstContactModalListeners(): void {
    const modal = document.getElementById('first-contact-modal');
    if (modal) {
        const closeBtn = document.getElementById('close-first-contact-modal-btn');
        if (closeBtn) {
            closeBtn.onclick = () => closeFirstContactModal();
        }
    }
}

if (typeof window !== 'undefined') {
    (window as any).chooseFirstContactDoctrine = (p: string) => chooseFirstContactDoctrine(p as PrimaryParadigm);
    (window as any).openFirstContactModal = () => {
        if (STATE.crew.length > 0) openFirstContactModal(STATE.crew[0]);
    };
    (window as any).closeFirstContactModal = () => closeFirstContactModal();
}
