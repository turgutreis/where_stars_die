import * as THREE from 'three';
import { PlanetArchetypeData, MoonArchetypeData } from '../types/game';

// Texture Cache to prevent duplicate GPU memory allocations
const textureCache = new Map<string, THREE.Texture>();
let textureLoader: THREE.TextureLoader | null = null;

export function getTextureLoader(): THREE.TextureLoader {
    if (!textureLoader) {
        textureLoader = new THREE.TextureLoader();
    }
    return textureLoader;
}

export function loadPlanetTexture(path: string, sRGB = true): THREE.Texture {
    if (textureCache.has(path)) {
        return textureCache.get(path)!;
    }
    const loader = getTextureLoader();
    const texture = loader.load(path);
    if (sRGB && (THREE as any).SRGBColorSpace) {
        texture.colorSpace = (THREE as any).SRGBColorSpace;
    }
    textureCache.set(path, texture);
    return texture;
}

// Planetary Archetype Templates based on authentic NASA/ESA high-resolution photography
export const PLANET_ARCHETYPE_TEMPLATES = {
    SUN: 'assets/textures/planets/8k_sun.jpg',
    MERCURY: 'assets/textures/planets/8k_mercury.jpg',
    VENUS_SURFACE: 'assets/textures/planets/8k_venus_surface.jpg',
    VENUS_ATMOSPHERE: 'assets/textures/planets/4k_venus_atmosphere.jpg',
    EARTH_DAY: 'assets/textures/planets/8k_earth_daymap.jpg',
    EARTH_NIGHT: 'assets/textures/planets/8k_earth_nightmap.jpg',
    EARTH_CLOUDS: 'assets/textures/planets/8k_earth_clouds.jpg',
    EARTH_NORMAL: 'assets/textures/planets/8k_earth_normal_map.png',
    EARTH_SPECULAR: 'assets/textures/planets/8k_earth_specular_map.png',
    MOON: 'assets/textures/planets/8k_moon.jpg',
    MARS: 'assets/textures/planets/8k_mars.jpg',
    MARS_PHOBOS: 'assets/textures/planets/mars_phobos.jpg',
    MARS_DEIMOS: 'assets/textures/planets/mars_deimos.jpg',
    JUPITER: 'assets/textures/planets/8k_jupiter.jpg',
    JUPITER_IO: 'assets/textures/planets/jupiter_io.jpg',
    JUPITER_EUROPA: 'assets/textures/planets/jupiter_europa.jpg',
    JUPITER_GANYMEDE: 'assets/textures/planets/jupiter_ganymede.jpg',
    JUPITER_CALLISTO: 'assets/textures/planets/jupiter_callisto.jpg',
    SATURN: 'assets/textures/planets/8k_saturn.jpg',
    SATURN_RINGS: 'assets/textures/planets/8k_saturn_ring_alpha.png',
    SATURN_TITAN: 'assets/textures/planets/saturn_titan.jpg',
    URANUS: 'assets/textures/planets/2k_uranus.jpg',
    NEPTUNE: 'assets/textures/planets/2k_neptune.jpg'
};

export interface BodyTemplateData {
    map: string;
    cloudMap?: string;
    nightMap?: string;
    normalMap?: string;
    roughnessMap?: string;
    ringMap?: string;
}

/**
 * Returns the best high-resolution real texture template for any procedural planet type and seed.
 * Serves as the blueprint/Schablone for procedurally tinted or QPU-synthesized worlds across the galaxy.
 */
export function getTemplateForBody(type: string, seed: number): BodyTemplateData {
    const s = Math.abs(seed);
    switch (type) {
        case 'Habitable':
            return {
                map: PLANET_ARCHETYPE_TEMPLATES.EARTH_DAY,
                cloudMap: PLANET_ARCHETYPE_TEMPLATES.EARTH_CLOUDS,
                nightMap: PLANET_ARCHETYPE_TEMPLATES.EARTH_NIGHT,
                normalMap: PLANET_ARCHETYPE_TEMPLATES.EARTH_NORMAL,
                roughnessMap: PLANET_ARCHETYPE_TEMPLATES.EARTH_SPECULAR
            };
        case 'Gas Giant':
            return {
                map: (s % 2 === 0) ? PLANET_ARCHETYPE_TEMPLATES.JUPITER : PLANET_ARCHETYPE_TEMPLATES.SATURN,
                ringMap: (s % 3 === 0) ? PLANET_ARCHETYPE_TEMPLATES.SATURN_RINGS : undefined
            };
        case 'Ice':
        case 'Eismond':
            return {
                map: (s % 3 === 0) ? PLANET_ARCHETYPE_TEMPLATES.URANUS : ((s % 3 === 1) ? PLANET_ARCHETYPE_TEMPLATES.NEPTUNE : PLANET_ARCHETYPE_TEMPLATES.JUPITER_EUROPA)
            };
        case 'Vulkanmond':
            return {
                map: PLANET_ARCHETYPE_TEMPLATES.JUPITER_IO
            };
        case 'Desert':
            return {
                map: PLANET_ARCHETYPE_TEMPLATES.MARS
            };
        case 'Kratermond':
            return {
                map: (s % 3 === 0) ? PLANET_ARCHETYPE_TEMPLATES.MOON : ((s % 3 === 1) ? PLANET_ARCHETYPE_TEMPLATES.MARS_PHOBOS : PLANET_ARCHETYPE_TEMPLATES.JUPITER_CALLISTO)
            };
        case 'Rocky':
        default: {
            const pick = s % 4;
            if (pick === 0) return { map: PLANET_ARCHETYPE_TEMPLATES.MARS };
            if (pick === 1) return { map: PLANET_ARCHETYPE_TEMPLATES.MERCURY };
            if (pick === 2) return { map: PLANET_ARCHETYPE_TEMPLATES.VENUS_SURFACE };
            return { map: PLANET_ARCHETYPE_TEMPLATES.MOON };
        }
    }
}

