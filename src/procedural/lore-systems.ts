export function getLoreSolSystem(): any {
    return {
        id: 2,
        name: "Sol (Heimat der Menschheit)",
        x: -140.0,
        z: 150.0,
        sectorId: "sector_mid_rim",
        sectorName: "Orion-Zyklus (Zivilisations-Gürtel)",
        anomalyType: "none",
        isCoreAnchor: false,
        star: {
            name: "Sonne (Sol)",
            type: "Yellow Sun",
            color: "0xfacc15",
            size: 6.2,
            mass: 280,
            texture: "assets/textures/planets/8k_sun.jpg"
        },
        planets: [
            {
                name: "Merkur",
                type: "Rocky",
                size: 1.6,
                distance: 18.0,
                color: "0x78716c",
                texture: "assets/textures/planets/8k_mercury.jpg",
                temp: "+430°C / -180°C",
                atmos: "Extrem dünne Exosphäre (Vakuum)",
                bio: "Steril",
                res: "Eisen, Silizium & Schwermetalle",
                species: null,
                moons: [],
                tidalLock: true,
                magnetosphere: "Weak",
                geothermal: "Dead",
                radiationLevel: "High",
                entangledTwinId: null,
                quantumResonance: 0.0
            },
            {
                name: "Venus",
                type: "Rocky",
                size: 2.8,
                distance: 28.0,
                color: "0xf59e0b",
                texture: "assets/textures/planets/8k_venus_surface.jpg",
                atmoTexture: "assets/textures/planets/4k_venus_atmosphere.jpg",
                temp: "+465°C",
                atmos: "Superdichtes CO2 & Schwefelsäure-Wolken",
                bio: "Steril (Extremer Treibhauseffekt)",
                res: "Schwefel-Verbindungen & Basaltgestein",
                species: null,
                moons: [],
                tidalLock: false,
                magnetosphere: "None",
                geothermal: "Hyper-Volcanic",
                radiationLevel: "Moderate",
                entangledTwinId: null,
                quantumResonance: 0.0
            },
            {
                name: "Erde (Terra)",
                type: "Habitable",
                size: 3.0,
                distance: 42.0,
                color: "0x0ea5e9",
                texture: "assets/textures/planets/8k_earth_daymap.jpg",
                cloudTexture: "assets/textures/planets/8k_earth_clouds.jpg",
                nightTexture: "assets/textures/planets/8k_earth_nightmap.jpg",
                normalTexture: "assets/textures/planets/8k_earth_normal_map.png",
                specularTexture: "assets/textures/planets/8k_earth_specular_map.png",
                temp: "15°C",
                atmos: "Stickstoff & Sauerstoff (N2/O2 - Atembar)",
                bio: "Reiche Biosphäre der Menschheit (Ursprungswelt)",
                res: "Wasser, Biomasse & Voyager-Gedächtnis",
                species: {
                    hasSentient: true,
                    name: "Menschheit (Homo Sapiens)",
                    population: 8000000000,
                    techLevel: "Spacefaring",
                    defenseRating: 55,
                    fleetDisposition: "Defensive",
                    candidates: [
                        {
                            name: "Dr. Carl Sagan (Gedächtnis-Echo)",
                            species: "Mensch",
                            speciesType: "human",
                            role: "cryptologist",
                            roleName: "🔭 Kosmischer Astronom & Botschafter",
                            buffDesc: "+50% Psionische Sensor-Klarheit & Paläo-Astronomie",
                            baseStressRate: 0.08,
                            age: 42,
                            maxLifespan: 3600,
                            ageCategory: "mature",
                            rejuvenationCount: 0
                        },
                        {
                            name: "Kommandantin Elena Rostova",
                            species: "Mensch",
                            speciesType: "human",
                            role: "pilot",
                            roleName: "🚀 Sternenflotten-Navigatorin",
                            buffDesc: "+35% Antriebs-Effizienz & Trägheits-Dämpfung",
                            baseStressRate: 0.09,
                            age: 34,
                            maxLifespan: 3600,
                            ageCategory: "vital",
                            rejuvenationCount: 0
                        }
                    ]
                },
                moons: [
                    {
                        name: "Luna (Der Mond)",
                        type: "Kratermond",
                        size: 0.9,
                        distance: 6.8,
                        speed: 1.2,
                        color: "0xcbcfd6",
                        texture: "assets/textures/planets/8k_moon.jpg",
                        temp: "-130°C / +120°C",
                        atmos: "Vakuum",
                        bio: "Steril",
                        res: "Regolith-Gestein, Titan & Helium-3",
                        tidalLock: true,
                        geothermal: "Dead",
                        parentPlanetName: "Erde (Terra)"
                    }
                ],
                tidalLock: false,
                magnetosphere: "Strong",
                geothermal: "Dormant",
                radiationLevel: "Low",
                entangledTwinId: null,
                quantumResonance: 0.0
            },
            {
                name: "Mars",
                type: "Rocky",
                size: 2.2,
                distance: 58.0,
                color: "0xef4444",
                texture: "assets/textures/planets/8k_mars.jpg",
                temp: "-60°C",
                atmos: "Dünnes Kohlendioxid (Roter Planet)",
                bio: "Fossile mikrobielle Biosignaturen",
                res: "Eisenoxid-Sand & gefrorenes Wassereis",
                species: null,
                moons: [
                    {
                        name: "Phobos",
                        type: "Kratermond",
                        size: 0.5,
                        distance: 4.2,
                        speed: 1.8,
                        color: "0x78716c",
                        texture: "assets/textures/planets/mars_phobos.jpg",
                        temp: "-40°C",
                        atmos: "Vakuum",
                        bio: "Steril",
                        res: "Kohlenstoffhaltiges Chondrit-Gestein",
                        tidalLock: true,
                        geothermal: "Dead",
                        parentPlanetName: "Mars"
                    },
                    {
                        name: "Deimos",
                        type: "Kratermond",
                        size: 0.4,
                        distance: 6.5,
                        speed: 1.3,
                        color: "0x78716c",
                        texture: "assets/textures/planets/mars_deimos.jpg",
                        temp: "-40°C",
                        atmos: "Vakuum",
                        bio: "Steril",
                        res: "Regolith-Staub & Silikate",
                        tidalLock: true,
                        geothermal: "Dead",
                        parentPlanetName: "Mars"
                    }
                ],
                tidalLock: false,
                magnetosphere: "None",
                geothermal: "Dormant",
                radiationLevel: "Moderate",
                entangledTwinId: null,
                quantumResonance: 0.0
            },
            {
                name: "Jupiter",
                type: "Gas Giant",
                size: 7.2,
                distance: 84.0,
                color: "0xf97316",
                texture: "assets/textures/planets/8k_jupiter.jpg",
                temp: "-110°C",
                atmos: "Wasserstoff & Helium (Großer Roter Fleck)",
                bio: "Atmosphärische Bio-Spuren",
                res: "Superdichtes Deuterium & Magneto-Plasma",
                species: null,
                moons: [
                    {
                        name: "Io",
                        type: "Vulkanmond",
                        size: 1.0,
                        distance: 11.2,
                        speed: 1.5,
                        color: "0xf97316",
                        texture: "assets/textures/planets/jupiter_io.jpg",
                        temp: "+150°C",
                        atmos: "Schwefeldioxid-Ausgasungen",
                        bio: "Schwefel-Mikroben",
                        res: "Geschmolzenes Titan & Schwefel",
                        tidalLock: true,
                        geothermal: "Hyper-Volcanic",
                        parentPlanetName: "Jupiter"
                    },
                    {
                        name: "Europa",
                        type: "Eismond",
                        size: 0.95,
                        distance: 13.8,
                        speed: 1.3,
                        color: "0x38bdf8",
                        texture: "assets/textures/planets/jupiter_europa.jpg",
                        temp: "-160°C",
                        atmos: "Wasserdampf-Geysire",
                        bio: "Subozeanische Extremophile",
                        res: "Flüssiges Wasser & Deuterium-Eis",
                        tidalLock: true,
                        geothermal: "Active Geysers",
                        parentPlanetName: "Jupiter"
                    },
                    {
                        name: "Ganymed",
                        type: "Eismond",
                        size: 1.25,
                        distance: 16.5,
                        speed: 1.1,
                        color: "0x94a3b8",
                        texture: "assets/textures/planets/jupiter_ganymede.jpg",
                        temp: "-150°C",
                        atmos: "Dünne Sauerstoff-Exosphäre",
                        bio: "Kryophile Bakterien",
                        res: "Silikatgestein & Wassereis",
                        tidalLock: true,
                        geothermal: "Dormant",
                        parentPlanetName: "Jupiter"
                    },
                    {
                        name: "Kallisto",
                        type: "Kratermond",
                        size: 1.15,
                        distance: 19.5,
                        speed: 0.9,
                        color: "0x64748b",
                        texture: "assets/textures/planets/jupiter_callisto.jpg",
                        temp: "-140°C",
                        atmos: "CO2-Spuren",
                        bio: "Steril",
                        res: "Eis-Gesteins-Gemisch",
                        tidalLock: true,
                        geothermal: "Dead",
                        parentPlanetName: "Jupiter"
                    }
                ],
                tidalLock: false,
                magnetosphere: "Hyper-Magnetic",
                geothermal: "Dead",
                radiationLevel: "Extreme",
                entangledTwinId: null,
                quantumResonance: 0.0
            },
            {
                name: "Saturn",
                type: "Gas Giant",
                size: 6.2,
                distance: 110.0,
                color: "0xeab308",
                texture: "assets/textures/planets/8k_saturn.jpg",
                ringTexture: "assets/textures/planets/8k_saturn_ring_alpha.png",
                temp: "-140°C",
                atmos: "Wasserstoff & Ammoniak-Eiskristalle",
                bio: "Steril",
                res: "Flüssiges Methan & Ring-Eis",
                species: null,
                moons: [
                    {
                        name: "Titan",
                        type: "Eismond",
                        size: 1.2,
                        distance: 12.5,
                        speed: 1.2,
                        color: "0xf59e0b",
                        texture: "assets/textures/planets/saturn_titan.jpg",
                        temp: "-179°C",
                        atmos: "Dichter Stickstoff & flüssiges Methan",
                        bio: "Methanogene Präbiotik",
                        res: "Kohlenwasserstoffe & flüssiges Ethan",
                        tidalLock: true,
                        geothermal: "Active Geysers",
                        parentPlanetName: "Saturn"
                    },
                    {
                        name: "Enceladus",
                        type: "Eismond",
                        size: 0.7,
                        distance: 15.2,
                        speed: 1.4,
                        color: "0xe0f2fe",
                        texture: "assets/textures/planets/jupiter_europa.jpg",
                        temp: "-198°C",
                        atmos: "Kryovulkanische Geysir-Fontänen",
                        bio: "Hydrothermale Mikroorganismen",
                        res: "Subglaziales Meerwasser & Silikate",
                        tidalLock: true,
                        geothermal: "Active Geysers",
                        parentPlanetName: "Saturn"
                    }
                ],
                tidalLock: false,
                magnetosphere: "Strong",
                geothermal: "Dead",
                radiationLevel: "Moderate",
                entangledTwinId: null,
                quantumResonance: 0.0
            },
            {
                name: "Uranus",
                type: "Ice",
                size: 4.4,
                distance: 136.0,
                color: "0x38bdf8",
                texture: "assets/textures/planets/2k_uranus.jpg",
                temp: "-215°C",
                atmos: "Methan, Wasserstoff & Helium",
                bio: "Steril",
                res: "Ammoniak-Eis & Diamant-Schichten",
                species: null,
                moons: [
                    {
                        name: "Miranda",
                        type: "Kratermond",
                        size: 0.65,
                        distance: 8.5,
                        speed: 1.4,
                        color: "0xa5f3fc",
                        texture: "assets/textures/planets/8k_moon.jpg",
                        temp: "-210°C",
                        atmos: "Vakuum",
                        bio: "Steril",
                        res: "Verwerfungs-Eis & Gestein",
                        tidalLock: true,
                        geothermal: "Dead",
                        parentPlanetName: "Uranus"
                    }
                ],
                tidalLock: false,
                magnetosphere: "Weak",
                geothermal: "Dead",
                radiationLevel: "Low",
                entangledTwinId: null,
                quantumResonance: 0.0
            },
            {
                name: "Neptun",
                type: "Ice",
                size: 4.3,
                distance: 162.0,
                color: "0x0284c7",
                texture: "assets/textures/planets/2k_neptune.jpg",
                temp: "-220°C",
                atmos: "Dynamisches Methan-Plasma (Überschall-Stürme)",
                bio: "Steril",
                res: "Gefrorenes Wasser, Methan & Ammoniak",
                species: null,
                moons: [
                    {
                        name: "Triton",
                        type: "Eismond",
                        size: 0.95,
                        distance: 9.2,
                        speed: 1.3,
                        color: "0x38bdf8",
                        texture: "assets/textures/planets/jupiter_europa.jpg",
                        temp: "-235°C",
                        atmos: "Stickstoff-Geysire",
                        bio: "Kryophile Bakterien",
                        res: "Gefrorener Stickstoff & Wassereis",
                        tidalLock: true,
                        geothermal: "Active Geysers",
                        parentPlanetName: "Neptun"
                    }
                ],
                tidalLock: false,
                magnetosphere: "Weak",
                geothermal: "Dead",
                radiationLevel: "Low",
                entangledTwinId: null,
                quantumResonance: 0.0
            },
            {
                name: "Pluto",
                type: "Ice",
                size: 1.5,
                distance: 188.0,
                color: "0x94a3b8",
                texture: "assets/textures/planets/8k_mercury.jpg",
                temp: "-230°C",
                atmos: "Dünner Stickstoffdampf (Sublimation)",
                bio: "Steril",
                res: "Methan-Eis, Stickstoff & Tholine",
                species: null,
                moons: [
                    {
                        name: "Charon",
                        type: "Eismond",
                        size: 0.8,
                        distance: 5.0,
                        speed: 1.1,
                        color: "0xcbcfd6",
                        texture: "assets/textures/planets/8k_moon.jpg",
                        temp: "-230°C",
                        atmos: "Vakuum",
                        bio: "Steril",
                        res: "Ammoniak-Hydrate & Wassereis",
                        tidalLock: true,
                        geothermal: "Dead",
                        parentPlanetName: "Pluto"
                    }
                ],
                tidalLock: true,
                magnetosphere: "None",
                geothermal: "Dormant",
                radiationLevel: "Low",
                entangledTwinId: null,
                quantumResonance: 0.0
            }
        ],
        asteroids: Array.from({ length: 16 }, (_, i) => {
            const dist = 68.0 + (i * 0.9);
            const angle = i * (Math.PI / 8);
            return {
                x: +(dist * Math.cos(angle)).toFixed(2),
                z: +(dist * Math.sin(angle)).toFixed(2),
                type: i % 2 === 0 ? "energy" : "bio"
            };
        })
    };
}

