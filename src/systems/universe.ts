import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene, camera } from '../engine/scene';
import { PlanetEntry, StarSystem } from '../types/game';
import { createGravityRing, createBlackHoleMesh, createPrecursorConstructMesh, createPlasmaVortexMesh, clearJumpGates, createJumpGateMesh, activeJumpGates, createVoyagerProbeMesh } from '../procedural/meshes';
import { createHabitableTextures, createGasGiantTextures, createRockyTextures, createIceMoonTextures, createVolcanicMoonTextures, createStarTexture, createCloudTexture, createCityLightsTexture } from '../procedural/textures';
import { generatePlanetAttributes, generateFallbackMoons, updateScannerUI } from './scanner';
import { initPlanetDefenseFleets, clearFleet } from './fleet';
import { addLogEntry, triggerSystemArrivalBanner } from '../ui/hud';
import { playWarpDropoutSound, playWarpSpoolSound, playWarpSnapSound, playMisfoldWarningSound } from '../engine/audio';
import { getFaction } from './factions';
import { createSunCoronaMesh } from '../procedural/sun-shader';
import { createAtmosphereMesh } from '../procedural/atmosphere-shader';
import { createPlanetaryRings } from '../procedural/planet-rings';
import { createSunRays, SunRaysController } from '../procedural/sun-rays';
import { ensureLoreSystems } from '../procedural/lore-systems';
import { loadPlanetTexture, getTemplateForBody, resolveArchetypeTemplate, PLANET_ARCHETYPE_TEMPLATES } from '../procedural/planet-textures';
import { applySystemLighting } from '../engine/postprocessing';
import { triggerAutoSave } from './save-manager';
import { JumpResolution } from '../types/game';

export const activeCoronaMeshes: THREE.Object3D[] = [];
export const activeCoronaUpdaters: ((dt: number) => void)[] = [];
export const activeStarLights: THREE.Light[] = [];
export let activeSunRays: SunRaysController | null = null;

export function updateUniverseShaders(dt: number, cam?: THREE.Camera) {
    activeCoronaUpdaters.forEach(fn => fn(dt));
    activeJumpGates.forEach(jg => jg.update(dt));
    if (STATE.voyagerProbe && STATE.voyagerProbe.update) {
        STATE.voyagerProbe.update(dt);
    }
    if (activeSunRays && cam) {
        activeSunRays.update(dt, cam);
    }
}

export async function checkUniverseData() {
    try {
        let data: any = null;

        // 1. If running in Electron, load directly from filesystem via IPC
        if (typeof (window as any).api !== 'undefined' && (window as any).api.loadUniverseData) {
            try {
                const res = await (window as any).api.loadUniverseData();
                if (res && res.success && res.data) {
                    data = res.data;
                }
            } catch (err) {
                console.warn("Najmafar: IPC universe load failed, falling back to fetch", err);
            }
        }

        // 2. Browser / Fallback fetch
        if (!data) {
            const resp = await fetch('universe_data.json');
            if (resp.ok) {
                data = await resp.json();
            }
        }

        if (data && data.systems && data.systems.length > 0) {
            ensureLoreSystems(data.systems);
            STATE.universe = data;
            const sysCount = data.systems.length;
            const meta = data.meta;

            const startBtn = document.getElementById('start-game-btn');
            if (startBtn) {
                startBtn.removeAttribute('disabled');
                startBtn.style.opacity = '1';
                startBtn.innerText = "🧬 Bewusstsein entfalten";
            }

            const status = document.getElementById('generation-status');
            const mapBadge = document.getElementById('galaxy-provenance-badge');

            if (meta) {
                const isQpu = meta.generatorMode === 'IBM_QPU';
                const label = isQpu
                    ? `🌌 IBM Quantum QPU (${meta.backendName})`
                    : `🔬 Qiskit Simulator (${meta.backendName || 'basic_simulator'})`;

                if (status) {
                    status.innerText = `Galaxie aktiv (${sysCount} Systeme) — ${label}`;
                    status.style.color = isQpu ? '#34d399' : '#38bdf8';
                }

                if (mapBadge) {
                    mapBadge.innerText = `${label} • ${sysCount} Systeme`;
                    mapBadge.style.color = isQpu ? '#34d399' : '#38bdf8';
                    mapBadge.style.borderColor = isQpu ? 'rgba(52, 211, 153, 0.4)' : 'rgba(56, 189, 248, 0.3)';
                    mapBadge.style.background = isQpu ? 'rgba(52, 211, 153, 0.15)' : 'rgba(56, 189, 248, 0.15)';
                }
            } else {
                if (status) {
                    status.innerText = `Galaxie aktiv (${sysCount} Sternensysteme).`;
                    status.style.color = '#10b981';
                }
            }

            // Spawn initial system
            clearActiveSystem();
            spawnPlanetsAndAsteroids();
        } else {
            console.warn("Najmafar: universe_data.json contains no systems");
        }
    } catch (e) {
        console.error("Najmafar: Error loading universe data:", e);
    }
}

function disposeObject3D(obj: THREE.Object3D | null | undefined) {
    if (!obj) return;
    obj.traverse((child: any) => {
        if (child.geometry && typeof child.geometry.dispose === 'function') {
            child.geometry.dispose();
        }
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach((m: any) => m && typeof m.dispose === 'function' && m.dispose());
            } else if (typeof child.material.dispose === 'function') {
                child.material.dispose();
            }
        }
    });
}