/**
 * Resolves an explicit templateId directly to authentic asset textures.
 */
export function getTemplateById(templateId: string): BodyTemplateData | null {
    switch (templateId.toLowerCase()) {
        case 'earth':
            return {
                map: PLANET_ARCHETYPE_TEMPLATES.EARTH_DAY,
                cloudMap: PLANET_ARCHETYPE_TEMPLATES.EARTH_CLOUDS,
                nightMap: PLANET_ARCHETYPE_TEMPLATES.EARTH_NIGHT,
                normalMap: PLANET_ARCHETYPE_TEMPLATES.EARTH_NORMAL,
                roughnessMap: PLANET_ARCHETYPE_TEMPLATES.EARTH_SPECULAR
            };
        case 'jupiter':
            return { map: PLANET_ARCHETYPE_TEMPLATES.JUPITER };
        case 'saturn':
            return { map: PLANET_ARCHETYPE_TEMPLATES.SATURN, ringMap: PLANET_ARCHETYPE_TEMPLATES.SATURN_RINGS };
        case 'mars':
            return { map: PLANET_ARCHETYPE_TEMPLATES.MARS };
        case 'mercury':
            return { map: PLANET_ARCHETYPE_TEMPLATES.MERCURY };
        case 'venus_surface':
        case 'venus':
            return { map: PLANET_ARCHETYPE_TEMPLATES.VENUS_SURFACE, cloudMap: PLANET_ARCHETYPE_TEMPLATES.VENUS_ATMOSPHERE };
        case 'uranus':
            return { map: PLANET_ARCHETYPE_TEMPLATES.URANUS };
        case 'neptune':
            return { map: PLANET_ARCHETYPE_TEMPLATES.NEPTUNE };
        case 'moon':
            return { map: PLANET_ARCHETYPE_TEMPLATES.MOON };
        case 'jupiter_io':
        case 'io':
            return { map: PLANET_ARCHETYPE_TEMPLATES.JUPITER_IO };
        case 'jupiter_europa':
        case 'europa':
            return { map: PLANET_ARCHETYPE_TEMPLATES.JUPITER_EUROPA };
        case 'jupiter_ganymede':
        case 'ganymede':
            return { map: PLANET_ARCHETYPE_TEMPLATES.JUPITER_GANYMEDE };
        case 'jupiter_callisto':
        case 'callisto':
            return { map: PLANET_ARCHETYPE_TEMPLATES.JUPITER_CALLISTO };
        case 'mars_phobos':
        case 'phobos':
            return { map: PLANET_ARCHETYPE_TEMPLATES.MARS_PHOBOS };
        case 'mars_deimos':
        case 'deimos':
            return { map: PLANET_ARCHETYPE_TEMPLATES.MARS_DEIMOS };
        case 'saturn_titan':
        case 'titan':
            return { map: PLANET_ARCHETYPE_TEMPLATES.SATURN_TITAN };
        default:
            return null;
    }
}

/**
 * Resolves the archetype blueprint template for a celestial body.
 * Prioritizes QPU-assigned templateId, falling back smoothly to procedural type & seed.
 */
export function resolveArchetypeTemplate(
    archetype?: PlanetArchetypeData | MoonArchetypeData,
    fallbackType: string = 'Rocky',
    seed: number = 0
): BodyTemplateData {
    if (archetype && archetype.templateId) {
        const found = getTemplateById(archetype.templateId);
        if (found) {
            const copy = { ...found };
            const pArch = archetype as PlanetArchetypeData;
            if (pArch.ringTexture) {
                copy.ringMap = pArch.ringTexture.startsWith('assets/') ? pArch.ringTexture : `assets/textures/planets/${pArch.ringTexture}`;
            }
            return copy;
        }
    }
    return getTemplateForBody(fallbackType, seed);
}
