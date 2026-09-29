import { STATE } from '../core/state';
import { StarSystem, UniverseData, JumpTelemetry, JumpResolution, JumpStability, JumpHazard } from '../types/game';

/**
 * Returns the baseline safe harmonic warp range in light-years.
 * Safe jumps within this perimeter always have 100% precision.
 */
export function getEffectiveSafeWarpRange(): number {
    return STATE.warpRange || 90;
}

/**
 * Returns the maximum extended psionic horizon in light-years.
 * Beyond this threshold, space-time curvature exceeds mental comprehension.
 */
export function getEffectiveMaxWarpRange(): number {
    const safe = getEffectiveSafeWarpRange();
    return Math.round(safe * 2.15);
}

/**
 * Calculates warp jump precision, resource requirements, and stability profile
 * between two star systems based on distance and Najmafar's mental/psionic capabilities.
 */
export function calculateJumpPrecision(fromSys: StarSystem, targetSys: StarSystem): JumpTelemetry {
    const dx = targetSys.x - fromSys.x;
    const dz = targetSys.z - fromSys.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const safeRange = getEffectiveSafeWarpRange();
    const maxRange = getEffectiveMaxWarpRange();
    const inSafeRange = dist <= safeRange;
    const canReach = dist <= maxRange;

    const costMult = STATE.mutations.folddrive && STATE.mutations.folddrive.purchased ? 0.7 : 1.0;

    if (inSafeRange) {
        const bioCost = Math.round((15 + dist * 0.15) * costMult);
        return {
            dist: Number(dist.toFixed(1)),
            safeRange,
            maxRange,
            inSafeRange: true,
            canReach: true,
            precision: 100,
            bioCost,
            mentalCost: 0,
            overreachLY: 0,
            stability: 'stable',
            telepathyBonus: 0,
            mentalClarityBonus: 0,
            mutationBonus: 0
        };
    }

    const overreachLY = dist - safeRange;

    if (!canReach) {
        const bioCost = Math.round((15 + dist * 0.15) * costMult);
        return {
            dist: Number(dist.toFixed(1)),
            safeRange,
            maxRange,
            inSafeRange: false,
            canReach: false,
            precision: 0,
            bioCost,
            mentalCost: 40,
            overreachLY: Number(overreachLY.toFixed(1)),
            stability: 'unreachable',
            telepathyBonus: 0,
            mentalClarityBonus: 0,
            mutationBonus: 0
        };
    }

    // Normalized overreach ratio from 0.0 to 1.0
    const k = Math.min(1.0, Math.max(0.0, overreachLY / Math.max(1, maxRange - safeRange)));

    // Non-linear base precision drop (starts at ~95% and drops to ~32% at maximum reach)
    let basePrec = 100.0 - Math.pow(k, 1.2) * 68.0;

    // 1. Crew Telepathy / Psionic Resonance Bonus
    let telepathyBonus = 0;
    const psioBonusVal = STATE.crewBuffs ? (STATE.crewBuffs.psionicBonus || 0) : 0;
    telepathyBonus += Math.min(15, Math.round(psioBonusVal * 0.12));

    if (STATE.crew && STATE.crew.length > 0) {
        const telepaths = STATE.crew.filter(c => 
            c.role === 'psychologist' || 
            c.trait?.type === 'psionic' || 
            c.station === 'dream_weaver'
        );
        telepathyBonus += Math.min(10, telepaths.length * 3);
    }
    telepathyBonus = Math.min(20, telepathyBonus);

    // 2. Mental Clarity Bonus / Neural Fatigue Penalty
    let mentalClarityBonus = 0;
    const maxMental = Math.max(1, STATE.maxMentalEnergy || 100);
    const mentalRatio = (STATE.mentalEnergy || 0) / maxMental;
    if (mentalRatio >= 0.80) {
        mentalClarityBonus = 10;
    } else if (mentalRatio >= 0.50) {
        mentalClarityBonus = 5;
    } else if (mentalRatio < 0.25) {
        mentalClarityBonus = -15; // Neural fatigue destabilizes fold
    }

    // 3. Synaptic Mutation Bonuses
    let mutationBonus = 0;
    if (STATE.mutations) {
        if (STATE.mutations.psionic_pulse?.purchased || STATE.mutations.synapses?.purchased) {
            mutationBonus += 10;
        }
        if (STATE.mutations.telepathic_focus?.purchased || STATE.mutations.translator?.purchased) {
            mutationBonus += 5;
        }
        if (STATE.mutations.ibad?.purchased) {
            mutationBonus += 15; // Arrakis Melange prophetic foresight
        }
    }

    // Calculated final precision (overreach always maintains at least 1% risk and 8% floor)
    const rawPrecision = basePrec + telepathyBonus + mentalClarityBonus + mutationBonus;
    const finalPrecision = Math.round(Math.max(8, Math.min(99, rawPrecision)));

    // Increased Bio-Energy and Mental Energy toll for folding space beyond natural capacity
    const extraBioEnergy = Math.pow(k, 1.35) * 32.0;
    const bioCost = Math.round((15 + dist * 0.15 + extraBioEnergy) * costMult);
    const mentalCost = Math.round(12 + k * 28.0);

    const stability: JumpStability = finalPrecision >= 75 ? 'moderate' : 'critical';

    return {
        dist: Number(dist.toFixed(1)),
        safeRange,
        maxRange,
        inSafeRange: false,
        canReach: true,
        precision: finalPrecision,
        bioCost,
        mentalCost,
        overreachLY: Number(overreachLY.toFixed(1)),
        stability,
        telepathyBonus,
        mentalClarityBonus,
        mutationBonus
    };
}

