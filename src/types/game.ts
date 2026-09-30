import * as THREE from 'three';

export type PlanetType = 'Habitable' | 'Gas Giant' | 'Rocky' | 'Desert' | 'Oceanic' | 'Volcanic' | 'Ice' | 'Vorläufer-Konstrukt' | 'Gefangener Stern' | 'Plasma-Wirbel' | 'Trümmerfeld' | 'Gezeiten-Trümmerfeld' | 'Toter Kern' | string;
export type MoonType = 'Eismond' | 'Vulkanmond' | 'Kratermond' | 'Gesteinsmond';
export type TechLevel = 'Primitive' | 'Industrial' | 'Spacefaring' | 'Hyper-Advanced';
export type FactionId = 'vega_collective' | 'olyndar_psion' | 'xenomilitary_ash' | 'free_traders' | 'aethelgard_guardians';

export interface FactionData {
    id: FactionId;
    name: string;
    shortName: string;
    emblem: string;
    color: string;
    colorCss: string;
    doctrine: string;
    description: string;
    specialTrait: string;
    baseDisposition: 'Pacifist' | 'Defensive' | 'Militaristic';
}

export interface QuantumWalkEra {
    eraName: string;
    event: string;
    paradoxDetail: string;
    culturalShift: string;
}

export interface QuantumCivState {
    qubitStateVector: number[];
    entanglementIndex: number;
    societalArchetype: string;
    paradoxFactor: number;
    historyEras: QuantumWalkEra[];
    factionId: FactionId;
    worshipsPlayer: boolean;
    quantumTechLevel: TechLevel;
    psionicAffinityScore: number;
    militaryDoctrine: 'Pacifist' | 'Defensive' | 'Militaristic' | 'Fanatic Zealot';
    quantumCollapseLog: string;
}

export interface StarData {
    name?: string;
    type: string;
    color: string;
    size: number;
    mass: number;
    colorCss?: string;
    texture?: string;
}

export type SpeciesLifespanCategory = 'ephemeral' | 'mortal' | 'longlived' | 'ancient';
export type SpeciesDisposition = 'martial' | 'scholarly' | 'empathic' | 'lithoid' | 'synthetic';

export type OrganStationId = 'flight_synapse' | 'chitin_gland' | 'bio_incubator' | 'dream_core';

export interface OrganStationData {
    id: OrganStationId;
    name: string;
    subtitle: string;
    icon: string;
    optimalRoles: string[];
    optimalDispositions: string[];
    description: string;
    assignedCount: number;
    efficiency: number;
    activitySummary: string;
}

export interface CrewMember {
    id: number;
    name: string;
    species: string;
    speciesArchetypeName?: string;
    speciesType?: SpeciesLifespanCategory;
    disposition?: SpeciesDisposition;
    clusterId?: string;
    role: 'pilot' | 'biologist' | 'engineer' | 'psychologist' | 'cryptologist' | string;
    roleName: string;
    roleIcon?: string;
    buffDesc: string;
    perk?: string;
    stress: number;
    baseStressRate: number;
    illusionStability: number;
    status: string;
    thought: string;

    // Lifespan & Biological Aging System
    age: number; // Elapsed lifespan in seconds
    maxLifespan: number; // Max lifespan in seconds
    ageCategory?: 'vital' | 'mature' | 'senescent' | 'critical';
    rejuvenationCount?: number;

    // Party-Grid & Ship-Interior Empathy
    trait?: {
        name: string;
        desc: string;
        type: 'bio' | 'stress' | 'speed' | 'repair' | 'psionic' | 'quirk';
    };
    station?: OrganStationId;
    stationName?: string;
    stationActivity?: string;
    avatarIcon?: string;
    criticalAlertTriggered?: boolean;
    speciesColor?: string;
}

export interface SpeciesData {
    hasSentient: boolean;
    name: string;
    population: number;
    candidates: CrewMember[];
    techLevel?: TechLevel;
    defenseRating?: number;
    fleetDisposition?: 'Pacifist' | 'Defensive' | 'Militaristic';
    factionId?: FactionId;
    quantumCiv?: QuantumCivState | null;
}

