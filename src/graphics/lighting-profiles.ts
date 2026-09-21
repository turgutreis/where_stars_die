import * as THREE from 'three';

export interface ColorGradingProfile {
    name: string;
    exposure: number;
    contrast: number;
    saturation: number;
    colorFilter: THREE.Color;    // Highlights & midtone tint
    shadowTint: THREE.Color;     // Deep shadow chromatic lift
    vignette: number;            // Outer screen lens falloff
    ambientColor: number;        // Ambient cosmic starlight color
    ambientIntensity: number;    // Ambient cosmic starlight intensity
    starLightMultiplier: number; // Star directional intensity scale
    bloomThreshold: number;      // Selective bloom luminance threshold
    bloomStrength: number;       // Bloom halo intensity
}

export const LIGHTING_PROFILES: Record<string, ColorGradingProfile> = {
    'Yellow Sun': {
        name: 'Sol-Klasse (G-Typ)',
        exposure: 1.05,
        contrast: 1.08,
        saturation: 1.06,
        colorFilter: new THREE.Color(0xfff8e8), // Warm golden starlight
        shadowTint: new THREE.Color(0x090f1e),  // Deep cosmic indigo
        vignette: 0.22,
        ambientColor: 0x182436,
        ambientIntensity: 0.12,
        starLightMultiplier: 1.0,
        bloomThreshold: 0.88,
        bloomStrength: 0.55
    },
    'Blue Giant': {
        name: 'Blauer Riese (O/B-Typ)',
        exposure: 1.12,
        contrast: 1.22,
        saturation: 1.15,
        colorFilter: new THREE.Color(0xd0e8ff), // Piercing ice-blue / ultraviolet
        shadowTint: new THREE.Color(0x040a1c),  // Midnight ultramarine
        vignette: 0.28,
        ambientColor: 0x121e36,
        ambientIntensity: 0.14,
        starLightMultiplier: 1.25,
        bloomThreshold: 0.82,
        bloomStrength: 0.72
    },
    'Red Dwarf': {
        name: 'Roter Zwerg / Riese (M-Typ)',
        exposure: 0.98,
        contrast: 1.15,
        saturation: 0.92,
        colorFilter: new THREE.Color(0xffb888), // Deep amber & copper glow
        shadowTint: new THREE.Color(0x1a0a0c),  // Burgundy / charcoal shadows
        vignette: 0.32,
        ambientColor: 0x221416,
        ambientIntensity: 0.10,
        starLightMultiplier: 0.85,
        bloomThreshold: 0.85,
        bloomStrength: 0.62
    },
    'White Dwarf': {
        name: 'Weißer Zwerg (D-Typ)',
        exposure: 1.08,
        contrast: 1.25,
        saturation: 0.98,
        colorFilter: new THREE.Color(0xf4f9ff), // Pure surgical silver / stark white
        shadowTint: new THREE.Color(0x060c14),  // Pure cold void
        vignette: 0.24,
        ambientColor: 0x141c28,
        ambientIntensity: 0.11,
        starLightMultiplier: 1.1,
        bloomThreshold: 0.90,
        bloomStrength: 0.48
    },
    'Black Hole': {
        name: 'Schwarzes Loch (Singularität)',
        exposure: 0.92,
        contrast: 1.35,
        saturation: 0.80,
        colorFilter: new THREE.Color(0xd8b4fe), // Eerie violet & accretion gold
        shadowTint: new THREE.Color(0x100420),  // Bottomless abyss purple
        vignette: 0.48,                         // Pronounced gravitational lens falloff
        ambientColor: 0x10081c,
        ambientIntensity: 0.08,
        starLightMultiplier: 0.75,
        bloomThreshold: 0.78,
        bloomStrength: 0.85
    },
    'Pulsar': {
        name: 'Neutronenstern / Pulsar',
        exposure: 1.15,
        contrast: 1.28,
        saturation: 1.18,
        colorFilter: new THREE.Color(0xa5f3fc), // High-frequency cyan-magenta
        shadowTint: new THREE.Color(0x0e0524),
        vignette: 0.35,
        ambientColor: 0x160c2c,
        ambientIntensity: 0.12,
        starLightMultiplier: 1.3,
        bloomThreshold: 0.75,
        bloomStrength: 0.95
    },
    'Dark Energy Rift': {
        name: 'Dunkle-Energie-Riss',
        exposure: 0.90,
        contrast: 1.30,
        saturation: 0.75,
        colorFilter: new THREE.Color(0xc084fc),
        shadowTint: new THREE.Color(0x0b0214),
        vignette: 0.42,
        ambientColor: 0x120620,
        ambientIntensity: 0.08,
        starLightMultiplier: 0.8,
        bloomThreshold: 0.80,
        bloomStrength: 0.78
    },
    'Flare Star': {
        name: 'Flare-Stern (Eruptiv)',
        exposure: 1.08,
        contrast: 1.18,
        saturation: 1.08,
        colorFilter: new THREE.Color(0xfdba74),
        shadowTint: new THREE.Color(0x180c06),
        vignette: 0.28,
        ambientColor: 0x20140c,
        ambientIntensity: 0.11,
        starLightMultiplier: 1.15,
        bloomThreshold: 0.82,
        bloomStrength: 0.75
    }
};

/**
 * Resolves the appropriate lighting profile based on star type and anomaly.
 */
export function getLightingProfileForSystem(starType?: string, anomalyType?: string): ColorGradingProfile {
    if (anomalyType === 'pulsar') return LIGHTING_PROFILES['Pulsar'];
    if (anomalyType === 'dark_energy_rift') return LIGHTING_PROFILES['Dark Energy Rift'];
    if (anomalyType === 'flare_star') return LIGHTING_PROFILES['Flare Star'];
    if (anomalyType === 'supermassive_black_hole') return LIGHTING_PROFILES['Black Hole'];

    if (starType && LIGHTING_PROFILES[starType]) {
        return LIGHTING_PROFILES[starType];
    }

    return LIGHTING_PROFILES['Yellow Sun'];
}
