import { STATE } from '../core/state';
import { buyMutation } from './deck';
import { playSynapseHoverSound, playSynapseEvolveSound } from '../engine/audio';

export interface MutationNodeDef {
    key: string;
    name: string;
    shortName: string;
    branch: 'nucleus' | 'chitin' | 'cocoon' | 'psionic' | 'artifact';
    branchLabel: string;
    branchColor: string;
    icon: string;
    desc: string;
    effect: string;
    lore: string;
    precursor: string | null;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    bioCost: number;
    siliconCost: number;
    techCost?: number;
}

export const MUTATION_DEFINITIONS: Record<string, MutationNodeDef> = {
    // Cephalic Bio-Core: Najmafars Herzzelle / Zerebrum (Left-Center)
    nucleus: {
        key: 'nucleus',
        name: 'Najmafars Herzzelle',
        shortName: 'Herzzelle',
        branch: 'nucleus',
        branchLabel: 'Najmafars Zerebrum',
        branchColor: '#f43f5e',
        icon: '🫀',
        desc: 'Pulsierender biometrischer Kern und Zerebral-Knotenpunkt von Najmafar.',
        effect: 'Vitales Zentrum aller neuronalen Stränge & Lebenspulse',
        lore: 'Hier schlägt Najmafars Herz in der Einsamkeit des Vakuums und speist alle biologischen Synapsen.',
        precursor: null,
        x: 10,
        y: 50,
        bioCost: 0,
        siliconCost: 0
    },

    // Ast 1: Chitin & Fleisch (Dorsaler Panzerkamm - Rumpf & Strahlenschutz)
    organic_siphon: {
        key: 'organic_siphon',
        name: 'Organischer Siphon',
        shortName: 'Bio-Siphon',
        branch: 'chitin',
        branchLabel: 'Chitin & Fleisch',
        branchColor: '#10b981',
        icon: '🌱',
        desc: 'Raffinierte Biomasse-Saugkanäle und integrierte Strahlungs-Filterschichten.',
        effect: '+35% Ernte-Geschwindigkeit • +25% Strahlungsschutz (verlangsamt strahlungsbedingten Zelltod)',
        lore: 'Fleischige Röhren saugen Mineralien und filtern kosmische Partikel direkt in den Rumpf.',
        precursor: 'nucleus',
        x: 30,
        y: 22,
        bioCost: 120,
        siliconCost: 60
    },
    chitin_armor: {
        key: 'chitin_armor',
        name: 'Chitin-Panzer',
        shortName: 'Chitin-Panzer',
        branch: 'chitin',
        branchLabel: 'Chitin & Fleisch',
        branchColor: '#10b981',
        icon: '🛡️',
        desc: 'Kristallisierte biomolekulare Chitin-Schuppen mit zusätzlicher Strahlungs-Reflexionsschicht.',
        effect: '-50% Kollisionsschaden • +25% Strahlungsschutz (+50% kumulativ)',
        lore: 'Ein dichter Panzer aus organischen Silikaten umschließt Najmafars weiche Tentakel.',
        precursor: 'organic_siphon',
        x: 50,
        y: 18,
        bioCost: 220,
        siliconCost: 130
    },
    vector_tentacles: {
        key: 'vector_tentacles',
        name: 'Vektor-Tentakel',
        shortName: 'Vektor-Tentakel',
        branch: 'chitin',
        branchLabel: 'Chitin & Fleisch',
        branchColor: '#10b981',
        icon: '🐙',
        desc: 'Verstärkte Muskelstränge und hydrodynamische Bio-Gegenstromdüsen im Vakuum.',
        effect: '+25% Schub • +35% Wendigkeit • Hydrodynamische Bio-Bremse',
        lore: 'Muskulöse Tentakel peitschen durch das Raumkrümmungsfeld und verleihen ungeahnte Agilität.',
        precursor: 'chitin_armor',
        x: 70,
        y: 20,
        bioCost: 360,
        siliconCost: 240,
        techCost: 10
    },
    blade_armor: {
        key: 'blade_armor',
        name: 'Klingen-Panzerung',
        shortName: 'Klingen-Panzer',
        branch: 'chitin',
        branchLabel: 'Chitin & Fleisch (Apex)',
        branchColor: '#059669',
        icon: '⚔️',
        desc: 'Rasiermesserscharfe Chitin-Stacheln und dichte bio-magnetische Schutzmembran.',
        effect: '+35% Strahlungsschutz (bis zu 85% gesamt) • Reflektiert Nahbereichsschaden',
        lore: 'Kristalline Klingen brechen tödliche Röntgen- und Gammawellen naher Sterne vollkommen.',
        precursor: 'vector_tentacles',
        x: 90,
        y: 26,
        bioCost: 550,
        siliconCost: 420,
        techCost: 15
    },

    // Ast 2: Neuronales Nest (Zentrales Nervenmark - Kapazität)
    cocoon: {
        key: 'cocoon',
        name: 'Kokon (4)',
        shortName: 'Kokon (4)',
        branch: 'cocoon',
        branchLabel: 'Neuronales Nest',
        branchColor: '#c084fc',
        icon: '🥚',
        desc: 'Organische Brutkammern und biometrisches Kokongewebe zur Unterbringung von 4 entführten Wesen.',
        effect: 'Basis-Kapazität: 4 Crew-Mitglieder • Schützt vor Weltraum-Hypoxie',
        lore: 'Das primäre Nestgewebe. Najmafars Zellwände formen nachgiebige Membranen für fremde Körper.',
        precursor: 'nucleus',
        x: 28,
        y: 50,
        bioCost: 320,
        siliconCost: 140
    },
    hivemind: {
        key: 'hivemind',
        name: 'Schwarm-Synapse (6)',
        shortName: 'Schwarm (6)',
        branch: 'cocoon',
        branchLabel: 'Neuronales Nest',
        branchColor: '#c084fc',
        icon: '🧬',
        desc: 'Verschaltet Nervenenden der Besatzung direkt mit Najmafars zentralem Nervenstrang.',
        effect: 'Crew-Kapazität: 6 • +20% auf alle Spezialisten-Buffs (Pilot, Bio, Ing, Psych)',
        lore: 'Feine Synapsenfäden senken sich aus der Decke herab und synchronisieren Gehirnwellen.',
        precursor: 'cocoon',
        x: 43,
        y: 50,
        bioCost: 500,
        siliconCost: 320
    },
    neural_cluster: {
        key: 'neural_cluster',
        name: 'Neuronale Wabe (10)',
        shortName: 'Wabe (10)',
        branch: 'cocoon',
        branchLabel: 'Neuronales Nest',
        branchColor: '#a855f7',
        icon: '🕸️',
        desc: 'Geometrisch angeordnete Chitin-Wabenstrukturen dämpfen psionische Dissonanzen.',
        effect: 'Crew-Kapazität: 10 • Spezies-Clustering & Schutz vor Massenpanik',
        lore: 'Sechseckige Kammern isolieren divergierende mentale Schwingungen verfeindeter Spezies.',
        precursor: 'hivemind',
        x: 58,
        y: 50,
        bioCost: 650,
        siliconCost: 450,
        techCost: 20
    },
    cryo_matrix: {
        key: 'cryo_matrix',
        name: 'Kryo-Matrix (20)',
        shortName: 'Kryo (20)',
        branch: 'cocoon',
        branchLabel: 'Neuronales Nest',
        branchColor: '#a855f7',
        icon: '❄️',
        desc: 'Organische Frost-Enzyme verlangsamen den natürlichen Zelltod um 25%.',
        effect: 'Crew-Kapazität: 20 • -25% Zelltod (verlängert Lebensdauer aller Gefangenen)',
        lore: 'Kryogene Schleimhäute kühlen den Metabolismus und frieren Telomer-Verfall ein.',
        precursor: 'neural_cluster',
        x: 74,
        y: 50,
        bioCost: 950,
        siliconCost: 750,
        techCost: 15
    },
    hive_cerebrum: {
        key: 'hive_cerebrum',
        name: 'Schwarm-Zerebrum (30)',
        shortName: 'Zerebrum (30)',
        branch: 'cocoon',
        branchLabel: 'Neuronales Nest (Apex)',
        branchColor: '#ec4899',
        icon: '👑',
        desc: 'Vollendete psionische Schwarm-Kollimation und telepathische Verschmelzung.',
        effect: 'Crew-Kapazität: 30 • Schaltet maximale kollektive Schwarm-Resonanz frei',
        lore: 'Najmafar und die 30 Wesen verschmelzen zu einem einzigen kosmischen Über-Bewusstsein.',
        precursor: 'cryo_matrix',
        x: 90,
        y: 50,
        bioCost: 1500,
        siliconCost: 1200,
        techCost: 30
    },

    // Ast 3: Psionik & Geist (Ventraler Mentaltentakel - Kräfte & Sensorik)
    telepathic_focus: {
        key: 'telepathic_focus',
        name: 'Telepathischer Fokus',
        shortName: 'Telepathie',
        branch: 'psionic',
        branchLabel: 'Psionik & Geist',
        branchColor: '#38bdf8',
        icon: '📡',
        desc: 'Sub-kognitiver Sprachknoten dechiffriert fremde Frequenz-Muster und Gedanken.',
        effect: 'Automatisierte Dechiffrierung von Funksignalen & Crew-Gedanken • -30% Mentalkraft-Verbrauch',
        lore: 'Najmafar lernt die Sprachen der Sterblichen zu fühlen statt sie zu hören.',
        precursor: 'nucleus',
        x: 30,
        y: 78,
        bioCost: 140,
        siliconCost: 80
    },
    psionic_pulse: {
        key: 'psionic_pulse',
        name: 'Psionischer Impuls',
        shortName: 'Psio-Impuls',
        branch: 'psionic',
        branchLabel: 'Psionik & Geist',
        branchColor: '#38bdf8',
        icon: '⚡',
        desc: 'Verstärkt Najmafars Gedanken-Echo und erweitert die Telepathie-Reichweite.',
        effect: '150 Max Mentalkraft • 140 LJ Gedanken-Echo Reichweite',
        lore: 'Lange bio-elektrische Tentakel ragen ins Vakuum und fangen mentale Resonanzen ferner Welten auf.',
        precursor: 'telepathic_focus',
        x: 50,
        y: 82,
        bioCost: 280,
        siliconCost: 160
    },
    chimera_veil: {
        key: 'chimera_veil',
        name: 'Schimären-Schleier',
        shortName: 'Schimäre',
        branch: 'psionic',
        branchLabel: 'Psionik & Geist',
        branchColor: '#38bdf8',
        icon: '🌫️',
        desc: 'Licht- und Sensorbeugendes Tarnfeld aus psionischen Interferenzen.',
        effect: '+40% Tarnung (Stealth) • Stress-Immunität bei gegnerischer Sensor-Erfassung',
        lore: 'Das Schiff verschwimmt zu einer geisterhaften Fata Morgana im Lichtspektrum fremder Scanner.',
        precursor: 'psionic_pulse',
        x: 70,
        y: 80,
        bioCost: 420,
        siliconCost: 300,
        techCost: 15
    },
    resonance_screech: {
        key: 'resonance_screech',
        name: 'Resonanz-Schrei',
        shortName: 'Resonanz',
        branch: 'psionic',
        branchLabel: 'Psionik & Geist (Apex)',
        branchColor: '#0284c7',
        icon: '📣',
        desc: 'Vernichtende bio-akustische & psionische Schockwelle bricht künstliche Elektronik.',
        effect: 'Bio-EMP lähmt Drohnen 50% länger • Schlägt feindliche Entermannschaften in Flucht',
        lore: 'Ein ohrenbetäubender Schrei auf allen Frequenzen gleichzeitig zerreißt Schaltkreise und Verstand.',
        precursor: 'chimera_veil',
        x: 90,
        y: 74,
        bioCost: 600,
        siliconCost: 480
    },

    // Relikt: Augen des Ibad (Melange-Erleuchtung)
    ibad: {
        key: 'ibad',
        name: 'Augen des Ibad (Melange)',
        shortName: 'Augen d. Ibad',
        branch: 'artifact',
        branchLabel: 'Kosmisches Arrakis-Relikt',
        branchColor: '#f59e0b',
        icon: '👁️',
        desc: 'Blau-in-blau gefärbte Sklera durch Arrakis-Melange. Prophetische Weitsicht.',
        effect: 'Harmonisiert den Geist • Heilt Psychosen & Traumata der Gefangenen',
        lore: 'Die Melange von Arrakis öffnet Najmafars Geist für Pfade der Zeit und heilt verletzte Seelen.',
        precursor: 'psionic_pulse',
        x: 60,
        y: 66,
        bioCost: 0,
        siliconCost: 0
    }
};