export interface PlanetAttributes {
    atmos: string;
    temp: string;
    bio: string;
    res: string;
    species: SpeciesData | null;
    tidalLock?: boolean;
    magnetosphere?: 'None' | 'Weak' | 'Strong' | 'Hyper-Magnetic';
    geothermal?: 'Dead' | 'Dormant' | 'Active Geysers' | 'Hyper-Volcanic';
    radiationLevel?: 'Low' | 'Moderate' | 'High' | 'Extreme';
    entangledTwinId?: string | null;
    quantumResonance?: number;
}

export interface MoonArchetypeData {
    templateId: string;
    normalScale?: number;
    roughnessScale?: number;
    craterDensity?: 'low' | 'medium' | 'high' | 'extreme';
    cryoVolcanism?: boolean;
    lavaCalderas?: boolean;
}

export interface PlanetArchetypeData {
    templateId: string;
    cloudCoverage?: number;
    normalScale?: number;
    roughnessScale?: number;
    atmosphereDensity?: number;
    oceanCoverage?: number;
    atmosphericTurbulence?: number;
    dustStormFrequency?: number;
    hasRings?: boolean;
    ringTexture?: string;
    hasNightLights?: boolean;
    subsurfaceOcean?: boolean;
    craterDensity?: 'low' | 'medium' | 'high' | 'extreme';
    cryoVolcanism?: boolean;
}

export interface MoonData {
    name: string;
    type: MoonType;
    size: number;
    distance: number;
    speed: number;
    color: string;
    texture?: string;
    archetype?: MoonArchetypeData;
    temp: string;
    atmos: string;
    bio: string;
    res: string;
    tidalLock?: boolean;
    geothermal?: 'Dead' | 'Dormant' | 'Active Geysers' | 'Hyper-Volcanic' | string;
    parentPlanetName?: string;
}

export interface PlanetData {
    name: string;
    type: PlanetType;
    distance: number;
    size: number;
    color: string;
    texture?: string;
    cloudTexture?: string;
    nightTexture?: string;
    normalTexture?: string;
    specularTexture?: string;
    atmoTexture?: string;
    ringTexture?: string;
    archetype?: PlanetArchetypeData;
    atmos?: string;
    temp?: string;
    bio?: string;
    res?: string;
    species?: SpeciesData | null;
    moons?: MoonData[];
    tidalLock?: boolean;
    magnetosphere?: 'None' | 'Weak' | 'Strong' | 'Hyper-Magnetic';
    geothermal?: 'Dead' | 'Dormant' | 'Active Geysers' | 'Hyper-Volcanic';
    radiationLevel?: 'Low' | 'Moderate' | 'High' | 'Extreme';
    entangledTwinId?: string | null;
    quantumResonance?: number;
}

export type SectorId = 'sector_outer_rim' | 'sector_mid_rim' | 'sector_core';

export interface SectorInfo {
    id: SectorId;
    name: string;
    description: string;
    act: 1 | 2 | 3;
    minRadius: number;
    maxRadius: number;
    color: string;
    hazardLevel: 'Low' | 'Moderate' | 'High' | 'Extreme';
}

export interface StarSystem {
    id: number;
    name: string;
    x: number;
    z: number;
    sectorId?: SectorId | string;
    sectorName?: string;
    anomalyType?: 'none' | 'flare_star' | 'dark_energy_rift' | 'pulsar' | 'ancient_beacon' | 'supermassive_black_hole' | string;
    isCoreAnchor?: boolean;
    star: StarData;
    planets: PlanetData[];
    asteroids?: any[];
    isDeepVoid?: boolean;
}

export interface UniverseMetadata {
    generator: string;
    generatorMode: 'IBM_QPU' | 'LOCAL_SIMULATOR' | 'PSEUDO_MOCK' | string;
    backendName: string;
    jobId?: string | null;
    shots: number;
    qubits: number;
    generatedAt: string;
    systemCount: number;
    sectors: string[];
}

export interface UniverseData {
    name?: string;
    meta?: UniverseMetadata;
    systems: StarSystem[];
}