/**
 * Searches for neighbor star systems around the target system that could attract
 * Najmafar's collapsing spacetime fold during a misfold event.
 */
export function findDriftCandidateSystems(
    targetSys: StarSystem,
    originSys: StarSystem,
    universe: UniverseData | null
): StarSystem[] {
    if (!universe || !universe.systems) return [];

    return universe.systems
        .filter(s => s.id !== targetSys.id && s.id !== originSys.id)
        .map(s => {
            const dx = s.x - targetSys.x;
            const dz = s.z - targetSys.z;
            const distToTarget = Math.sqrt(dx * dx + dz * dz);
            return { system: s, distToTarget };
        })
        .filter(item => item.distToTarget <= 85.0) // Within gravitational attraction sphere
        .sort((a, b) => a.distToTarget - b.distToTarget)
        .map(item => item.system);
}

/**
 * Resolves a warp jump attempt based on telemetry precision and dice roll.
 * Handles successful arrivals, neighbor gravitational drifts, and dangerous perihelion/asteroid dropouts.
 */
export function resolveJumpOutcome(
    telemetry: JumpTelemetry,
    targetSys: StarSystem,
    originSys: StarSystem,
    universe: UniverseData | null,
    forceRoll?: number
): JumpResolution {
    const roll = forceRoll !== undefined ? forceRoll : Math.random() * 100.0;

    // Successful fold: 100% precision hit on intended target
    if (roll <= telemetry.precision) {
        return {
            success: true,
            targetSystem: targetSys,
            originSystem: originSys,
            actualSystem: targetSys,
            isDrift: false,
            driftSystem: null,
            hazardType: 'none',
            arrivalDistance: 150.0,
            message: `Raumzeit-Faltung stabil: Zielsystem ${targetSys.name} präzise erreicht.`,
            roll: Number(roll.toFixed(1))
        };
    }

    // Instability / Misfold occurred!
    const candidates = findDriftCandidateSystems(targetSys, originSys, universe);

    // 50% chance of gravitational deflection into an adjacent star system if candidates exist
    const isDrift = candidates.length > 0 && ((Math.floor(roll) % 2) === 0);

    if (isDrift) {
        const driftSys = candidates[0];
        // 35% chance that the drift also causes a severe corona dropout
        const isCorona = (Math.floor(roll) % 3) === 0;
        const hazardType: JumpHazard = isCorona ? 'solar_corona' : 'none';
        const arrivalDistance = isCorona ? 34.0 : 150.0;

        const hazardMsg = isCorona
            ? ` Notfall-Perihel-Dropout nahe der Korona!`
            : ` Stabilisierung am Außenrand gelungen.`;

        return {
            success: false,
            targetSystem: targetSys,
            originSystem: originSys,
            actualSystem: driftSys,
            isDrift: true,
            driftSystem: driftSys,
            hazardType,
            arrivalDistance,
            message: `⚠️ PSIONISCHE ABWEICHUNG: Attraktion von ${driftSys.name} hat das kollabierende Faltungsfeld abgelenkt!${hazardMsg}`,
            roll: Number(roll.toFixed(1))
        };
    }

    // In-System Misfold: Arrives in target system but dangerously close (Solar Corona or Asteroid Belt)
    const isCorona = (Math.floor(roll) % 2) === 0;
    const hazardType: JumpHazard = isCorona ? 'solar_corona' : 'asteroid_belt';
    const arrivalDistance = isCorona ? 34.0 : 76.0;

    const message = isCorona
        ? `🔥 PERIHEL-DROPOUT: Faltungsfeld kollabiert direkt vor der glühenden Sonnenkorona von ${targetSys.name}! Extreme Strahlung!`
        : `💥 WARP-FEHLKOLLAPS: Austritt inmitten eines dichten Asteroidengürtels von ${targetSys.name}! Kollisionsalarm!`;

    return {
        success: false,
        targetSystem: targetSys,
        originSystem: originSys,
        actualSystem: targetSys,
        isDrift: false,
        driftSystem: null,
        hazardType,
        arrivalDistance,
        message,
        roll: Number(roll.toFixed(1))
    };
}