// Non-enumerable legacy aliases (preserves compatibility with older tests and save states while keeping Object.keys clean)
Object.defineProperty(MUTATION_DEFINITIONS, 'armor', {
    get() { return MUTATION_DEFINITIONS.chitin_armor; },
    enumerable: false,
    configurable: true
});
Object.defineProperty(MUTATION_DEFINITIONS, 'translator', {
    get() { return MUTATION_DEFINITIONS.telepathic_focus; },
    enumerable: false,
    configurable: true
});
Object.defineProperty(MUTATION_DEFINITIONS, 'synapses', {
    get() { return MUTATION_DEFINITIONS.psionic_pulse; },
    enumerable: false,
    configurable: true
});

export const MUTATION_CONNECTIONS: [string, string][] = [
    // Ast 1: Chitin & Fleisch
    ['nucleus', 'organic_siphon'],
    ['organic_siphon', 'chitin_armor'],
    ['chitin_armor', 'vector_tentacles'],
    ['vector_tentacles', 'blade_armor'],

    // Ast 2: Neuronales Nest
    ['nucleus', 'cocoon'],
    ['cocoon', 'hivemind'],
    ['hivemind', 'neural_cluster'],
    ['neural_cluster', 'cryo_matrix'],
    ['cryo_matrix', 'hive_cerebrum'],

    // Ast 3: Psionik & Geist
    ['nucleus', 'telepathic_focus'],
    ['telepathic_focus', 'psionic_pulse'],
    ['psionic_pulse', 'chimera_veil'],
    ['chimera_veil', 'resonance_screech'],

    // Relikt
    ['psionic_pulse', 'ibad']
];