export interface GravitySource {
    mesh: THREE.Object3D;
    type: 'planet' | 'asteroid' | 'star' | 'ship_wreck';
    name: string;
    mass: number;
    radius: number;
    gravityRange: number;
    position: THREE.Vector3;
    isResource?: boolean;
    resourceType?: 'bio' | 'energy' | 'silicon';
    isAbsorbed?: boolean;
    rotSpeed?: { x: number; y: number; z: number };
    ringMesh?: THREE.Mesh | null;
}

export interface PlanetEntry {
    mesh: THREE.Group;
    bodyMesh: THREE.Mesh;
    cloudMesh?: THREE.Mesh | null;
    psioAuraMesh?: THREE.Mesh | null;
    auroraMesh?: THREE.Mesh | null;
    source: GravitySource;
    ringMesh?: THREE.Mesh | null;
    angle: number;
    speed: number;
    distance: number;
    baseDistance?: number;
    name: string;
    type: PlanetType | MoonType | string;
    size: number;
    color: string;
    colorCss: string;
    isMoon: boolean;
    parentPlanet?: PlanetEntry | null;
    scanned: boolean;
    depleted?: boolean;
    harvested?: boolean;
    attributes: PlanetAttributes;
}

export type FleetShipType = 'interceptor' | 'corvette' | 'freighter' | 'heavy_freighter';
export type FleetShipState = 'patrol' | 'intercept' | 'hunt' | 'trade_cruise' | 'trade_docked' | 'flee' | 'disabled' | 'stunned' | 'returning';

export interface SpaceStation {
    id: number;
    name: string;
    factionId?: FactionId | string;
    civilizationName?: string;
    factionName?: string;
    mesh: THREE.Group;
    bodyMesh: THREE.Mesh;
    ringMesh?: THREE.Mesh | null;
    position: THREE.Vector3;
    parentPlanet?: PlanetEntry | null;
    orbitRadius: number;
    orbitAngle: number;
    orbitSpeed: number;
    rotationSpeed: number;
    health: number;
    maxHealth: number;
    defenseRating: number;
    alertLevel: 'peace' | 'alert' | 'hunt';
    alertTimer: number;
    type: 'citadel' | 'trade_hub' | 'mining_relay';
    scanned?: boolean;
    population?: number;
    commanderName?: string;
    commanderRole?: string;
    crewMembers?: CrewMember[];
    description?: string;
}

export interface FleetShip {
    id: number;
    mesh: THREE.Group;
    bodyMesh: THREE.Mesh;
    trailMesh?: THREE.Line | null;
    type: FleetShipType;
    name: string;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    homePlanet: PlanetEntry;
    orbitRadius: number;
    orbitAngle: number;
    orbitSpeed: number;
    health: number;
    maxHealth: number;
    state: FleetShipState;
    stunTimer?: number;
    stunMaxDuration?: number;
    sparkTimer?: number;
    originalColor?: number;
    attackCooldown: number;
    alertTimer: number;
    cargo?: { type: 'silicon' | 'bio' | 'alloys'; amount: number };
    tradeTargetPlanet?: PlanetEntry | null;
    tradeTargetStation?: SpaceStation | null;
    tradeProgress?: number;
    tradeDirection?: 1 | -1;
    dockTimer?: number;
    factionId?: FactionId | string;
    civilizationName?: string;
    factionName?: string;
    scanned?: boolean;
    crewMembers?: CrewMember[];
    commanderName?: string;
    commanderRole?: string;
    commanderThought?: string;
}

export interface FleetProjectile {
    mesh: THREE.Mesh;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    damage: number;
    type: 'laser' | 'emp';
}

export interface MutationItem {
    purchased: boolean;
    bioCost: number;
    siliconCost: number;
    name?: string;
    desc?: string;
}