export function clearActiveSystem() {
    activePlanets.forEach(p => {
        if (p.mesh) {
            scene.remove(p.mesh);
            disposeObject3D(p.mesh);
        }
        if (p.ringMesh) {
            scene.remove(p.ringMesh);
            disposeObject3D(p.ringMesh);
        }
    });

    STATE.gravitySources.forEach(s => {
        if (s.ringMesh) {
            scene.remove(s.ringMesh);
            disposeObject3D(s.ringMesh);
        }
        if (s.mesh) {
            scene.remove(s.mesh);
            disposeObject3D(s.mesh);
        }
    });

    STATE.asteroids.forEach(a => {
        if (a.mesh) {
            scene.remove(a.mesh);
            disposeObject3D(a.mesh);
        }
    });

    activeCoronaMeshes.forEach(m => {
        scene.remove(m);
        disposeObject3D(m);
    });
    activeCoronaMeshes.length = 0;
    activeCoronaUpdaters.length = 0;

    activeStarLights.forEach(l => scene.remove(l));
    activeStarLights.length = 0;

    if (activeSunRays) {
        scene.remove(activeSunRays.group);
        activeSunRays.dispose();
        activeSunRays = null;
    }

    STATE.gravitySources = [];
    STATE.asteroids = [];
    activePlanets.length = 0;

    // Reset Target Locks, Scanners and Reticles
    STATE.lockedTarget = null;
    STATE.nearestPlanet = null;
    STATE.scanningPlanet = null;
    STATE.extractingPlanet = null;
    STATE.abductActive = false;
    STATE.abductTarget = null;
    STATE.scanProgress = 0;
    STATE.harvestProgress = 0;
    STATE.abductProgress = 0;

    clearFleet();
    clearJumpGates();

    if (STATE.voyagerProbe && STATE.voyagerProbe.mesh) {
        scene.remove(STATE.voyagerProbe.mesh);
        disposeObject3D(STATE.voyagerProbe.mesh);
        STATE.voyagerProbe = null;
    }

    const badge = document.getElementById('target-lock-badge');
    const label = document.getElementById('target-label-text');
    if (badge) badge.style.display = 'none';
    if (label) label.innerText = 'Nächster Planet:';

    updateScannerUI(null, Infinity);
}