let selectedMutationKey: string = 'cocoon';
let isCanvasLoopRunning: boolean = false;
let animationFrameId: number | null = null;

// Dynamic Particle & Pulse Pools for the living canvas
interface CytoplasmSpore {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    pulseSpeed: number;
    pulsePhase: number;
    color: string;
}

interface ActionPotentialSpark {
    pKey: string;
    cKey: string;
    t: number;      // 0.0 to 1.0 along the bezier curve
    speed: number;  // progress per second
    color: string;
    size: number;
}

interface ShockwaveRing {
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
    alpha: number;
    color: string;
}

const spores: CytoplasmSpore[] = [];
const sparks: ActionPotentialSpark[] = [];
const shockwaves: ShockwaveRing[] = [];

export function getSelectedMutationKey(): string {
    return selectedMutationKey;
}

export function selectMutationNode(key: string): void {
    if (!MUTATION_DEFINITIONS[key]) return;
    selectedMutationKey = key;
    updateEvolutionTreeUI();

    // Trigger focused synaptic spark surge towards selected node
    const def = MUTATION_DEFINITIONS[key];
    if (def) {
        triggerSynapseShockwave(def.x, def.y, def.branchColor, 40);
    }
}

/**
 * Gets all upstream ancestor keys for a given node
 */
