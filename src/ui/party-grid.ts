import { STATE } from '../core/state';
import { CrewMember } from '../types/game';
import { addLogEntry } from './hud';
import {
    rejuvenateCrewMember,
    getSpeciesClusters,
    rejuvenateSpeciesCluster,
    toggleClusterExpansion,
    cyclePrimaryParadigm,
    getExpandedClustersKey
} from '../systems/crew';

let lastRenderedCrewIds = '';

/**
 * Renders and live-updates the RPG Party-Grid HUD on the left edge of the screen
 */
export function updatePartyGrid(): void {
    const container = document.getElementById('hud-party-grid');
    if (!container) return;

    const crew = STATE.crew;
    if (!crew || crew.length === 0) {
        if (container.innerHTML !== '') {
            container.innerHTML = '';
            lastRenderedCrewIds = '';
        }
        return;
    }

    const clusters = getSpeciesClusters();
    const useClustering = crew.length >= 6 || clusters.some(cl => cl.count >= 4);

    // Check if member IDs, order, clustering, paradigm, sub-codex, or cluster expansion changed
    const expandedKey = getExpandedClustersKey();
    const isTrans = STATE.doctrineTransition && STATE.doctrineTransition.active;
    const transPercent = isTrans ? Math.round(STATE.doctrineTransition.progress * 100) : 0;
    const transTarget = isTrans ? (STATE.doctrineTransition.targetParadigm === 'domination' ? '⚡ Herrschaft' : (STATE.doctrineTransition.targetParadigm === 'symbiosis' ? '🌱 Symbiose' : '🔮 Täuschung')) : '';
    const transKey = isTrans ? `trans_${transPercent}` : 'idle';
    const stationKey = crew.map(c => `${c.id}_${c.station}`).join('_');

    const currentCrewIds = `${STATE.primaryParadigm}_${STATE.activeSubCodex}_${useClustering}_${expandedKey}_${transKey}_${stationKey}_` + crew.map(c => `${c.id}_${c.ageCategory}`).join('|');
    const structureChanged = currentCrewIds !== lastRenderedCrewIds;

    const pIcon = STATE.primaryParadigm === 'neutral' ? '🌌' : (STATE.primaryParadigm === 'domination' ? '⚡' : (STATE.primaryParadigm === 'symbiosis' ? '🌱' : '🔮'));
    const pLabel = STATE.primaryParadigm === 'neutral' ? 'Einsamkeit (Neutral)' : (STATE.primaryParadigm === 'domination' ? 'Herrschaft' : (STATE.primaryParadigm === 'symbiosis' ? 'Symbiose' : 'Täuschung'));

    const badgeLabel = isTrans ? `🌀 Umwälzung ${transPercent}%` : `${pIcon} ${pLabel}`;
    const badgeTitle = STATE.primaryParadigm === 'neutral'
        ? (crew.length > 0 ? "Klicken: Erstkontakt-Doktrin besiegeln!" : "Najmafar ist in Einsamkeit gefangen. Erstkontakt erforderlich.")
        : (isTrans ? `Geistige Umwälzung aktiv (Ziel: ${transTarget}). Klicken: Schiffs-Doktrin weiter schalten.` : `Klicken: Schiffs-Doktrin wechseln (Herrschaft / Täuschung / Symbiose)`);

    const doctrineBadge = `
        <button id="party-doctrine-btn" class="party-doctrine-btn" title="${badgeTitle}" style="width: 100%; margin-bottom: 6px; padding: 4px 6px; font-size: 0.65rem; font-weight: bold; border-radius: 4px; background: ${isTrans ? 'rgba(88,28,135,0.85)' : 'rgba(15,23,42,0.85)'}; border: 1px solid ${isTrans ? '#38bdf8' : 'rgba(168,85,247,0.5)'}; color: #cbd5e1; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s ease;">
            <span style="display: flex; align-items: center; gap: 4px;"><span>${isTrans ? '🌀' : pIcon}</span> <span>${badgeLabel}</span></span>
            <span style="font-size: 0.6rem; color: #38bdf8;">${crew.length}/${STATE.maxCrewCapacity} 🔄</span>
        </button>
    `;

    if (structureChanged) {
        lastRenderedCrewIds = currentCrewIds;
        if (useClustering) {
            let html = doctrineBadge;
            clusters.forEach(cl => {
                html += renderPartyClusterCard(cl);
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = doctrineBadge + crew.map(c => renderPartyCard(c)).join('');
        }
        attachPartyGridEvents();
    } else {
        // Fast DOM live-update for age bars, percentages, and status
        // 1. Live update Cluster Cards
        clusters.forEach(cl => {
            const clusterCard = document.getElementById(`party-cluster-${cl.speciesName}`);
            if (clusterCard) {
                let clusterColor = '#10b981';
                if (cl.avgAgePercent < 15) clusterColor = '#ef4444';
                else if (cl.avgAgePercent < 45) clusterColor = '#f59e0b';

                const clusterBar = clusterCard.querySelector<HTMLElement>('.party-cluster-age-fill');
                if (clusterBar) {
                    clusterBar.style.width = `${cl.avgAgePercent}%`;
                    clusterBar.style.backgroundColor = clusterColor;
                }
                const clusterVal = clusterCard.querySelector<HTMLElement>('.party-cluster-age-val');
                if (clusterVal) {
                    clusterVal.innerText = `${cl.avgAgePercent}%`;
                    clusterVal.style.color = clusterColor;
                }
            }
        });

        // 2. Live update Individual Crew Cards (unclustered or expanded within cluster)
        crew.forEach(c => {
            const card = document.getElementById(`party-card-${c.id}`);
            if (!card || typeof card.querySelector !== 'function') return;

            const maxLife = c.maxLifespan || 540;
            const currentAge = Math.min(maxLife, Math.floor(c.age || 0));
            const lifePercent = Math.max(0, Math.min(100, Math.round((1.0 - (currentAge / maxLife)) * 100)));

            // Color coding
            let barColor = '#10b981'; // Green
            if (lifePercent < 15) barColor = '#ef4444'; // Red
            else if (lifePercent < 45) barColor = '#f59e0b'; // Amber

            const ageBar = card.querySelector<HTMLElement>('.party-age-fill');
            if (ageBar) {
                ageBar.style.width = `${lifePercent}%`;
                ageBar.style.backgroundColor = barColor;
            }

            const ageText = card.querySelector<HTMLElement>('.party-age-val');
            if (ageText) {
                ageText.innerText = `${lifePercent}%`;
                ageText.style.color = barColor;
            }

            const stressBar = card.querySelector<HTMLElement>('.party-stress-fill');
            if (stressBar) {
                stressBar.style.width = `${Math.min(100, Math.round(c.stress))}%`;
            }

            const stabilityBar = card.querySelector<HTMLElement>('.party-stability-fill');
            if (stabilityBar) {
                stabilityBar.style.width = `${Math.min(100, Math.round(c.illusionStability))}%`;
            }

            const tooltipAge = card.querySelector<HTMLElement>('.party-tooltip-age');
            if (tooltipAge) {
                tooltipAge.innerText = `${Math.floor(currentAge / 60)}:${String(currentAge % 60).padStart(2, '0')} / ${Math.floor(maxLife / 60)}:00 Min. (${lifePercent}% übrig)`;
            }

            const tooltipThought = card.querySelector<HTMLElement>('.party-tooltip-thought');
            if (tooltipThought) {
                tooltipThought.innerText = `"${c.thought}"`;
            }

            // Critical age pulse class
            if (lifePercent <= 10 || c.ageCategory === 'critical') {
                if (!card.classList.contains('critical-pulse')) {
                    card.classList.add('critical-pulse');
                }
            } else {
                card.classList.remove('critical-pulse');
            }
        });
    }
}

function renderPartyClusterCard(cl: any): string {
    let dispIcon = '🔬';
    if (cl.disposition === 'martial') dispIcon = '⚔️';
    else if (cl.disposition === 'empathic') dispIcon = '🍄';
    else if (cl.disposition === 'synthetic') dispIcon = '🤖';
    else if (cl.disposition === 'lithoid') dispIcon = '💠';

    let clusterColor = '#10b981';
    if (cl.avgAgePercent < 15) clusterColor = '#ef4444';
    else if (cl.avgAgePercent < 45) clusterColor = '#f59e0b';

    return `
        <div id="party-cluster-${cl.speciesName}" class="party-cluster-card glass-panel" style="margin-bottom: 6px; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(30,41,59,0.7);">
            <div class="party-cluster-header" data-cluster-toggle="${cl.speciesName}" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 1.1rem;">${cl.avatarIcon}</span>
                    <div>
                        <div style="font-weight: 700; color: ${cl.speciesColor}; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;">${cl.speciesName}</div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="font-size: 0.6rem; color: #38bdf8;">${cl.count}x • ${dispIcon}</span>
                            <span class="party-cluster-age-val" style="font-size: 0.6rem; color: ${clusterColor}; font-weight: 700;">${cl.avgAgePercent}%</span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 3px;" onclick="event.stopPropagation()">
                    <button class="party-cluster-rejuv-btn" data-cluster-species="${cl.speciesName}" title="Kollektiv-Verjüngung (${cl.count}x)" style="cursor: pointer; background: rgba(16,185,129,0.3); border: 1px solid #10b981; color: #fff; border-radius: 3px; font-size: 0.65rem; padding: 1px 4px;">💉</button>
                    <button class="party-cluster-toggle-btn" data-cluster-toggle="${cl.speciesName}" style="cursor: pointer; background: rgba(168,85,247,0.3); border: 1px solid #a855f7; color: #fff; border-radius: 3px; font-size: 0.65rem; padding: 1px 4px;">${cl.isExpanded ? '▲' : '▼'}</button>
                </div>
            </div>
            <!-- Average Vitality Track -->
            <div style="margin-top: 4px; height: 3px; background: rgba(0,0,0,0.4); border-radius: 2px; overflow: hidden;">
                <div class="party-cluster-age-fill" style="width: ${cl.avgAgePercent}%; height: 100%; background: ${clusterColor}; transition: width 0.3s ease;"></div>
            </div>
            ${cl.isExpanded ? `
                <div class="party-cluster-members" style="margin-top: 6px; padding-left: 4px; border-left: 2px solid ${cl.speciesColor};">
                    ${cl.members.map((m: CrewMember) => renderPartyCard(m)).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function renderPartyCard(c: CrewMember): string {
    const maxLife = c.maxLifespan || 540;
    const currentAge = Math.min(maxLife, Math.floor(c.age || 0));
    const lifePercent = Math.max(0, Math.min(100, Math.round((1.0 - (currentAge / maxLife)) * 100)));

    let barColor = '#10b981';
    if (lifePercent < 15) barColor = '#ef4444';
    else if (lifePercent < 45) barColor = '#f59e0b';

    const isCritical = lifePercent <= 10 || c.ageCategory === 'critical';
    const speciesColor = c.speciesColor || '#38bdf8';
    const avatar = c.avatarIcon || '👤';
    const station = c.stationName || 'Organ-Station';
    const stationIcon = c.station === 'flight_synapse' ? '🚀' : (c.station === 'chitin_gland' ? '🛡️' : (c.station === 'bio_incubator' ? '🧪' : '🔮'));
    const traitText = c.trait ? `${c.trait.name}: ${c.trait.desc}` : (c.perk || c.buffDesc);

    return `
        <div id="party-card-${c.id}" class="party-card glass-panel ${isCritical ? 'critical-pulse' : ''}" data-crew-id="${c.id}">
            <!-- Left Portrait Badge -->
            <div class="party-portrait" style="--species-glow: ${speciesColor}">
                <div class="party-avatar-ring">
                    <span class="party-avatar-icon">${avatar}</span>
                </div>
                <div class="party-station-icon" title="${station}">${stationIcon}</div>
            </div>

            <!-- Card Body / Vital Details -->
            <div class="party-details">
                <div class="party-top-row">
                    <span class="party-name" title="${c.name} (${c.species})">${c.name}</span>
                    <button class="party-rejuv-btn" data-rejuv-id="${c.id}" title="Zell-Verjüngung (-35% Alter)">💉</button>
                </div>
                <div class="party-station-label">${stationIcon} ${station}</div>

                <!-- Lifespan Bar -->
                <div class="party-meter-row" title="Biologische Vitalität / Restlebensspanne">
                    <span class="party-meter-label">⏳</span>
                    <div class="party-meter-track">
                        <div class="party-age-fill" style="width: ${lifePercent}%; background-color: ${barColor};"></div>
                    </div>
                    <span class="party-age-val" style="color: ${barColor};">${lifePercent}%</span>
                </div>

                <!-- Dual Micro Meters: Stability & Stress -->
                <div class="party-micro-meters">
                    <div class="micro-meter" title="Traum-Stabilität: ${Math.round(c.illusionStability)}%">
                        <span class="micro-label">🔮</span>
                        <div class="micro-track">
                            <div class="party-stability-fill" style="width: ${Math.round(c.illusionStability)}%;"></div>
                        </div>
                    </div>
                    <div class="micro-meter" title="Stress: ${Math.round(c.stress)}%">
                        <span class="micro-label">⚡</span>
                        <div class="micro-track">
                            <div class="party-stress-fill" style="width: ${Math.round(c.stress)}%;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Rich Tooltip on Hover -->
            <div class="party-card-tooltip">
                <div class="tooltip-header">
                    <strong>${c.name}</strong>
                    <span style="color: ${speciesColor}; font-size: 0.7rem;">${c.species}</span>
                </div>
                <div class="tooltip-row"><strong>Organ-Station:</strong> ${stationIcon} ${station}</div>
                <div class="tooltip-row"><strong>Rolle:</strong> ${c.roleIcon || '👤'} ${c.roleName || c.role}</div>
                <div class="tooltip-row"><strong>Eigenschaft:</strong> ${traitText}</div>
                <div class="tooltip-row"><strong>Aktivität:</strong> <em>${c.stationActivity || 'Synchronisiert'}</em></div>
                <div class="tooltip-row"><strong>Alter:</strong> <span class="party-tooltip-age">${Math.floor(currentAge / 60)}:${String(currentAge % 60).padStart(2, '0')} / ${Math.floor(maxLife / 60)}:00 Min. (${lifePercent}% übrig)</span></div>
                <div class="tooltip-thought">💭 <em><span class="party-tooltip-thought">"${c.thought}"</span></em></div>
            </div>
        </div>
    `;
}

function attachPartyGridEvents(): void {
    const doctrineBtn = document.getElementById('party-doctrine-btn');
    if (doctrineBtn) {
        doctrineBtn.onclick = (e) => {
            e.stopPropagation();
            if (STATE.primaryParadigm === 'neutral') {
                if (STATE.crew.length > 0 && typeof (window as any).openFirstContactModal === 'function') {
                    (window as any).openFirstContactModal();
                } else {
                    addLogEntry("DOKTRIN", "🌌 Najmafar ist in mentaler Einsamkeit gefangen. Erstkontakt mit einer Spezies erforderlich!");
                }
                return;
            }
            cyclePrimaryParadigm();
        };
    }

    const rejuvBtns = document.querySelectorAll<HTMLButtonElement>('.party-rejuv-btn');
    rejuvBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const id = Number(btn.getAttribute('data-rejuv-id'));
            if (id) {
                rejuvenateCrewMember(id);
                updatePartyGrid();
            }
        };
    });

    const clusterRejuvBtns = document.querySelectorAll<HTMLButtonElement>('.party-cluster-rejuv-btn');
    clusterRejuvBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const species = btn.getAttribute('data-cluster-species');
            if (species) {
                rejuvenateSpeciesCluster(species);
                updatePartyGrid();
            }
        };
    });

    const clusterHeaders = document.querySelectorAll<HTMLElement>('.party-cluster-header');
    clusterHeaders.forEach(header => {
        header.onclick = (e) => {
            const species = header.getAttribute('data-cluster-toggle');
            if (species) {
                toggleClusterExpansion(species);
            }
        };
    });

    const clusterToggleBtns = document.querySelectorAll<HTMLButtonElement>('.party-cluster-toggle-btn');
    clusterToggleBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const species = btn.getAttribute('data-cluster-toggle');
            if (species) {
                toggleClusterExpansion(species);
            }
        };
    });
}

/**
 * Triggers an unmissable tribute and dissolution banner when a crew member passes away
 */
export function triggerCrewDeathNotification(name: string, species: string, avatar: string = '👤'): void {
    const container = document.getElementById('crew-death-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'crew-death-toast';
    toast.innerHTML = `
        <div class="death-toast-left">
            <span class="death-avatar">${avatar}</span>
            <div class="death-aura-circle"></div>
        </div>
        <div class="death-toast-content">
            <div class="death-kicker">⚰️ BIOLOGISCHER ZELLTOD & RESORPTION</div>
            <div class="death-title">${name}</div>
            <div class="death-meta">${species} ist friedlich in den Nährstoffkreislauf des Rumpfes übergegangen.</div>
            <div class="death-resorption-badge">+45 Bio-Energie resorbiert</div>
        </div>
        <button class="death-toast-dismiss" title="Schließen">✕</button>
    `;

    const dismissBtn = toast.querySelector('.death-toast-dismiss');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            toast.classList.add('dissolve-out');
            setTimeout(() => toast.remove(), 400);
        });
    }

    container.appendChild(toast);

    // Auto dismiss after 7 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('dissolve-out');
            setTimeout(() => toast.remove(), 400);
        }
    }, 7000);
}