export function getLoreArrakisSystem(): any {
    return {
        id: 3,
        name: "Canopus (Arrakis-System)",
        x: -85.0,
        z: 195.0,
        sectorId: "sector_mid_rim",
        sectorName: "Orion-Zyklus (Zivilisations-Gürtel)",
        anomalyType: "ancient_beacon",
        isCoreAnchor: false,
        star: {
            type: "Yellow Sun",
            color: "0xfef08a",
            size: 7.5,
            mass: 360
        },
        planets: [
            {
                name: "Arrakis (Dune)",
                type: "Rocky",
                size: 3.4,
                distance: 48.0,
                color: "0xd97706",
                temp: "+58°C (Glühende Wüste)",
                atmos: "Stickstoff-Sauerstoff mit feinstem Gewürz-Staub (Melange)",
                bio: "Sandwürmer (Shai-Hulud) & Wüstenflora",
                res: "✨ Melange (Das Gewürz), Silizium-Wüstenglas & Feuchtigkeit",
                species: {
                    hasSentient: true,
                    name: "Fremen (Die Wüstenkrieger von Arrakis)",
                    population: 15000000,
                    techLevel: "Spacefaring",
                    defenseRating: 85,
                    fleetDisposition: "Militaristic",
                    candidates: [
                        {
                            name: "Naib Stilgar (Sietch Tabr)",
                            species: "Fremen",
                            speciesType: "fremen",
                            role: "commander",
                            roleName: "🗡️ Wüsten-Naib & Shai-Hulud-Reiter",
                            buffDesc: "+70 Kampfbereitschaft & Geistes-Harmonisierung (Prescience)",
                            baseStressRate: 0.04,
                            age: 45,
                            maxLifespan: 3600,
                            ageCategory: "mature",
                            rejuvenationCount: 0
                        },
                        {
                            name: "Chani (Fedajin)",
                            species: "Fremen",
                            speciesType: "fremen",
                            role: "cryptologist",
                            roleName: "👁️ Sayyadina & Seherin der Wüste",
                            buffDesc: "+85 Psionische Weitsicht & Heilung von Seelenqualen",
                            baseStressRate: 0.03,
                            age: 28,
                            maxLifespan: 3600,
                            ageCategory: "vital",
                            rejuvenationCount: 0
                        },
                        {
                            name: "Liet Kynes (Planetologe)",
                            species: "Fremen",
                            speciesType: "fremen",
                            role: "engineer",
                            roleName: "🌿 Meister-Ökologe & Gewürz-Forscher",
                            buffDesc: "+60% Siphon-Gewinn & Melange-Raffination",
                            baseStressRate: 0.05,
                            age: 49,
                            maxLifespan: 3600,
                            ageCategory: "mature",
                            rejuvenationCount: 0
                        }
                    ]
                },
                moons: [
                    {
                        name: "Krelln (Erster Wüstenmond)",
                        type: "Kratermond",
                        size: 0.85,
                        distance: 7.5,
                        speed: 1.3,
                        color: "0xb45309",
                        temp: "+30°C / -90°C",
                        atmos: "Vakuum",
                        bio: "Steril",
                        res: "Wüstenglas-Regolith & Titan",
                        tidalLock: true,
                        geothermal: "Dead",
                        parentPlanetName: "Arrakis (Dune)"
                    },
                    {
                        name: "Arvorn (Maus-Mond Muad'Dib)",
                        type: "Kratermond",
                        size: 0.65,
                        distance: 11.2,
                        speed: 1.0,
                        color: "0x78716c",
                        temp: "-110°C",
                        atmos: "Vakuum",
                        bio: "Steril",
                        res: "Silizium-Chondrit",
                        tidalLock: true,
                        geothermal: "Dead",
                        parentPlanetName: "Arrakis (Dune)"
                    }
                ],
                tidalLock: false,
                magnetosphere: "Weak",
                geothermal: "Active Geysers",
                radiationLevel: "Moderate",
                entangledTwinId: null,
                quantumResonance: 0.0
            }
        ],
        asteroids: Array.from({ length: 16 }, (_, i) => {
            const dist = 28.0 + (i * 3.5);
            const angle = i * (Math.PI / 8);
            return {
                x: +(dist * Math.cos(angle)).toFixed(2),
                z: +(dist * Math.sin(angle)).toFixed(2),
                type: i % 2 === 0 ? "bio" : "energy"
            };
        })
    };
}