export function spawnPlanetsAndAsteroids() {
    if (!STATE.universe || !STATE.universe.systems) {
        return;
    }

    const activeSystem = STATE.universe.systems[STATE.currentSystemId];
    if (!activeSystem) return;

    // Apply system-specific cinematic color grading and lighting profile
    const starData = activeSystem.star;
    applySystemLighting(starData?.type, activeSystem.anomalyType);

    // 1. Central Star or Supermassive Black Hole
    if (starData.type === "Black Hole") {
        const blackHole = createBlackHoleMesh(starData.size);
        scene.add(blackHole.group);
        activeCoronaMeshes.push(blackHole.group);
        activeCoronaUpdaters.push(blackHole.update);

        const bhBaseColor = new THREE.Color(0xa855f7);
        const bhLightColor = bhBaseColor.clone().lerp(new THREE.Color(0xd8b4fe), 0.35);
        const starLight = new THREE.PointLight(bhLightColor, 3.8, 0, 0.0);
        starLight.position.set(0, 2, 0);
        scene.add(starLight);
        activeStarLights.push(starLight);

        starData.colorCss = "#7c3aed";

        const starRange = 42.0;
        const starSource: any = {
            mesh: blackHole.group,
            type: 'star',
            name: `${activeSystem.name} (Ereignishorizont)`,
            mass: starData.mass * 0.5,
            radius: starData.size,
            gravityRange: starRange,
            position: new THREE.Vector3(0, 0, 0)
        };
        STATE.gravitySources.push(starSource);
        starSource.ringMesh = createGravityRing(0, 0, starRange, 0x7c3aed, 0.14);
    } else {
        let starMap: THREE.Texture;
        let starEmissiveMap: THREE.Texture | null = null;
        if (starData.texture) {
            starMap = loadPlanetTexture(starData.texture);
            starEmissiveMap = starMap;
        } else if (starData.name && starData.name.includes("Sol")) {
            starMap = loadPlanetTexture('assets/textures/planets/8k_sun.jpg');
            starEmissiveMap = starMap;
        } else {
            const starSeed = STATE.currentSystemId * 1337 + 42;
            const starTex = createStarTexture(starData.color, starSeed);
            starMap = starTex.map;
        }

        const starGeo = new THREE.SphereGeometry(starData.size, 48, 48);
        const starMat = new THREE.MeshStandardMaterial({
            map: starMap,
            emissive: parseInt(starData.color),
            emissiveMap: starEmissiveMap || null,
            emissiveIntensity: starEmissiveMap ? 1.4 : 0.9,
            roughness: 0.2,
            metalness: 0.1
        });
        const starMesh = new THREE.Mesh(starGeo, starMat);
        starMesh.position.set(0, 0, 0);
        scene.add(starMesh);

        // Animated Procedural Solar Corona Plasma Layer
        const corona = createSunCoronaMesh(starData.size, parseInt(starData.color));
        scene.add(corona.mesh);
        activeCoronaMeshes.push(corona.mesh);
        activeCoronaUpdaters.push(corona.update);

        // Volumetric Solar God-Rays, Anamorphic Lens Flare, & Diffraction Spikes
        activeSunRays = createSunRays(starData.size, parseInt(starData.color));
        scene.add(activeSunRays.group);

        // Radiant Stellar Light Source (Natural blackbody continuous spectrum blend)
        const baseStarColor = new THREE.Color(parseInt(starData.color));
        const naturalLightColor = baseStarColor.clone().lerp(new THREE.Color(0xfff7ea), 0.38);

        // PointLight centered in the star: Single unified radial sunlight source
        const starLight = new THREE.PointLight(naturalLightColor, 4.2, 0, 0.0);
        starLight.position.set(0, 2, 0);
        scene.add(starLight);
        activeStarLights.push(starLight);

        starData.colorCss = starData.color.replace("0x", "#");

        const starRange = 24.0;
        const starSource: any = {
            mesh: starMesh,
            type: 'star',
            name: `${activeSystem.name} (Zentralstern)`,
            mass: starData.mass * 0.35,
            radius: starData.size,
            gravityRange: starRange,
            position: new THREE.Vector3(0, 0, 0)
        };
        STATE.gravitySources.push(starSource);
        starSource.ringMesh = createGravityRing(0, 0, starRange, parseInt(starData.color), 0.06);
    }

    // 2. Celestial Bodies (Planets, Constructs, Vortices, Captured Stars)
    activeSystem.planets.forEach((p, idx) => {
        const scaledDist = 110.0 + (p.distance * 3.8) + (idx * 55.0);
        const angle = (idx * 1.8) + (STATE.currentSystemId * 0.5);
        const px = scaledDist * Math.cos(angle);
        const pz = scaledDist * Math.sin(angle);

        const seed = p.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + idx * 77;
        const planetGroup = new THREE.Group();
        planetGroup.position.set(px, 0, pz);

        let bodyMesh: THREE.Object3D | null = null;
        let cloudMesh: THREE.Mesh | null = null;
        let atmoMesh: THREE.Mesh | null = null;
        let psioAuraMesh: THREE.Mesh | null = null;
        let auroraMesh: THREE.Mesh | null = null;
        let ringMesh: THREE.Mesh | null = null;
        let generated: any = null;
        let finalSpecies: any = null;

        const isConstruct = p.type === 'Vorläufer-Konstrukt';
        const isPlasmaVortex = p.type === 'Plasma-Wirbel';
        const isCapturedStar = p.type === 'Gefangener Stern';
        const isHab = p.type === 'Habitable';
        const isGas = p.type === 'Gas Giant';

        if (isConstruct) {
            const construct = createPrecursorConstructMesh(p.size);
            planetGroup.add(construct.group);
            activeCoronaUpdaters.push(construct.update);
            bodyMesh = construct.group;
        } else if (isPlasmaVortex) {
            const vortex = createPlasmaVortexMesh(p.size, parseInt(p.color));
            planetGroup.add(vortex.group);
            activeCoronaUpdaters.push(vortex.update);
            bodyMesh = vortex.group;
        } else if (isCapturedStar) {
            const starGeo = new THREE.SphereGeometry(p.size, 32, 32);
            const starMat = new THREE.MeshStandardMaterial({
                color: parseInt(p.color),
                emissive: parseInt(p.color),
                emissiveIntensity: 1.2,
                roughness: 0.2
            });
            const starMesh = new THREE.Mesh(starGeo, starMat);
            planetGroup.add(starMesh);
            bodyMesh = starMesh;

            const capturedLight = new THREE.PointLight(parseInt(p.color), 1.8, 45, 1.2);
            planetGroup.add(capturedLight);
        } else {
            generated = generatePlanetAttributes(p);
            finalSpecies = p.species || generated.species;
            if (isHab && (!finalSpecies || !finalSpecies.candidates || finalSpecies.candidates.length === 0)) {
                finalSpecies = generated.species;
            }

            let diffuseMap: THREE.Texture;
            let cloudTexture: THREE.Texture | null = null;
            let cityLightsTexture: THREE.Texture | null = null;
            let normalMap: THREE.Texture | null = null;
            let roughnessMap: THREE.Texture | null = null;
            let diffuseColor: THREE.Color;

            if (p.texture) {
                // Exact authentic photographic map (e.g. Sol System)
                diffuseMap = loadPlanetTexture(p.texture);
                diffuseColor = new THREE.Color(0xffffff); // True authentic colors
                if (p.cloudTexture) {
                    cloudTexture = loadPlanetTexture(p.cloudTexture);
                }
                if (p.nightTexture) {
                    cityLightsTexture = loadPlanetTexture(p.nightTexture);
                }
                if (p.normalTexture) {
                    normalMap = loadPlanetTexture(p.normalTexture, false);
                }
                if (p.specularTexture) {
                    roughnessMap = loadPlanetTexture(p.specularTexture, false);
                }
            } else {
                // Procedural Alien World: uses real photography as structural template/Schablone!
                const template = resolveArchetypeTemplate(p.archetype, p.type, seed);
                diffuseMap = loadPlanetTexture(template.map);
                // Tint base template with unique procedural hue while protecting albedo luminance
                const rawColor = new THREE.Color(parseInt(p.color));
                const hsl = { h: 0, s: 0, l: 0 };
                rawColor.getHSL(hsl);
                if (hsl.l < 0.52) {
                    rawColor.setHSL(hsl.h, Math.min(1.0, hsl.s * 1.08), Math.max(0.56, hsl.l * 1.32));
                }
                diffuseColor = rawColor;

                const hasClouds = (p.archetype && p.archetype.cloudCoverage !== undefined)
                    ? (p.archetype.cloudCoverage > 0.05 && !!template.cloudMap)
                    : (template.cloudMap && (isHab || (seed % 3 === 0)));

                if (hasClouds && template.cloudMap) {
                    cloudTexture = loadPlanetTexture(template.cloudMap);
                }

                const hasNight = (p.archetype && p.archetype.hasNightLights !== undefined)
                    ? (p.archetype.hasNightLights && !!template.nightMap)
                    : (isHab && finalSpecies && finalSpecies.population > 0 && !!template.nightMap);

                if (hasNight && template.nightMap) {
                    cityLightsTexture = loadPlanetTexture(template.nightMap);
                }

                if (template.normalMap) {
                    normalMap = loadPlanetTexture(template.normalMap, false);
                }
                if (template.roughnessMap) {
                    roughnessMap = loadPlanetTexture(template.roughnessMap, false);
                }
            }

            const geo = new THREE.SphereGeometry(p.size, 48, 48);
            const planetRoughness = p.archetype?.roughnessScale ?? (roughnessMap ? 1.0 : (isGas ? 0.35 : 0.72));
            const matParams: THREE.MeshStandardMaterialParameters = {
                map: diffuseMap,
                color: diffuseColor,
                roughnessMap: roughnessMap || null,
                roughness: planetRoughness,
                metalness: isGas ? 0.04 : 0.08,
                emissive: cityLightsTexture ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
                emissiveMap: cityLightsTexture || null,
                emissiveIntensity: cityLightsTexture ? 1.0 : 0.0,
                transparent: false,
                depthWrite: true,
                depthTest: true
            };
            if (normalMap) {
                matParams.normalMap = normalMap;
                const nScale = p.archetype?.normalScale ?? 0.85;
                matParams.normalScale = new THREE.Vector2(nScale, nScale);
            }
            const mat = new THREE.MeshStandardMaterial(matParams);

            if (cityLightsTexture) {
                mat.customProgramCacheKey = () => 'cityLightsTerminator';
                mat.onBeforeCompile = (shader) => {
                    shader.uniforms.uStarWorldPos = { value: new THREE.Vector3(0, 0, 0) };
                    mat.userData.shader = shader;

                    shader.vertexShader = shader.vertexShader.replace(
                        '#include <common>',
                        `#include <common>
                        varying vec3 vCustomWorldPos;
                        varying vec3 vCustomWorldNorm;`
                    );
                    shader.vertexShader = shader.vertexShader.replace(
                        '#include <worldpos_vertex>',
                        `#include <worldpos_vertex>
                        vCustomWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                        vCustomWorldNorm = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);`
                    );

                    shader.fragmentShader = shader.fragmentShader.replace(
                        '#include <common>',
                        `#include <common>
                        uniform vec3 uStarWorldPos;
                        varying vec3 vCustomWorldPos;
                        varying vec3 vCustomWorldNorm;`
                    );
                    shader.fragmentShader = shader.fragmentShader.replace(
                        '#include <emissivemap_fragment>',
                        `#include <emissivemap_fragment>
                        vec3 starDir = normalize(uStarWorldPos - vCustomWorldPos);
                        float sunDot = dot(vCustomWorldNorm, starDir);
                        // Daylight suppresses city lights; dark night hemisphere fully illuminates them
                        float nightMask = smoothstep(0.08, -0.15, sunDot);
                        totalEmissiveRadiance *= nightMask;`
                    );
                };
            }

            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = true;
            mesh.receiveShadow = false;
            const axialTilt = (((seed % 17) + 12) * Math.PI) / 180;
            mesh.rotation.z = axialTilt;
            mesh.rotation.x = (((seed % 7) - 3) * Math.PI) / 180;
            planetGroup.add(mesh);
            bodyMesh = mesh;

            if (isHab || isGas || p.atmoTexture || (p.archetype && (p.archetype.atmosphereDensity ?? 0) > 0.1)) {
                const atmoHex = isHab ? 0x38bdf8 : parseInt(p.color);
                const atmoDensity = p.archetype?.atmosphereDensity ?? (isHab ? 1.25 : 1.0);
                atmoMesh = createAtmosphereMesh(p.size, atmoHex, atmoDensity);
                planetGroup.add(atmoMesh);
            }

            if (cloudTexture) {
                const cloudGeo = new THREE.SphereGeometry(p.size * 1.018, 48, 48);
                const cloudOpacity = p.archetype?.cloudCoverage !== undefined ? Math.min(0.9, p.archetype.cloudCoverage * 0.88) : 0.85;
                const cloudMat = new THREE.MeshStandardMaterial({
                    map: cloudTexture,
                    transparent: true,
                    opacity: cloudOpacity,
                    blending: THREE.NormalBlending,
                    depthWrite: false,
                    roughness: 0.9,
                    metalness: 0.0
                });
                cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
                cloudMesh.rotation.z = axialTilt;
                planetGroup.add(cloudMesh);
            }

            // Procedural Planetary Rings (Saturn-like dust and ice particle rings)
            const ringMapPath = p.ringTexture || p.archetype?.ringTexture;
            const hasRings = p.archetype?.hasRings !== undefined ? p.archetype.hasRings : (isGas || !!p.ringTexture || (seed % 6 === 0));
            if (hasRings) {
                const ringColor = isGas ? parseInt(p.color) : 0xc0c6d0;
                ringMesh = createPlanetaryRings(p.size, ringColor, seed, ringMapPath);
                planetGroup.add(ringMesh);
            }

            // Auroral Glow on Hyper-Magnetic worlds
            const isHyperMag = (p.magnetosphere === 'Hyper-Magnetic') || (generated && generated.magnetosphere === 'Hyper-Magnetic');
            if (isHyperMag) {
                const aurGeo = new THREE.RingGeometry(p.size * 1.06, p.size * 1.28, 32);
                const aurMat = new THREE.MeshBasicMaterial({
                    color: 0x38bdf8,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.42,
                    blending: THREE.AdditiveBlending
                });
                auroraMesh = new THREE.Mesh(aurGeo, aurMat);
                auroraMesh.rotation.x = Math.PI * 0.45;
                planetGroup.add(auroraMesh);
            }

            // Quantum Resonant Aura on Entangled Twin worlds
            const isEntangled = !!(p.entangledTwinId || (generated && generated.entangledTwinId));
            if (isEntangled) {
                const auraGeo = new THREE.SphereGeometry(p.size * 1.12, 24, 24);
                const auraMat = new THREE.MeshBasicMaterial({
                    color: 0xa855f7,
                    transparent: true,
                    opacity: 0.28,
                    blending: THREE.AdditiveBlending,
                    wireframe: true
                });
                psioAuraMesh = new THREE.Mesh(auraGeo, auraMat);
                planetGroup.add(psioAuraMesh);
            }
        }

        scene.add(planetGroup);

        const pMass = p.size * 4.0 * (isGas ? 1.4 : 1.0);
        const pRange = Math.max(18.0, p.size * 4.5);

        const sourceObj: any = {
            mesh: planetGroup,
            type: 'planet',
            name: p.name,
            mass: pMass,
            radius: p.size,
            gravityRange: pRange,
            position: new THREE.Vector3(px, 0, pz)
        };
        STATE.gravitySources.push(sourceObj);

        const orbitSpeed = 0.055 / Math.sqrt(scaledDist);
        const pColorCss = p.color.replace("0x", "#");

        const planetEntry: any = {
            mesh: planetGroup,
            bodyMesh: bodyMesh,
            cloudMesh: cloudMesh,
            atmoMesh: atmoMesh || null,
            psioAuraMesh: psioAuraMesh,
            auroraMesh: auroraMesh,
            source: sourceObj,
            ringMesh: ringMesh,
            angle: angle,
            speed: orbitSpeed,
            distance: scaledDist,
            name: p.name,
            type: p.type,
            size: p.size,
            color: p.color,
            colorCss: pColorCss,
            isMoon: false,
            scanned: false,
            attributes: {
                atmos: p.atmos || (generated ? generated.atmos : "Vakuum"),
                temp: p.temp || (generated ? generated.temp : "0°C"),
                bio: p.bio || (generated ? generated.bio : "Steril"),
                res: p.res || (generated ? generated.res : "Gestein"),
                species: finalSpecies || p.species || null,
                tidalLock: typeof p.tidalLock === 'boolean' ? p.tidalLock : (generated ? generated.tidalLock : (scaledDist < 160 || (p.type === 'Rocky' && seed % 4 === 0))),
                magnetosphere: p.magnetosphere || (generated ? generated.magnetosphere : (isGas ? 'Hyper-Magnetic' : (isHab ? 'Strong' : 'Weak'))),
                geothermal: p.geothermal || (generated ? generated.geothermal : (isGas ? 'Dead' : (isHab ? 'Active Geysers' : 'Dormant'))),
                radiationLevel: p.radiationLevel || (generated ? generated.radiationLevel : 'Moderate'),
                entangledTwinId: p.entangledTwinId || (generated ? generated.entangledTwinId : null),
                quantumResonance: p.quantumResonance || (generated ? generated.quantumResonance : (p.entangledTwinId ? 0.85 : 0.0))
            }
        };
        activePlanets.push(planetEntry);

        // Spawn Moons with natural, aesthetically pleasing orbital clearance around parent planet
        const moonsList = p.moons || [];
        moonsList.forEach((m: any, m_idx: number) => {
            const naturalDist = (p.size * 1.8) + 4.5 + (m_idx * 3.8);
            m.distance = naturalDist;
            m.baseDistance = naturalDist;

            const moonAngle = (m_idx * 2.2) + (idx * 0.7) + 0.5;
            const mx = px + m.distance * Math.cos(moonAngle);
            const mz = pz + m.distance * Math.sin(moonAngle);

            const mSeed = m.name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) + m_idx * 133;
            let mMap: THREE.Texture;
            let mColor: THREE.Color;
            let mEmissiveMap: THREE.Texture | null = null;
            let mEmissiveColor: THREE.Color = new THREE.Color(0x000000);
            let mEmissiveIntensity = 0.0;
            let mRoughnessMap: THREE.Texture | null = null;

            if (m.texture) {
                // Authentic photographic moon texture (e.g. Luna, Phobos, Deimos, Io, Europa, etc.)
                mMap = loadPlanetTexture(m.texture);
                mColor = new THREE.Color(0xffffff);
                if (m.type === 'Vulkanmond') {
                    mEmissiveMap = mMap;
                    mEmissiveColor = new THREE.Color(0xff5500);
                    mEmissiveIntensity = 1.0;
                }
            } else {
                // Procedural alien moon using real moon archetypes as structural template
                const mTemplate = resolveArchetypeTemplate(m.archetype, m.type, mSeed);
                mMap = loadPlanetTexture(mTemplate.map);
                const rawMColor = new THREE.Color(parseInt(m.color));
                const mHsl = { h: 0, s: 0, l: 0 };
                rawMColor.getHSL(mHsl);
                if (mHsl.l < 0.55) {
                    rawMColor.setHSL(mHsl.h, mHsl.s, Math.max(0.60, mHsl.l * 1.35));
                }
                mColor = rawMColor;
                if (m.type === 'Vulkanmond' || (m.archetype && m.archetype.lavaCalderas)) {
                    mEmissiveMap = mMap;
                    mEmissiveColor = new THREE.Color(parseInt(m.color));
                    mEmissiveIntensity = 1.0;
                }
            }
            mRoughnessMap = mMap;

            const mGeo = new THREE.SphereGeometry(m.size, 32, 32);
            const moonRoughness = m.archetype?.roughnessScale ?? (m.type === 'Eismond' ? 0.35 : 0.75);
            const mMat = new THREE.MeshStandardMaterial({
                map: mMap,
                color: mColor,
                roughnessMap: mRoughnessMap,
                roughness: moonRoughness,
                metalness: 0.08,
                emissive: mEmissiveColor,
                emissiveMap: mEmissiveMap,
                emissiveIntensity: mEmissiveIntensity
            });
            const mMesh = new THREE.Mesh(mGeo, mMat);
            mMesh.castShadow = true;
            mMesh.receiveShadow = false;

            const moonGroup = new THREE.Group();
            moonGroup.position.set(mx, 0, mz);
            moonGroup.add(mMesh);
            scene.add(moonGroup);

            const mMass = m.size * m.size * 2;
            const mRange = m.size * 3.5;
            const mSource: any = {
                mesh: moonGroup,
                type: 'planet',
                name: m.name,
                mass: mMass,
                radius: m.size,
                gravityRange: mRange,
                position: new THREE.Vector3(mx, 0, mz)
            };
            STATE.gravitySources.push(mSource);

            const mRing = createGravityRing(px, pz, m.distance, parseInt(m.color), 0.035);
            const moonOrbitSpeed = 0.12 + 0.06 / Math.sqrt(m.distance);

            const moonEntry: any = {
                mesh: moonGroup,
                bodyMesh: mMesh,
                source: mSource,
                ringMesh: mRing,
                angle: moonAngle,
                speed: moonOrbitSpeed,
                distance: m.distance,
                baseDistance: m.distance,
                name: m.name,
                type: m.type,
                size: m.size,
                color: m.color,
                colorCss: m.color.replace("0x", "#"),
                isMoon: true,
                parentPlanet: planetEntry,
                scanned: false,
                attributes: {
                    atmos: m.atmos,
                    temp: m.temp,
                    bio: m.bio,
                    res: m.res,
                    species: null,
                    tidalLock: typeof m.tidalLock === 'boolean' ? m.tidalLock : true,
                    geothermal: m.geothermal || (m.type === 'Eismond' ? 'Active Geysers' : (m.type === 'Vulkanmond' ? 'Hyper-Volcanic' : 'Dead')),
                    parentPlanetName: m.parentPlanetName || planetEntry.name
                }
            };
            activePlanets.push(moonEntry);
        });
    });

    // 3. Spawn Asteroids
    const asteroidsList = (activeSystem.asteroids && activeSystem.asteroids.length > 0) ? activeSystem.asteroids : [];
    asteroidsList.forEach((ast: any) => {
        const size = 1.1 + Math.random() * 1.3;
        const geo = new THREE.DodecahedronGeometry(size, 1);

        const posAttr = geo.attributes.position;
        for (let j = 0; j < posAttr.count; j++) {
            const vx = posAttr.getX(j);
            const vy = posAttr.getY(j);
            const vz = posAttr.getZ(j);
            const scale = 1 + (Math.random() - 0.5) * 0.35;
            posAttr.setXYZ(j, vx * scale, vy * scale, vz * scale);
        }
        geo.computeVertexNormals();

        const isOrganic = ast.type === 'bio';
        const color = isOrganic ? 0x00ff88 : 0x06b6d4;

        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.85,
            metalness: 0.7,
            emissive: isOrganic ? 0x003311 : 0x002233
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(ast.x * 2.2, (Math.random() - 0.5) * 1.5, ast.z * 2.2);
        scene.add(mesh);

        const astRange = size * 2.6;
        const sourceObj: any = {
            mesh: mesh,
            type: 'asteroid',
            name: isOrganic ? 'Organische Biomasse-Trümmer' : 'Silizium-Kristall-Fragment',
            mass: size * 1.5,
            radius: size,
            gravityRange: astRange,
            position: mesh.position,
            isResource: true,
            resourceType: isOrganic ? 'bio' : 'silicon',
            yield: isOrganic ? Math.round(15 + size * 5) : Math.round(20 + size * 6)
        };
        STATE.gravitySources.push(sourceObj);

        STATE.asteroids.push(sourceObj);
    });

    initPlanetDefenseFleets();

    // Spawn Voyager 2 probe in the starting system
    if (STATE.currentSystemId === 1 || STATE.currentSystemId === 0) {
        spawnVoyagerProbe();
    }

    addLogEntry("NAV", `Sensoren initialisiert: ${activeSystem.name} [${activeSystem.sectorName || 'Sektor'}].`);
}