export type PrimaryParadigm = 'neutral' | 'domination' | 'deception' | 'symbiosis';
export type SubCodex =
    | 'none'                // Keine Sub-Doktrin vor Erstkontakt
    | 'iron_discipline'     // Gewalt + Gewalt: Brutale Unterdrückung, max Kampf-Bonus
    | 'gunboat_diplomacy'   // Gewalt + Diplomatie: Krieger respektieren Stärke, moderate Kosten
    | 'nightmare_terror'    // Gewalt + Täuschung: Horror-Matrix, lähmende Angst
    | 'benevolent_facade'   // Täuschung + Diplomatie: Falsche Utopie, glückliche Gefangene
    | 'illusory_matrix'     // Täuschung + Täuschung: Perfekte Schein-Welt, hoher Stealth
    | 'living_symbiosis'    // Harmonie + Harmonie: Organische Einheit, starke Bio-Regeneration
    | 'pragmatic_accord';   // Harmonie + Diplomatie: Nüchterne Partnerschaft

export interface ParadigmModifiers {
    mentalDrainMult: number;
    stressModifier: number;
    thrustBonus: number;
    stealthBonus: number;
    bioRegenBonus: number;
    harmonyBonus: number;
}

export interface SpeciesCluster {
    speciesName: string;
    speciesColor: string;
    avatarIcon: string;
    disposition: SpeciesDisposition;
    count: number;
    members: CrewMember[];
    avgAgePercent: number;
    avgStress: number;
    avgStability: number;
    dominantRole: string;
    isExpanded?: boolean;
}

export interface CrewBuffs {
    thrust: number;
    bioGain: number;
    scanSpeed: number;
    repairRate: number;
    stressDampening: number;
    psionicBonus: number;
}

export interface DoctrineTransition {
    active: boolean;
    fromParadigm: PrimaryParadigm;
    targetParadigm: PrimaryParadigm;
    progress: number; // 0.0 to 1.0
    duration: number; // in seconds
}

export interface GameState {
    // Player Stats
    health: number;
    maxHealth: number;
    bioEnergy: number;
    maxBioEnergy: number;
    mentalEnergy: number;
    maxMentalEnergy: number;
    telepathyActive: boolean;
    gameStarted: boolean;
    isGameOver: boolean;
    systemsVisited: number;
    visitedSystemIds: number[];

    // Evolution Resources
    bioRes: number;
    siliconRes: number;

    // Sensor & Travel Limits
    psionicRange: number;
    warpRange: number;

    // Crew Management & Synergies
    maxCrewCapacity: number;
    crewSatietyTimer: number;
    crewDialogueTimer: number;
    crewBuffs: CrewBuffs;

    // Paradigms & Triad Doctrine System
    primaryParadigm: PrimaryParadigm;
    activeSubCodex: SubCodex;
    paradigmModifiers: ParadigmModifiers;
    doctrineTransition?: DoctrineTransition;

    // Mutations
    mutations: {
        nucleus?: MutationItem;
        organic_siphon?: MutationItem;
        chitin_armor?: MutationItem;
        vector_tentacles?: MutationItem;
        blade_armor?: MutationItem;
        cocoon: MutationItem;
        hivemind: MutationItem;
        neural_cluster: MutationItem;
        cryo_matrix: MutationItem;
        hive_cerebrum: MutationItem;
        telepathic_focus?: MutationItem;
        psionic_pulse?: MutationItem;
        chimera_veil?: MutationItem;
        resonance_screech?: MutationItem;
        armor: MutationItem;
        o2: MutationItem;
        synapses: MutationItem;
        folddrive: MutationItem;
        translator: MutationItem;
        ibad?: MutationItem;
    };
    radiationResistance?: number;
    ambientRadiation?: number;
    effectiveRadiation?: number;
    radiationSource?: string;

    // Physics
    playerPosition: THREE.Vector3;
    playerVelocity: THREE.Vector3;
    playerAcceleration: THREE.Vector3;
    thrustStrength: number;
    retroThrustStrength: number;
    turnSpeed: number;
    shipHeading: number;
    shipAngularVelocity: number;
    flightAssist: boolean;
    isThrusting?: boolean;
    isRetroBraking?: boolean;
    shipSpeed: number;
    progradeVector: THREE.Vector3;
    drag: number;
    brakeDrag: number;
    currentDrag: number;
    gConstant: number;
    collisionCooldown: number;
    keys: {
        w: boolean;
        s: boolean;
        a: boolean;
        d: boolean;
        Space: boolean;
        x: boolean;
    };