export function getNodeAncestors(key: string): string[] {
    const ancestors: string[] = [];
    let current = MUTATION_DEFINITIONS[key]?.precursor;
    while (current) {
        ancestors.push(current);
        current = MUTATION_DEFINITIONS[current]?.precursor || null;
    }
    return ancestors;
}

/**
 * Highlights or unhighlights the entire neural pathway leading to the given node
 */
export function highlightPathway(targetKey: string | null): void {
    const axons = document.querySelectorAll('.axon-path');
    const nodes = document.querySelectorAll('.synapse-node');

    axons.forEach(a => a.classList.remove('path-highlight'));
    nodes.forEach(n => n.classList.remove('path-highlight'));

    if (!targetKey) return;

    const ancestors = getNodeAncestors(targetKey);
    const fullChain = [targetKey, ...ancestors];

    // Highlight nodes in the chain
    fullChain.forEach(k => {
        const nodeEl = document.getElementById(`mut-node-${k}`);
        if (nodeEl) nodeEl.classList.add('path-highlight');
    });

    // Highlight connecting axons
    for (let i = 0; i < fullChain.length - 1; i++) {
        const child = fullChain[i];
        const parent = fullChain[i + 1];
        const axonEl = document.getElementById(`axon-${parent}-${child}`);
        if (axonEl) axonEl.classList.add('path-highlight');
    }
}

/**
 * Evaluates a cubic bezier curve point at t (0 <= t <= 1)
 */
function getCubicBezierPoint(
    p0x: number, p0y: number,
    p1x: number, p1y: number,
    t: number
): { x: number; y: number } {
    const dx = p1x - p0x;
    const cx1 = p0x + dx * 0.5;
    const cy1 = p0y;
    const cx2 = p0x + dx * 0.5;
    const cy2 = p1y;

    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    const x = uuu * p0x + 3 * uu * t * cx1 + 3 * u * tt * cx2 + ttt * p1x;
    const y = uuu * p0y + 3 * uu * t * cy1 + 3 * u * tt * cy2 + ttt * p1y;

    return { x, y };
}

/**
 * Triggers an expanding bio-luminescent shockwave ring
 */