export function spawnVoyagerProbe() {
    if (STATE.voyagerProbe && STATE.voyagerProbe.mesh) {
        scene.remove(STATE.voyagerProbe.mesh);
        disposeObject3D(STATE.voyagerProbe.mesh);
        STATE.voyagerProbe = null;
    }

    const voyagerController = createVoyagerProbeMesh(2.2);
    // Position deep in the outer interstellar void (~175 AE from star, 140+ AE from player spawn)
    voyagerController.group.position.set(-110, 0, 135);
    scene.add(voyagerController.group);

    const probeObj: any = {
        mesh: voyagerController.group,
        update: voyagerController.update,
        type: 'voyager_probe',
        name: STATE.voyagerScanned ? 'Voyager 2 (Archaische Raumsonde)' : 'Unbekanntes Signal (Archaische Sonde)',
        mass: 0.5,
        radius: 2.2,
        gravityRange: 10.0,
        position: voyagerController.group.position,
        isVoyager: true
    };

    STATE.voyagerProbe = probeObj;
    STATE.gravitySources.push(probeObj);
}

// ----------------------------------------------------------------------------
// INTERSTELLAR SYSTEM DEPARTURE (SPOOLING & FOLD PUNCH)
// ----------------------------------------------------------------------------

export function initiateSystemDeparture(fromSys: any, targetSys: any, resolution?: JumpResolution | null) {
    if (!targetSys) return;

    // 1. Calculate departure vector pointing towards target system
    const departureDir = new THREE.Vector3(1, 0, 0);
    if (fromSys && (fromSys.x !== targetSys.x || fromSys.z !== targetSys.z)) {
        departureDir.set(targetSys.x - fromSys.x, 0, targetSys.z - fromSys.z).normalize();
    } else {
        const h = STATE.shipHeading || 0;
        departureDir.set(Math.cos(h), 0, -Math.sin(h)).normalize();
    }

    // 2. Disengage any planetary / moon orbit locking
    STATE.isInPlanetOrbit = false;
    STATE.orbitPlanet = null;
    STATE.orbitLevel = 'solar';
    STATE.activeMoonOrbit = null;
    STATE.orbitZoomFactor = 0.0;

    // 3. Set departure state
    STATE.systemDepartureActive = true;
    STATE.systemDepartureTimer = 1.6;
    STATE.systemDepartureMaxTime = 1.6;
    STATE.systemDepartureDirection.copy(departureDir);
    STATE.systemDepartureTarget = targetSys;
    STATE.systemDepartureOrigin = fromSys;
    STATE.systemDepartureResolution = resolution || null;

    // 4. Log & Spool-up Audio
    if (resolution && !resolution.success) {
        addLogEntry("NAV", `⚠️ INSTABILE FALTUNG INITIIERT: Vektor nach ${targetSys.name} forciert. Psionische Raumzeit-Interferenzen festgestellt!`);
    } else {
        addLogEntry("NAV", `🌀 FALTUNGS-SEQUENZ INITIIERT: Vektor nach ${targetSys.name} (${targetSys.sectorName || 'Sektor'}) arretiert. Raumzeit-Krümmung lädt...`);
    }
    playWarpSpoolSound();
}