    // Quantum Universe
    universe: UniverseData | null;
    currentSystemId: number;

    // Scanner, Harvesting & Abduction
    nearestPlanet: PlanetEntry | null;
    lockedTarget: PlanetEntry | null;
    scanningPlanet: PlanetEntry | null;
    scanProgress: number;
    scannedPlanets: Record<string, boolean>;
    depletedPlanets: Record<string, boolean>;

    extractingPlanet: PlanetEntry | null;
    harvestProgress: number;

    abductActive: boolean;
    abductTarget: PlanetEntry | null;
    abductProgress: number;

    // Crew & Psych
    crew: CrewMember[];
    loneliness: number;

    // Active Simulation
    gravitySources: GravitySource[];
    asteroids: GravitySource[];
    playerGroup: THREE.Group | null;

    // Spacefaring Fleet System (Phase B)
    fleetShips: FleetShip[];
    fleetProjectiles: FleetProjectile[];
    bioDischargeCooldown: number;
    empCharging?: boolean;
    empChargeTimer?: number;

    // Faction Reputation & Diplomacy (Phase C/D)
    reputation: Record<FactionId, number>;
    activeDiplomacyPlanet: PlanetEntry | null;

    cameraHeight?: number;
    targetCameraHeight?: number;
    cameraLookTarget?: THREE.Vector3;
    isInPlanetOrbit?: boolean;
    orbitPlanet?: PlanetEntry | null;
    orbitZoomFactor?: number;
    orbitLevel?: OrbitLevel;
    activeMoonOrbit?: PlanetEntry | null;
    orbitTransitionProgress?: number;

    // Interstellar Arrival & Warp-Dropout System
    systemArrivalActive?: boolean;
    systemArrivalTimer?: number;
    systemArrivalMaxTime?: number;
    systemArrivalDirection?: THREE.Vector3;
    incomingJumpGate?: any | null;

    // Interstellar Departure (Spooling & Fold Punch)
    systemDepartureActive?: boolean;
    systemDepartureTimer?: number;
    systemDepartureMaxTime?: number;
    systemDepartureDirection?: THREE.Vector3;
    systemDepartureTarget?: StarSystem | null;
    systemDepartureOrigin?: StarSystem | null;
    systemDepartureResolution?: JumpResolution | null;

    // Voyager 2 & First-Time User Experience (FTUE)
    voyagerProbe?: any | null;
    voyagerSignalDetected?: boolean;
    voyagerScanned?: boolean;
    voyagerDialogSeen?: boolean;
    ftueStep?: number;
    ftueCompleted?: boolean;

    // Space Stations & Psionic Stealth System
    spaceStations: SpaceStation[];
    stealthActive: boolean;
    stealthDrainRate: number;
    systemAlertLevel: 'peace' | 'alert' | 'hunt';
    systemAlertTimer: number;
}

export type OrbitLevel = 'solar' | 'planet' | 'moon';

export type JumpStability = 'stable' | 'moderate' | 'critical' | 'unreachable';
export type JumpHazard = 'none' | 'solar_corona' | 'asteroid_belt' | 'deep_void';

export interface JumpTelemetry {
    dist: number;
    safeRange: number;
    maxRange: number;
    inSafeRange: boolean;
    canReach: boolean;
    precision: number; // 0 - 100 percentage
    bioCost: number;
    mentalCost: number;
    overreachLY: number;
    stability: JumpStability;
    telepathyBonus: number;
    mentalClarityBonus: number;
    mutationBonus: number;
}

export interface JumpResolution {
    success: boolean;
    targetSystem: StarSystem;
    originSystem: StarSystem;
    actualSystem: StarSystem;
    isDrift: boolean;
    driftSystem?: StarSystem | null;
    isVoid?: boolean;
    hazardType: JumpHazard;
    arrivalDistance: number;
    message: string;
    roll: number;
}