export function triggerSynapseShockwave(pctX: number, pctY: number, color: string = '#c084fc', maxR: number = 70): void {
    const canvas = document.getElementById('synapse-neural-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const w = canvas.width || 600;
    const h = canvas.height || 440;
    shockwaves.push({
        x: (pctX / 100) * w,
        y: (pctY / 100) * h,
        radius: 4,
        maxRadius: maxR,
        alpha: 0.9,
        color
    });
}

/**
 * Initializes the Living Canvas, SVG Axons and Node elements
 */
export function initEvolutionTree(): void {
    const axonsGroup = document.getElementById('synapse-axons-group');
    const nodesLayer = document.getElementById('synapse-nodes-layer');
    if (!axonsGroup || !nodesLayer) return;

    // 1. Render SVG Axon paths connecting parent and child nodes
    axonsGroup.innerHTML = MUTATION_CONNECTIONS.map(([pKey, cKey]) => {
        const p = MUTATION_DEFINITIONS[pKey];
        const c = MUTATION_DEFINITIONS[cKey];
        if (!p || !c) return '';

        const dx = c.x - p.x;
        const cx1 = p.x + dx * 0.5;
        const cy1 = p.y;
        const cx2 = p.x + dx * 0.5;
        const cy2 = c.y;

        const d = `M ${p.x} ${p.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${c.x} ${c.y}`;

        return `
            <path id="axon-${pKey}-${cKey}" class="axon-path axon-locked axon-${c.branch}" d="${d}" data-parent="${pKey}" data-child="${cKey}" />
        `;
    }).join('');

    // 2. Render Synapse Nodes
    nodesLayer.innerHTML = Object.values(MUTATION_DEFINITIONS).map(def => {
        const isRoot = def.key === 'nucleus';
        return `
            <div class="synapse-node ${isRoot ? 'root-nucleus' : ''} branch-${def.branch}" id="mut-node-${def.key}" data-mutation="${def.key}" style="left: ${def.x}%; top: ${def.y}%;">
                <div class="synapse-node-ring">
                    <span class="synapse-node-icon">${def.icon}</span>
                    <span class="synapse-node-pulse"></span>
                </div>
                <div class="synapse-node-tag">
                    <span class="synapse-node-name">${def.shortName || def.name}</span>
                    <span class="synapse-node-badge" id="mut-badge-${def.key}">...</span>
                </div>
                <!-- Hidden button for backward compatibility with querySelector('.mut-btn[data-mutation="..."]') -->
                <button class="mut-btn" data-mutation="${def.key}" style="display: none;"></button>
            </div>
        `;
    }).join('');

    // 3. Attach interactive events to nodes (Click & Hover)
    const nodeEls = nodesLayer.querySelectorAll<HTMLElement>('.synapse-node');
    nodeEls.forEach(el => {
        const key = el.getAttribute('data-mutation');
        if (!key) return;

        el.onclick = (e) => {
            e.stopPropagation();
            const def = MUTATION_DEFINITIONS[key];
            const mut = (STATE.mutations as any)[key];
            const isPurchased = Boolean(mut && mut.purchased);
            let isPrecursorMet = true;
            if (def && def.precursor) {
                const prec = (STATE.mutations as any)[def.precursor];
                isPrecursorMet = Boolean(prec && prec.purchased);
            }
            const canAfford = def && STATE.bioRes >= def.bioCost && STATE.siliconRes >= def.siliconCost;

            if (def && !isPurchased && isPrecursorMet && canAfford) {
                // Direct synthesis when clicking an available node with sufficient resources
                buyMutation(key);
                playSynapseEvolveSound();
                triggerSynapseShockwave(def.x, def.y, def.branchColor, 90);
                selectMutationNode(key);
            } else {
                selectMutationNode(key);
            }
        };

        el.onmouseenter = () => {
            highlightPathway(key);
            const def = MUTATION_DEFINITIONS[key];
            if (def) {
                // Pitch based on Y position (deeper frequency at top cocoon/nucleus, higher at apex/edges)
                const freq = 360 + (def.y * 3.5);
                playSynapseHoverSound(freq);
            }
        };

        el.onmouseleave = () => {
            highlightPathway(null);
        };
    });

    // 4. Initialize Protoplasm Spore Pool
    spores.length = 0;
    const sporeColors = ['#10b981', '#34d399', '#c084fc', '#a855f7', '#38bdf8', '#06b6d4', '#f43f5e'];
    for (let i = 0; i < 42; i++) {
        spores.push({
            x: Math.random() * 600,
            y: Math.random() * 440,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            size: 1.5 + Math.random() * 2.5,
            alpha: 0.15 + Math.random() * 0.45,
            pulseSpeed: 1 + Math.random() * 2,
            pulsePhase: Math.random() * Math.PI * 2,
            color: sporeColors[Math.floor(Math.random() * sporeColors.length)]
        });
    }

    startNeuralCanvasLoop();
    updateEvolutionTreeUI();
}

/**
 * Starts the living biological canvas animation loop (spores, action potential sparks, shockwaves)
 */
export function startNeuralCanvasLoop(): void {
    if (isCanvasLoopRunning) return;
    isCanvasLoopRunning = true;

    const canvas = document.getElementById('synapse-neural-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    let lastTimestamp = performance.now();
    let sparkSpawnTimer = 0;

    function renderLoop(time: number) {
        if (!isCanvasLoopRunning) return;
        const dt = Math.min((time - lastTimestamp) / 1000, 0.1);
        lastTimestamp = time;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Resize canvas if needed
            const rect = canvas.getBoundingClientRect();
            if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
                canvas.width = Math.floor(rect.width) || 600;
                canvas.height = Math.floor(rect.height) || 440;
            }

            const w = canvas.width;
            const h = canvas.height;

            // Clear with slight trailing fade
            ctx.clearRect(0, 0, w, h);

            // Bio-Membrane Webbing: Draw living organic creep filaments between nodes (Zerg / Vorlon living hull)
            const timeSec = time / 1000;
            const membranePairs: [string, string][] = [
                ['nucleus', 'organic_siphon'],
                ['nucleus', 'cocoon'],
                ['nucleus', 'telepathic_focus'],
                ['organic_siphon', 'cocoon'],
                ['cocoon', 'telepathic_focus'],
                ['chitin_armor', 'hivemind'],
                ['hivemind', 'psionic_pulse'],
                ['vector_tentacles', 'neural_cluster'],
                ['neural_cluster', 'chimera_veil'],
                ['blade_armor', 'hive_cerebrum'],
                ['hive_cerebrum', 'resonance_screech']
            ];

            ctx.save();
            membranePairs.forEach(([k1, k2], idx) => {
                const n1 = MUTATION_DEFINITIONS[k1];
                const n2 = MUTATION_DEFINITIONS[k2];
                if (!n1 || !n2) return;
                const x1 = (n1.x / 100) * w;
                const y1 = (n1.y / 100) * h;
                const x2 = (n2.x / 100) * w;
                const y2 = (n2.y / 100) * h;
                const midX = (x1 + x2) * 0.5;
                const midY = (y1 + y2) * 0.5 + Math.sin(timeSec * 1.5 + idx) * 8;

                const grad = ctx.createLinearGradient(x1, y1, x2, y2);
                grad.addColorStop(0, n1.branchColor + '20');
                grad.addColorStop(0.5, '#a855f725');
                grad.addColorStop(1, n2.branchColor + '20');

                ctx.strokeStyle = grad;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.quadraticCurveTo(midX, midY, x2, y2);
                ctx.stroke();
            });
            ctx.restore();

            // A. Update & Render Protoplasm Spores
            spores.forEach(s => {
                s.x += s.vx * dt;
                s.y += s.vy * dt;

                // Bounce softly off borders
                if (s.x < 0) { s.x = 0; s.vx *= -1; }
                if (s.x > w) { s.x = w; s.vx *= -1; }
                if (s.y < 0) { s.y = 0; s.vy *= -1; }
                if (s.y > h) { s.y = h; s.vy *= -1; }

                s.pulsePhase += s.pulseSpeed * dt;
                const dynamicAlpha = Math.max(0.05, s.alpha + Math.sin(s.pulsePhase) * 0.2);

                ctx.save();
                ctx.globalAlpha = dynamicAlpha;
                ctx.fillStyle = s.color;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            // B. Spawn periodic action potential sparks along active and available axons
            sparkSpawnTimer += dt;
            if (sparkSpawnTimer >= 0.28) {
                sparkSpawnTimer = 0;
                const activeConn = MUTATION_CONNECTIONS.filter(([pKey, cKey]) => {
                    const pMut = (STATE.mutations as any)[pKey];
                    return Boolean(pMut && pMut.purchased);
                });

                if (activeConn.length > 0) {
                    const [pKey, cKey] = activeConn[Math.floor(Math.random() * activeConn.length)];
                    const cMut = (STATE.mutations as any)[cKey];
                    const cDef = MUTATION_DEFINITIONS[cKey];
                    const isBothPurchased = Boolean(cMut && cMut.purchased);

                    sparks.push({
                        pKey,
                        cKey,
                        t: 0,
                        speed: 0.5 + Math.random() * 0.6,
                        color: isBothPurchased ? (cDef?.branchColor || '#34d399') : '#c084fc',
                        size: isBothPurchased ? 3.2 : 2.2
                    });
                }
            }

            // C. Update & Render Action Potential Sparks
            for (let i = sparks.length - 1; i >= 0; i--) {
                const sp = sparks[i];
                sp.t += sp.speed * dt;

                if (sp.t >= 1.0) {
                    sparks.splice(i, 1);
                    continue;
                }

                const pDef = MUTATION_DEFINITIONS[sp.pKey];
                const cDef = MUTATION_DEFINITIONS[sp.cKey];
                if (!pDef || !cDef) {
                    sparks.splice(i, 1);
                    continue;
                }

                const p0x = (pDef.x / 100) * w;
                const p0y = (pDef.y / 100) * h;
                const p1x = (cDef.x / 100) * w;
                const p1y = (cDef.y / 100) * h;

                const pt = getCubicBezierPoint(p0x, p0y, p1x, p1y, sp.t);

                ctx.save();
                ctx.fillStyle = sp.color;
                ctx.shadowColor = sp.color;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, sp.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // D. Update & Render Shockwave Rings
            for (let i = shockwaves.length - 1; i >= 0; i--) {
                const sw = shockwaves[i];
                sw.radius += (sw.maxRadius - sw.radius) * (dt * 6);
                sw.alpha -= dt * 1.5;

                if (sw.alpha <= 0.02 || sw.radius >= sw.maxRadius * 0.95) {
                    shockwaves.splice(i, 1);
                    continue;
                }

                ctx.save();
                ctx.strokeStyle = sw.color;
                ctx.lineWidth = 2.5;
                ctx.globalAlpha = Math.max(0, sw.alpha);
                ctx.shadowColor = sw.color;
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        animationFrameId = requestAnimationFrame(renderLoop);
    }

    animationFrameId = requestAnimationFrame(renderLoop);
}

export function stopNeuralCanvasLoop(): void {
    isCanvasLoopRunning = false;
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

/**
 * Updates node states (purchased, available, locked, selected), SVG axon glow, and the inspector panel
 */
export function updateEvolutionTreeUI(): void {
    if (!STATE.mutations) return;

    let activeCount = 0;
    const totalCount = Object.keys(MUTATION_DEFINITIONS).length;

    // 1. Update Top Bar Counts
    const bioCountEl = document.getElementById('evo-bio-res');
    const silCountEl = document.getElementById('evo-silicon-res');
    const techCountEl = document.getElementById('evo-tech-res');
    const bioBadgeEl = document.getElementById('evo-biologist-badge');

    if (bioCountEl) bioCountEl.innerText = `${Math.floor(STATE.bioRes)}`;
    if (silCountEl) silCountEl.innerText = `${Math.floor(STATE.siliconRes)}`;
    if (techCountEl) techCountEl.innerText = `${Math.floor(STATE.techRes || 0)}`;

    const discount = STATE.mutationDiscount || 0;
    if (bioBadgeEl) {
        if (discount > 0) {
            bioBadgeEl.style.display = 'inline-flex';
            bioBadgeEl.innerText = `🧪 Biologen-Boost: -${Math.round(discount * 100)}%`;
        } else {
            bioBadgeEl.style.display = 'none';
        }
    }

    // 2. Update Each Node
    Object.values(MUTATION_DEFINITIONS).forEach(def => {
        const key = def.key;
        const mut = (STATE.mutations as any)[key] || { purchased: false, bioCost: def.bioCost, siliconCost: def.siliconCost, techCost: def.techCost };
        const isPurchased = Boolean(mut.purchased);
        if (isPurchased) activeCount++;

        // Determine if available (precursor satisfied)
        let isPrecursorMet = true;
        if (def.precursor) {
            const prec = (STATE.mutations as any)[def.precursor];
            isPrecursorMet = Boolean(prec && prec.purchased);
        }

        const effBioCost = Math.round(def.bioCost * (1 - discount));
        const effSilCost = Math.round(def.siliconCost * (1 - discount));
        const effTechCost = Math.round((def.techCost || 0) * (1 - discount));

        const canAfford = STATE.bioRes >= effBioCost && STATE.siliconRes >= effSilCost && (STATE.techRes || 0) >= effTechCost;
        const isAvailable = !isPurchased && isPrecursorMet;
        const isSelected = selectedMutationKey === key;

        const nodeEl = document.getElementById(`mut-node-${key}`);
        if (nodeEl) {
            nodeEl.classList.toggle('purchased', isPurchased);
            nodeEl.classList.toggle('available', isAvailable);
            nodeEl.classList.toggle('affordable', isAvailable && canAfford);
            nodeEl.classList.toggle('locked', !isPurchased && !isPrecursorMet);
            nodeEl.classList.toggle('selected', isSelected);

            const badgeEl = document.getElementById(`mut-badge-${key}`);
            if (badgeEl) {
                if (isPurchased) {
                    badgeEl.innerText = '✓ Aktiv';
                    badgeEl.style.color = '#10b981';
                } else if (!isPrecursorMet) {
                    badgeEl.innerText = '🔒 Gesperrt';
                    badgeEl.style.color = '#94a3b8';
                } else {
                    badgeEl.innerText = effTechCost > 0 ? `${effBioCost}🌿 ${effTechCost}🔬` : `${effBioCost}🌿`;
                    badgeEl.style.color = canAfford ? '#f59e0b' : '#ef4444';
                }
            }
        }
    });

    const activeCountEl = document.getElementById('evo-active-count');
    if (activeCountEl) {
        activeCountEl.innerText = `${activeCount}/${totalCount}`;
    }

    // 3. Update SVG Axon Connections
    MUTATION_CONNECTIONS.forEach(([pKey, cKey]) => {
        const axonEl = document.getElementById(`axon-${pKey}-${cKey}`);
        if (!axonEl) return;

        const pMut = (STATE.mutations as any)[pKey];
        const cMut = (STATE.mutations as any)[cKey];
        const pPurchased = Boolean(pMut && pMut.purchased);
        const cPurchased = Boolean(cMut && cMut.purchased);

        axonEl.classList.remove('axon-active', 'axon-available', 'axon-locked');

        if (pPurchased && cPurchased) {
            axonEl.classList.add('axon-active');
        } else if (pPurchased) {
            axonEl.classList.add('axon-available');
        } else {
            axonEl.classList.add('axon-locked');
        }
    });

    // 4. Update Synapse Inspector Panel
    renderSynapseInspector(selectedMutationKey);
}

/**
 * Renders the right-hand Inspector Card for the selected mutation
 */
export function renderSynapseInspector(key: string): void {
    const inspector = document.getElementById('synapse-inspector-panel');
    if (!inspector) return;

    const def = MUTATION_DEFINITIONS[key] || MUTATION_DEFINITIONS['cocoon'];
    const mut = (STATE.mutations as any)[def.key] || { purchased: false, bioCost: def.bioCost, siliconCost: def.siliconCost };
    const isPurchased = Boolean(mut.purchased);

    let isPrecursorMet = true;
    let precName = '';
    if (def.precursor) {
        const prec = (STATE.mutations as any)[def.precursor];
        isPrecursorMet = Boolean(prec && prec.purchased);
        precName = MUTATION_DEFINITIONS[def.precursor]?.name || def.precursor;
    }

    const discount = STATE.mutationDiscount || 0;
    const effBioCost = Math.round(def.bioCost * (1 - discount));
    const effSilCost = Math.round(def.siliconCost * (1 - discount));
    const effTechCost = Math.round((def.techCost || 0) * (1 - discount));

    const canAfford = STATE.bioRes >= effBioCost && STATE.siliconRes >= effSilCost && (STATE.techRes || 0) >= effTechCost;
    const canMutate = !isPurchased && isPrecursorMet && canAfford;

    let statusBadge = '';
    if (isPurchased) {
        statusBadge = `<span class="inspector-status-badge active">✓ VOLLSTÄNDIG ASSIMILIERT</span>`;
    } else if (!isPrecursorMet) {
        statusBadge = `<span class="inspector-status-badge locked">🔒 GESPERRT (VORAUSSETZUNG FEHLT)</span>`;
    } else if (canAfford) {
        statusBadge = `<span class="inspector-status-badge ready">⚡ BEREIT ZUR SYNTHESE</span>`;
    } else {
        statusBadge = `<span class="inspector-status-badge insufficient">⚠️ RESSOURCEN FEHLEN</span>`;
    }

    const bioDeficit = Math.max(0, effBioCost - STATE.bioRes);
    const silDeficit = Math.max(0, effSilCost - STATE.siliconRes);
    const techDeficit = Math.max(0, effTechCost - (STATE.techRes || 0));

    inspector.innerHTML = `
        <div class="inspector-header">
            <div class="inspector-icon-ring" style="border-color: ${def.branchColor}; box-shadow: 0 0 15px ${def.branchColor}66;">
                <span class="inspector-icon">${def.icon}</span>
            </div>
            <div class="inspector-title-col">
                <span class="inspector-branch-tag" style="color: ${def.branchColor};">${def.branchLabel}</span>
                <h3 class="inspector-title">${def.name}</h3>
                ${statusBadge}
                ${discount > 0 ? `<div style="font-size:0.68rem; color:#38bdf8; margin-top:3px; font-weight:600;">🧪 Biologen-Boost: -${Math.round(discount * 100)}% Kosten</div>` : ''}
            </div>
        </div>

        <div class="inspector-body">
            <!-- Lore & Description -->
            <div class="inspector-section">
                <div class="inspector-sec-label">🧬 Biologische Mutation</div>
                <p class="inspector-desc">${def.desc}</p>
                <div class="inspector-lore">💭 <em>"${def.lore}"</em></div>
            </div>

            <!-- Effect & Game Mechanics -->
            <div class="inspector-section">
                <div class="inspector-sec-label">⚙️ Schiffs-Wirkung</div>
                <div class="inspector-effect-pill">
                    <span class="effect-icon">✨</span>
                    <span class="effect-text">${def.effect}</span>
                </div>
            </div>

            <!-- Precursor Requirement -->
            ${def.precursor ? `
                <div class="inspector-section">
                    <div class="inspector-sec-label">🔗 Synapsen-Verbindung</div>
                    <div class="inspector-prec-row ${isPrecursorMet ? 'met' : 'missing'}">
                        <span>${isPrecursorMet ? '✓' : '✗'} Erfordert:</span>
                        <strong>${precName}</strong>
                    </div>
                </div>
            ` : ''}

            <!-- Costs -->
            <div class="inspector-section">
                <div class="inspector-sec-label">🧪 Synthese-Kosten</div>
                <div class="inspector-cost-grid">
                    <div class="inspector-cost-card bio ${STATE.bioRes >= effBioCost ? 'afford' : 'lacking'}">
                        <span class="cost-type">🌿 Biomasse</span>
                        <span class="cost-amount">${effBioCost} Bio</span>
                        <span class="cost-status">${STATE.bioRes >= effBioCost ? '✓ Genügend' : `-${Math.ceil(bioDeficit)} fehlt`}</span>
                    </div>
                    <div class="inspector-cost-card silicon ${STATE.siliconRes >= effSilCost ? 'afford' : 'lacking'}">
                        <span class="cost-type">💠 Silizium</span>
                        <span class="cost-amount">${effSilCost} Silizium</span>
                        <span class="cost-status">${STATE.siliconRes >= effSilCost ? '✓ Genügend' : `-${Math.ceil(silDeficit)} fehlt`}</span>
                    </div>
                    ${effTechCost > 0 ? `
                    <div class="inspector-cost-card tech ${(STATE.techRes || 0) >= effTechCost ? 'afford' : 'lacking'}">
                        <span class="cost-type">🔬 Technologie</span>
                        <span class="cost-amount">${effTechCost} Tech</span>
                        <span class="cost-status">${(STATE.techRes || 0) >= effTechCost ? '✓ Genügend' : `-${Math.ceil(techDeficit)} fehlt`}</span>
                    </div>` : ''}
                </div>
            </div>
        </div>

        <!-- Action / Mutation Trigger Button -->
        <div class="inspector-footer">
            <button id="synapse-buy-trigger-btn" class="mut-btn synapse-inspect-buy-btn ${isPurchased ? 'purchased' : ''}" data-mutation="${def.key}" ${(!canMutate && !isPurchased) || isPurchased ? 'disabled' : ''}>
                ${isPurchased ? '✓ Bereits assimiliert' : (!isPrecursorMet ? '🔒 Voraussetzung erforderlich' : (canAfford ? '🧬 Organ mutieren' : '⚠️ Ressourcen unzureichend'))}
            </button>
        </div>
    `;

    const buyBtn = document.getElementById('synapse-buy-trigger-btn');
    if (buyBtn && !isPurchased && isPrecursorMet && canAfford) {
        buyBtn.onclick = () => {
            buyMutation(def.key);
            playSynapseEvolveSound();
            triggerSynapseShockwave(def.x, def.y, def.branchColor, 90);
            updateEvolutionTreeUI();
        };
    }
}
