import * as THREE from 'three';
import { GameState, PlanetEntry } from '../types/game';

export const STATE: GameState = {
    // Player Stats
    health: 100,
    maxHealth: 100,
    bioEnergy: 100,
    maxBioEnergy: 100,
    mentalEnergy: 100,
    maxMentalEnergy: 100,
    telepathyActive: false,
    gameStarted: false,
    isGameOver: false,
    systemsVisited: 1,
    visitedSystemIds: [1],

    // Evolution Resources
    bioRes: 0,
    siliconRes: 0,

    // Sensor & Travel Limits
    psionicRange: 75,
    warpRange: 90,

    // Crew Management & Synergies
    maxCrewCapacity: 4,
    crewSatietyTimer: 0,
    crewDialogueTimer: 15,
    crewBuffs: {
        thrust: 1.0,
        bioGain: 1.0,
        scanSpeed: 1.0,
        repairRate: 0,
        stressDampening: 1.0,
        psionicBonus: 0
    },

    // Paradigms & Triad Doctrine System
    primaryParadigm: 'deception',
    activeSubCodex: 'benevolent_facade',
    paradigmModifiers: {
        mentalDrainMult: 1.0,
        stressModifier: 0.0,
        thrustBonus: 0.0,
        stealthBonus: 0.20,
        bioRegenBonus: 0.0,
        harmonyBonus: 0.10
    },

    // Mutations
    mutations: {
        armor: { purchased: false, bioCost: 180, siliconCost: 110 },
        o2: { purchased: false, bioCost: 140, siliconCost: 60 },
        synapses: { purchased: false, bioCost: 260, siliconCost: 160 },
        cocoon: { purchased: true, bioCost: 320, siliconCost: 140, name: "Neuronales Kokon-Gewebe", desc: "Basis-Kokons für 4 Gefangene." },
        hivemind: { purchased: false, bioCost: 500, siliconCost: 320, name: "Symbiotische Synapsen-Kammer", desc: "Max 6 Crew & +20% auf alle Spezialisten-Buffs" },
        neural_cluster: { purchased: false, bioCost: 650, siliconCost: 450, name: "Neuronale Waben-Kammer", desc: "Erweitert Crew-Kapazität auf 10 & dämpft Dissonanz" },
        cryo_matrix: { purchased: false, bioCost: 950, siliconCost: 750, name: "Bio-Kryo-Kaverne", desc: "Erweitert Crew-Kapazität auf 20 & verlangsamt Zelltod um 25%" },
        hive_cerebrum: { purchased: false, bioCost: 1500, siliconCost: 1200, name: "Schwarm-Zerebrum", desc: "Max 30 Crew • Schaltet Schwarm-Resonanz frei" },
        folddrive: { purchased: false, bioCost: 380, siliconCost: 420 },
        translator: { purchased: false, bioCost: 120, siliconCost: 80 },
        ibad: { 
            purchased: false, 
            bioCost: 0, 
            siliconCost: 0,
            name: "Augen des Ibad (Melange-Erleuchtung)",
            desc: "Blau-in-blau gefärbte Sklera durch Melange-Sättigung. Schaltet prophetische Weitsicht (Prescience) frei und harmonisiert neuronale Instabilitäten (Heilung von Psychosen & Geisteskrankheiten)."
        }
    },

    // Physics & Newtonian Space Flight Dynamics
    playerPosition: new THREE.Vector3(0, 0, 95),
    playerVelocity: new THREE.Vector3(2.0, 0, 0),
    playerAcceleration: new THREE.Vector3(0, 0, 0),
    thrustStrength: 16.5,
    retroThrustStrength: 14.0,
    turnSpeed: 2.85,
    shipHeading: 0.0,
    shipAngularVelocity: 0.0,
    flightAssist: true,
    isThrusting: false,
    isRetroBraking: false,
    shipSpeed: 2.0,
    progradeVector: new THREE.Vector3(1, 0, 0),
    drag: 0.005,
    brakeDrag: 1.2,
    currentDrag: 0.005,
    gConstant: 15.0,
    collisionCooldown: 0,
    keys: {
        w: false,
        s: false,
        a: false,
        d: false,
        Space: false,
        x: false
    },

    // Quantum Universe
    universe: null,
    currentSystemId: 1, // Start in Perseus-Rand (Outer Rim)

    // Scanner, Harvesting & Abduction System
    nearestPlanet: null,
    lockedTarget: null,
    scanningPlanet: null,
    scanProgress: 0,
    scannedPlanets: {},

    extractingPlanet: null,
    harvestProgress: 0,
    depletedPlanets: {} as Record<string, boolean>,

    abductActive: false,
    abductTarget: null,
    abductProgress: 0,

    // Crew & Psych
    crew: [],
    loneliness: 80,

    // Active Simulation
    gravitySources: [],
    asteroids: [],
    playerGroup: null,

    // Spacefaring Fleet System (Phase B)
    fleetShips: [],
    fleetProjectiles: [],
    bioDischargeCooldown: 0,
    empCharging: false,
    empChargeTimer: 0,

    // Faction Reputation & Diplomacy
    reputation: {
        vega_collective: 0,
        olyndar_psion: 15,
        xenomilitary_ash: -10,
        free_traders: 0,
        aethelgard_guardians: 5
    },
    activeDiplomacyPlanet: null,
    cameraHeight: 70,
    targetCameraHeight: 70,
    cameraLookTarget: new THREE.Vector3(0, 0, 0),
    isInPlanetOrbit: false,
    orbitPlanet: null,
    orbitZoomFactor: 0.0,
    orbitLevel: 'solar',
    activeMoonOrbit: null,
    orbitTransitionProgress: 0.0,

    // Interstellar Arrival & Warp-Dropout System
    systemArrivalActive: false,
    systemArrivalTimer: 0.0,
    systemArrivalMaxTime: 2.2,
    systemArrivalDirection: new THREE.Vector3(0, 0, 0),
    incomingJumpGate: null,

    // Interstellar Departure (Spooling & Fold Punch)
    systemDepartureActive: false,
    systemDepartureTimer: 0.0,
    systemDepartureMaxTime: 1.6,
    systemDepartureDirection: new THREE.Vector3(1, 0, 0),
    systemDepartureTarget: null,

    // Voyager 2 & First-Time User Experience (FTUE)
    voyagerProbe: null,
    voyagerSignalDetected: false,
    voyagerScanned: false,
    voyagerDialogSeen: false,
    ftueStep: 0,
    ftueCompleted: false
};

export const activePlanets: PlanetEntry[] = [];