export function getLoreSolarisSystem(): any {
    return {
        id: 4,
        name: "Solaris (Doppelstern Alpha)",
        x: 240.0,
        z: -170.0,
        sectorId: "sector_outer_rim",
        sectorName: "Perseus-Rand (Das Erwachen)",
        anomalyType: "dark_energy_rift",
        isCoreAnchor: false,
        star: {
            type: "Blue Giant",
            color: "0x60a5fa",
            size: 8.0,
            mass: 420
        },
        planets: [
            {
                name: "Solaris",
                type: "Habitable",
                size: 3.8,
                distance: 52.0,
                color: "0x06b6d4",
                temp: "18°C",
                atmos: "Dichte gallertartige Aerosole & Psionische Ausdünstungen",
                bio: "Einziger planetarer Hyper-Organismus (Lebender Kolloid-Ozean)",
                res: "Psionische Kolloid-Gelatine & Neutrino-Plasmen",
                species: {
                    hasSentient: true,
                    name: "Der Ozean von Solaris (Lebende Welt)",
                    population: 1,
                    techLevel: "Hyper-Advanced",
                    defenseRating: 99,
                    fleetDisposition: "Pacifist",
                    candidates: [
                        {
                            name: "Harey (Solaris-Manifestation)",
                            species: "Neutrino-Konstrukt",
                            speciesType: "ancient",
                            role: "cryptologist",
                            roleName: "🌊 Manifestiertes Gedächtnis-Echo",
                            buffDesc: "+90 Psionische Resonanz & Traumabewältigung",
                            baseStressRate: 0.02,
                            age: 25,
                            maxLifespan: 3600,
                            ageCategory: "vital",
                            rejuvenationCount: 0
                        }
                    ]
                },
                moons: [],
                tidalLock: false,
                magnetosphere: "Hyper-Magnetic",
                geothermal: "Active Geysers",
                radiationLevel: "Moderate",
                entangledTwinId: null,
                quantumResonance: 0.0
            }
        ],
        asteroids: Array.from({ length: 12 }, (_, i) => {
            const dist = 32.0 + (i * 4.0);
            const angle = i * (Math.PI / 6);
            return {
                x: +(dist * Math.cos(angle)).toFixed(2),
                z: +(dist * Math.sin(angle)).toFixed(2),
                type: "bio"
            };
        })
    };
}

/**
 * Injects guaranteed lore systems (Sol, Arrakis, Solaris) into the galaxy
 * if they are not already present in the loaded dataset.
 */
export function ensureLoreSystems(systems: any[]): void {
    if (!systems || systems.length === 0) return;

    const hasSol = systems.some(s => s.name && s.name.startsWith("Sol"));
    if (!hasSol) {
        systems.splice(2, 0, getLoreSolSystem());
    }

    const hasArrakis = systems.some(s => s.name && s.name.includes("Arrakis"));
    if (!hasArrakis) {
        systems.splice(3, 0, getLoreArrakisSystem());
    }

    const hasSolaris = systems.some(s => s.name && s.name.startsWith("Solaris"));
    if (!hasSolaris) {
        systems.splice(4, 0, getLoreSolarisSystem());
    }
}