// ----------------------------------------------------------------------------
// INTERSTELLAR SYSTEM ARRIVAL & WARP-DROPOUT CONTROLLER
// ----------------------------------------------------------------------------

export function initiateSystemArrival(fromSys: any, targetSys: any, resolution?: JumpResolution | null) {
    if (!targetSys) return;

    // 1. Calculate directional arrival vector from Galaxy Map transit
    let inboundAngle = Math.PI * 0.75;
    if (fromSys && (fromSys.x !== targetSys.x || fromSys.z !== targetSys.z)) {
        const dx = targetSys.x - fromSys.x;
        const dz = targetSys.z - fromSys.z;
        inboundAngle = Math.atan2(-dz, -dx);
    }

    // Dynamic arrival distance based on precision resolution (Safe Outer Rim: 150; Corona: 34; Belt: 76)
    const entryDist = (resolution && resolution.arrivalDistance) ? resolution.arrivalDistance : 150.0;
    const entryX = Math.cos(inboundAngle) * entryDist;
    const entryZ = Math.sin(inboundAngle) * entryDist;

    STATE.playerPosition.set(entryX, 0, entryZ);
    if (STATE.playerGroup) {
        STATE.playerGroup.position.copy(STATE.playerPosition);
    }

    // 2. Align heading and forward velocity toward system center (0, 0, 0)
    const forwardDir = new THREE.Vector3(-entryX, 0, -entryZ).normalize();
    STATE.systemArrivalDirection.copy(forwardDir);
    STATE.shipHeading = Math.atan2(-forwardDir.z, forwardDir.x);

    // Initial high-velocity warp dropout
    STATE.playerVelocity.copy(forwardDir).multiplyScalar(32.0);

    // Activate smooth deceleration state
    STATE.systemArrivalActive = true;
    STATE.systemArrivalTimer = 2.2;
    STATE.systemArrivalMaxTime = 2.2;

    // Cinematic elevated establishing camera view
    STATE.cameraHeight = 92.0;
    STATE.targetCameraHeight = 65.0;
    if (camera) {
        camera.position.set(entryX, 92.0, entryZ);
    }

    // 3. Faction Jump Gate / Nav-Beacon Detection
    let dominantFaction: any = null;
    let dominantFactionName = '';
    const spacefaringPlanet = activePlanets.find(p => p.attributes && p.attributes.species && (p.attributes.species.techLevel === 'Spacefaring' || p.attributes.species.techLevel === 'Hyper-Advanced' || p.attributes.species.techLevel === 'Industrial'));

    if (spacefaringPlanet && spacefaringPlanet.attributes.species) {
        const spec = spacefaringPlanet.attributes.species;
        if (spec.factionId) {
            dominantFaction = getFaction(spec.factionId);
            dominantFactionName = dominantFaction ? dominantFaction.name : spec.name;
        } else {
            dominantFactionName = spec.name;
        }
    }

    if (dominantFaction || spacefaringPlanet) {
        const gateColor = dominantFaction ? parseInt(dominantFaction.color) : 0x38bdf8;
        const jumpGate = createJumpGateMesh(9.5, gateColor);
        jumpGate.group.position.set(entryX, 0, entryZ);
        jumpGate.group.rotation.y = Math.atan2(forwardDir.x, forwardDir.z);
        STATE.incomingJumpGate = jumpGate;

        addLogEntry("NAV", `📡 SPRUNGTOR-SIGNAL ERFASST: Navigations-Vektor autorisiert durch ${dominantFactionName}. Willkommen im System ${targetSys.name}.`);
    } else {
        STATE.incomingJumpGate = null;
        if (resolution && resolution.hazardType === 'solar_corona') {
            addLogEntry("NAV", `🔥 PERIHEL-NOTFALL-DROPOUT: Faltungsfeld kollabiert direkt vor der glühenden Sonnenkorona! Extreme Strahlung! Kurs abdrehen!`);
            playMisfoldWarningSound();
        } else if (resolution && resolution.hazardType === 'asteroid_belt') {
            addLogEntry("NAV", `💥 WARP-FEHLKOLLAPS: Austritt inmitten eines dichten Asteroidengürtels! Kollisionsalarm!`);
            playMisfoldWarningSound();
        } else if (resolution && resolution.isDrift) {
            addLogEntry("NAV", resolution.message);
            playMisfoldWarningSound();
        } else {
            addLogEntry("NAV", `🌌 WARP-AUSTRITT: Unkartierter Raumsektor erreicht. Faltungsfeld kollabiert. Eintrittsvektor stabil.`);
        }
    }

    // 4. Acoustic Warp Exit Soundscape (Deep Sub-Bass & Vacuum Whoosh)
    playWarpDropoutSound();

    // 5. Trigger Cinematic System Arrival Banner
    triggerSystemArrivalBanner(targetSys, dominantFactionName, resolution);

    // 6. Auto-Save on System Arrival
    triggerAutoSave(`Ankunft in ${targetSys.name}`);
}

export function updateActivePlanets(dt: number) {
    activePlanets.forEach(p => {
        if (!p.isMoon) {
            p.angle += p.speed * dt;
            const px = p.distance * Math.cos(p.angle);
            const pz = p.distance * Math.sin(p.angle);
            p.mesh.position.set(px, 0, pz);
            p.source.position.set(px, 0, pz);

            // Dynamic Planetary Sub-System Scale: Planet smoothly expands into a colossal world
            const isOrbitFocus = !!(STATE.isInPlanetOrbit && STATE.orbitPlanet === p);
            const targetScale = isOrbitFocus ? 2.8 : 1.0;
            const curScale = THREE.MathUtils.lerp(p.mesh.scale.x, targetScale, Math.min(1.0, dt * 3.0));
            p.mesh.scale.set(curScale, curScale, curScale);
            p.source.radius = p.size * curScale;

            if (p.bodyMesh && p.bodyMesh instanceof THREE.Mesh) {
                if (p.attributes && p.attributes.tidalLock) {
                    // Synchronous 1:1 rotation: one side eternally faces central star
                    p.bodyMesh.rotation.y = p.angle + Math.PI;
                } else {
                    p.bodyMesh.rotation.y += 0.08 * dt;
                }
            }
            if (p.psioAuraMesh) {
                p.psioAuraMesh.rotation.y -= 0.15 * dt;
                p.psioAuraMesh.rotation.x += 0.08 * dt;
            }
            if (p.auroraMesh) {
                p.auroraMesh.rotation.z += 0.05 * dt;
            }
            if (p.cloudMesh) {
                p.cloudMesh.rotation.y += 0.12 * dt;
            }
            if (p.ringMesh && (p.ringMesh.material as any)?.userData?.shader) {
                const rs = (p.ringMesh.material as any).userData.shader;
                rs.uniforms.uPlanetWorldPos.value.set(px, 0, pz);
                rs.uniforms.uStarWorldPos.value.set(0, 38, 0);
                rs.uniforms.uPlanetRadius.value = p.size * curScale;
            }
        } else if (p.isMoon && p.parentPlanet) {
            // Dynamic Sub-System Expansion: Expand moon distance & size for the orbital level
            const isOrbitFocus = !!(STATE.isInPlanetOrbit && (STATE.orbitPlanet === p.parentPlanet || STATE.orbitPlanet === p));
            const baseDist = p.baseDistance || 6.0;
            const targetDist = isOrbitFocus ? (baseDist * 3.4 + 10.0) : baseDist;
            p.distance = THREE.MathUtils.lerp(p.distance, targetDist, Math.min(1.0, dt * 3.5));

            const targetMoonScale = isOrbitFocus ? 1.8 : 1.0;
            const curMoonScale = THREE.MathUtils.lerp(p.mesh.scale.x, targetMoonScale, Math.min(1.0, dt * 3.0));
            p.mesh.scale.set(curMoonScale, curMoonScale, curMoonScale);
            p.source.radius = p.size * curMoonScale;

            p.angle += p.speed * dt;
            const parentPos = p.parentPlanet.mesh.position;
            const mx = parentPos.x + p.distance * Math.cos(p.angle);
            const mz = parentPos.z + p.distance * Math.sin(p.angle);
            p.mesh.position.set(mx, 0, mz);
            p.source.position.set(mx, 0, mz);

            if (p.bodyMesh && p.bodyMesh instanceof THREE.Mesh) {
                if (p.attributes && p.attributes.tidalLock) {
                    // Synchronous 1:1 rotation: one side eternally faces parent planet
                    p.bodyMesh.rotation.y = p.angle + Math.PI;
                } else {
                    p.bodyMesh.rotation.y += 0.15 * dt;
                }

                // Real Astronomical Lunar Eclipse: Parent planet sphere blocks starlight
                const starPos = new THREE.Vector3(0, 38, 0);
                const moonPos = p.mesh.position;
                const toStar = starPos.clone().sub(moonPos).normalize();
                const toPlanet = parentPos.clone().sub(moonPos);
                const t = toPlanet.dot(toStar);
                if (t > 0.0) {
                    const closest = toPlanet.clone().sub(toStar.clone().multiplyScalar(t));
                    const dist = closest.length();
                    const parentR = p.parentPlanet.size * (p.parentPlanet.mesh.scale.x || 1.0);
                    if (dist < parentR) {
                        const eclipseRatio = Math.min(1.0, Math.max(0.12, dist / Math.max(0.1, parentR)));
                        if (p.bodyMesh.material && (p.bodyMesh.material as THREE.MeshStandardMaterial).color) {
                            (p.bodyMesh.material as THREE.MeshStandardMaterial).color.set(p.color).multiplyScalar(eclipseRatio);
                        }
                    } else {
                        if (p.bodyMesh.material && (p.bodyMesh.material as THREE.MeshStandardMaterial).color) {
                            (p.bodyMesh.material as THREE.MeshStandardMaterial).color.set(p.color);
                        }
                    }
                } else {
                    if (p.bodyMesh.material && (p.bodyMesh.material as THREE.MeshStandardMaterial).color) {
                        (p.bodyMesh.material as THREE.MeshStandardMaterial).color.set(p.color);
                    }
                }
            }
            if (p.ringMesh) {
                p.ringMesh.position.set(parentPos.x, 0, parentPos.z);
                const ringScale = p.distance / baseDist;
                p.ringMesh.scale.set(ringScale, 1, ringScale);
            }
        }
    });

    STATE.asteroids.forEach(a => {
        a.mesh.rotation.x += 0.005;
        a.mesh.rotation.y += 0.008;
    });
}
