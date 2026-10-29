import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STATE, activePlanets } from '../core/state';
import { scene, camera, renderer } from '../engine/scene';
import { createJamalResearchShuttleMesh, createTowingDroneMesh } from '../procedural/jamal-shuttle';
import { createSpaceStationMesh } from '../procedural/space-stations';
import { createVoyagerProbeMesh } from '../procedural/meshes';
import { DIALOGUE_NODES, openNpcDialogue } from '../ui/jamal-dialog';
import { addLogEntry } from '../ui/hud';
import { PlanetEntry } from '../types/game';

export type EditorAssetCategory =
    | 'jamal_shuttle'
    | 'towing_drone'
    | 'space_station'
    | 'trade_hub'
    | 'voyager_probe'
    | 'derelict_wreck'
    | 'psionic_anomaly'
    | 'custom_glb';

export interface EditorSpawnOptions {
    id?: string;
    name?: string;
    scale?: number;
    rotationY?: number;
    parentPlanet?: PlanetEntry | null;
    parentPlanetName?: string | null;
    orbitRadius?: number;
    orbitAngle?: number;
    orbitSpeed?: number;
    position?: { x: number; y: number; z: number };
    questId?: string;
    dialogNodeId?: string;
    modelSource?: 'procedural' | 'custom_glb';
    customModelName?: string;
}

export interface EditorEntityPatch {
    name?: string;
    scale?: number;
    rotationY?: number;
    parentPlanetName?: string | null;
    orbitRadius?: number;
    orbitAngle?: number;
    orbitSpeed?: number;
    position?: { x: number; y: number; z: number };
    questId?: string;
    dialogNodeId?: string;
}

export interface SerializedEditorEntity {
    id: string;
    name: string;
    category: EditorAssetCategory;
    isBuiltIn?: boolean;
    builtInKey?: 'jamalShip' | 'towingDrone' | 'voyagerProbe' | 'spaceStation';
    scale: number;
    rotationY: number;
    parentPlanetName: string | null;
    orbitRadius: number;
    orbitAngle: number;
    orbitSpeed: number;
    position: { x: number; y: number; z: number };
    questId: string;
    dialogNodeId: string;
    modelSource: 'procedural' | 'custom_glb';
    customModelName?: string;
}

export interface SystemEditorExport {
    systemId: number;
    systemName: string;
    timestamp: string;
    entities: SerializedEditorEntity[];
    typescriptSnippet: string;
}

let transformControls: TransformControls | null = null;
let transformHelper: THREE.Object3D | null = null;
let orbitGuideGroup: THREE.Group | null = null;
let dangerRingMesh: THREE.LineLoop | null = null;
let currentOrbitRingMesh: THREE.LineLoop | null = null;
let tetherLineMesh: THREE.Line | null = null;
let selectionRingMesh: THREE.LineLoop | null = null;

// Editor Free-Camera State
const editorCamPos = new THREE.Vector3(0, 95, 140);
const editorCamTarget = new THREE.Vector3(0, 0, 80);
let editorYaw = 0;
let editorPitch = -0.72; // Looking down at ~41 degrees
let isRightMouseDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
const editorKeys: Record<string, boolean> = {};
let editorInitialized = false;
let entityCounter = 1;

// Saved game camera before entering editor
const savedCameraPos = new THREE.Vector3();
const savedCameraUp = new THREE.Vector3();
let savedCameraFov = 60;

/**
 * Calculates the minimum safe orbital radius around a planet so that even at maximum
 * 2.85x planetary approach expansion + 1.35x atmosphere, the entity never clips!
 */
export function getPlanetMinSafeOrbitRadius(planet: any): number {
    if (!planet) return 22.0;
    const pSize = planet.size || 3.5;
    // Maximum expanded planet radius (2.85x) * atmosphere (1.35x) + safety buffer (6.0 AE)
    return Math.ceil((pSize * 2.85 * 1.35 + 6.0) * 10) / 10;
}

/**
 * Checks if an entity's current orbit radius around its parent planet is safe from clipping.
 */
export function isEntityOrbitSafe(entity: any): { safe: boolean; minSafeRadius: number; currentRadius: number } {
    if (!entity || !entity.parentPlanet) {
        return { safe: true, minSafeRadius: 0, currentRadius: 0 };
    }
    const minSafeRadius = getPlanetMinSafeOrbitRadius(entity.parentPlanet);
    const currentRadius = Number(entity.orbitRadius ?? 0);
    return {
        safe: currentRadius >= minSafeRadius,
        minSafeRadius,
        currentRadius
    };
}

/**
 * Creates a procedural Derelict Wreck mesh for custom quest/salvage placement.
 */
function createDerelictWreckMesh(size: number = 1.0): { group: THREE.Group; update: (dt: number) => void } {
    const group = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.8,
        roughness: 0.65,
        emissive: 0x0f172a,
        emissiveIntensity: 0.15
    });
    const scorchMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.5,
        roughness: 0.9
    });

    const bodyGeo = new THREE.CylinderGeometry(size * 0.4, size * 0.65, size * 2.4, 7);
    bodyGeo.rotateZ(Math.PI * 0.42);
    bodyGeo.rotateX(0.3);
    const body = new THREE.Mesh(bodyGeo, hullMat);
    group.add(body);

    const wingGeo = new THREE.BoxGeometry(size * 1.8, size * 0.1, size * 0.7);
    const wing = new THREE.Mesh(wingGeo, scorchMat);
    wing.rotation.set(0.25, 0.4, -0.35);
    group.add(wing);

    const beaconGeo = new THREE.SphereGeometry(size * 0.16, 10, 10);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, size * 0.55, 0);
    group.add(beacon);

    const sparkLight = new THREE.PointLight(0xf97316, 1.5, 14, 1.4);
    sparkLight.position.set(0, size * 0.65, 0);
    group.add(sparkLight);

    let t = 0;
    const update = (dt: number) => {
        t += dt;
        group.rotation.y += dt * 0.12;
        const pulse = Math.sin(t * 7.0) > 0.2 ? 1.8 : 0.2;
        sparkLight.intensity = pulse;
    };

    return { group, update };
}

/**
 * Creates a procedural Psionic Subspace Anomaly / Crystal Rift mesh.
 */
function createPsionicAnomalyMesh(size: number = 1.2): { group: THREE.Group; update: (dt: number) => void } {
    const group = new THREE.Group();

    const coreGeo = new THREE.OctahedronGeometry(size * 0.85, 1);
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x9333ea,
        emissiveIntensity: 0.85,
        metalness: 0.9,
        roughness: 0.1,
        wireframe: false
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    const ringGeo = new THREE.TorusGeometry(size * 1.45, size * 0.06, 10, 36);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.75
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const auraLight = new THREE.PointLight(0xa855f7, 2.2, 20, 1.2);
    group.add(auraLight);

    let t = 0;
    const update = (dt: number) => {
        t += dt;
        core.rotation.y += dt * 0.8;
        core.rotation.x += dt * 0.45;
        ring.rotation.z -= dt * 0.6;
        const s = 1.0 + Math.sin(t * 3.2) * 0.12;
        core.scale.set(s, s, s);
    };

    return { group, update };
}

/**
 * Creates a circular LineLoop in the XZ plane.
 */
function createCircleLineLoop(radius: number, colorHex: number, segments = 64): THREE.LineLoop {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.78
    });
    return new THREE.LineLoop(geo, mat);
}

/**
 * Initializes the 3D Orbital Safety Rings & Selection Indicator in the scene.
 */
function ensureOrbitGuideGroup() {
    if (orbitGuideGroup) return;
    orbitGuideGroup = new THREE.Group();
    orbitGuideGroup.name = 'EditorOrbitGuideGroup';
    orbitGuideGroup.visible = false;

    dangerRingMesh = createCircleLineLoop(1.0, 0xef4444, 72);
    currentOrbitRingMesh = createCircleLineLoop(1.0, 0x10b981, 72);
    selectionRingMesh = createCircleLineLoop(1.0, 0x38bdf8, 48);

    const tetherGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1, 0, 0)
    ]);
    const tetherMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.65 });
    tetherLineMesh = new THREE.Line(tetherGeo, tetherMat);

    orbitGuideGroup.add(dangerRingMesh);
    orbitGuideGroup.add(currentOrbitRingMesh);
    orbitGuideGroup.add(selectionRingMesh);
    orbitGuideGroup.add(tetherLineMesh);

    if (scene) {
        scene.add(orbitGuideGroup);
    }
}

/**
 * Updates the 3D Orbital Safety Rings & Selection Indicator for the currently selected entity.
 */
export function updateEditorVisualGuides() {
    ensureOrbitGuideGroup();
    if (!orbitGuideGroup) return;

    const sel = STATE.editorSelectedEntity;
    if (!STATE.editorActive || !sel || !sel.mesh) {
        orbitGuideGroup.visible = false;
        return;
    }

    orbitGuideGroup.visible = true;
    const entityPos = sel.mesh.position;

    // Selection highlight ring around selected entity
    if (selectionRingMesh) {
        const selRadius = Math.max(2.2, (sel.size || sel.radius || 1.5) * (sel.mesh.scale?.x || 1.0) * 1.45);
        selectionRingMesh.position.set(entityPos.x, 0.1, entityPos.z);
        selectionRingMesh.scale.set(selRadius, 1, selRadius);
        selectionRingMesh.visible = true;
    }

    // If entity is a planet itself, show its own danger zone
    const targetPlanet = sel.parentPlanet || (sel.isMoon === false && sel.distance !== undefined ? sel : null);
    if (targetPlanet && targetPlanet.mesh) {
        const pPos = targetPlanet.mesh.position;
        const minSafe = getPlanetMinSafeOrbitRadius(targetPlanet);

        if (dangerRingMesh) {
            dangerRingMesh.position.set(pPos.x, 0.05, pPos.z);
            dangerRingMesh.scale.set(minSafe, 1, minSafe);
            dangerRingMesh.visible = true;
        }

        if (sel.parentPlanet && currentOrbitRingMesh && tetherLineMesh) {
            const curR = Math.max(0.5, Number(sel.orbitRadius || entityPos.distanceTo(pPos)));
            const isSafe = curR >= minSafe;
            currentOrbitRingMesh.position.set(pPos.x, 0.08, pPos.z);
            currentOrbitRingMesh.scale.set(curR, 1, curR);
            (currentOrbitRingMesh.material as THREE.LineBasicMaterial).color.setHex(isSafe ? 0x10b981 : 0xef4444);
            currentOrbitRingMesh.visible = true;

            const positions = new Float32Array([pPos.x, 0.1, pPos.z, entityPos.x, 0.1, entityPos.z]);
            tetherLineMesh.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            tetherLineMesh.geometry.attributes.position.needsUpdate = true;
            tetherLineMesh.visible = true;
        } else {
            if (currentOrbitRingMesh) currentOrbitRingMesh.visible = false;
            if (tetherLineMesh) tetherLineMesh.visible = false;
        }
    } else {
        if (dangerRingMesh) dangerRingMesh.visible = false;
        if (currentOrbitRingMesh) currentOrbitRingMesh.visible = false;
        if (tetherLineMesh) tetherLineMesh.visible = false;
    }
}

/**
 * Returns all editable entities currently in the active star system.
 */
export function getSystemEditableEntities(): any[] {
    const list: any[] = [];

    if (STATE.jamalShip) {
        STATE.jamalShip.category = STATE.jamalShip.category || 'jamal_shuttle';
        STATE.jamalShip.builtInKey = 'jamalShip';
        STATE.jamalShip.isBuiltIn = true;
        list.push(STATE.jamalShip);
    }
    if (STATE.towingDrone) {
        STATE.towingDrone.category = STATE.towingDrone.category || 'towing_drone';
        STATE.towingDrone.builtInKey = 'towingDrone';
        STATE.towingDrone.isBuiltIn = true;
        list.push(STATE.towingDrone);
    }
    if (STATE.spaceStations && STATE.spaceStations.length > 0) {
        STATE.spaceStations.forEach(st => {
            (st as any).category = (st as any).category || 'space_station';
            (st as any).builtInKey = 'spaceStation';
            (st as any).isBuiltIn = true;
            list.push(st);
        });
    }
    if (STATE.voyagerProbe) {
        STATE.voyagerProbe.category = STATE.voyagerProbe.category || 'voyager_probe';
        STATE.voyagerProbe.builtInKey = 'voyagerProbe';
        STATE.voyagerProbe.isBuiltIn = true;
        list.push(STATE.voyagerProbe);
    }
    if (STATE.editorEntities && STATE.editorEntities.length > 0) {
        STATE.editorEntities.forEach(ent => {
            if (!list.includes(ent)) {
                list.push(ent);
            }
        });
    }

    return list;
}

/**
 * Synchronizes an entity's orbital parameters (`orbitRadius`, `orbitAngle`) from its current 3D world position.
 * Called automatically when dragging the 3D TransformControls gizmo in the viewport.
 */
export function syncEntityOrbitFromWorldPosition(entity: any) {
    if (!entity || !entity.mesh) return;
    entity.mesh.position.y = 0; // Keep on ecliptic orbital plane by default for clean 2.5D navigation
    if (entity.position && entity.position !== entity.mesh.position) {
        entity.position.copy(entity.mesh.position);
    }

    if (entity.parentPlanet && entity.parentPlanet.mesh) {
        const pPos = entity.parentPlanet.mesh.position;
        const dx = entity.mesh.position.x - pPos.x;
        const dz = entity.mesh.position.z - pPos.z;
        entity.orbitRadius = Math.round(Math.hypot(dx, dz) * 100) / 100;
        let angle = Math.atan2(dz, dx);
        if (angle < 0) angle += Math.PI * 2;
        entity.orbitAngle = Math.round(angle * 1000) / 1000;
    }

    if (entity.mesh.scale) {
        entity.scale = Math.round(entity.mesh.scale.x * 100) / 100;
    }
    entity.rotationY = Math.round((entity.mesh.rotation.y * 180 / Math.PI) * 10) / 10;

    updateEditorVisualGuides();
    refreshInspectorValuesLive();
}

/**
 * Applies an entity's orbital or world coordinates directly to its 3D mesh.
 */
export function applyEntityTransformToMesh(entity: any) {
    if (!entity || !entity.mesh) return;

    if (entity.scale !== undefined && entity.scale > 0) {
        entity.mesh.scale.set(entity.scale, entity.scale, entity.scale);
    }
    if (entity.rotationY !== undefined) {
        entity.mesh.rotation.y = (entity.rotationY * Math.PI) / 180;
    }

    if (entity.parentPlanet && entity.parentPlanet.mesh) {
        const pPos = entity.parentPlanet.mesh.position;
        const pScale = Math.max(1.0, entity.parentPlanet.mesh.scale?.x || 1.0);
        const baseR = Number(entity.orbitRadius ?? 28.0);
        const effectiveR = baseR + (pScale - 1.0) * (baseR * 0.45 + 4.0);
        const angle = Number(entity.orbitAngle ?? 0);
        const nx = pPos.x + Math.cos(angle) * effectiveR;
        const nz = pPos.z + Math.sin(angle) * effectiveR;
        entity.mesh.position.set(nx, 0, nz);
        if (entity.position) {
            entity.position.set(nx, 0, nz);
        }
    } else if (entity.position) {
        entity.mesh.position.set(entity.position.x || 0, entity.position.y || 0, entity.position.z || 0);
    }

    updateEditorVisualGuides();
}

/**
 * Spawns a new asset in the current star system and selects it in the editor.
 */
export function spawnEditorAsset(
    category: EditorAssetCategory,
    options: Partial<EditorSpawnOptions> = {}
): any {
    if (!STATE.editorEntities) {
        STATE.editorEntities = [];
    }

    const id = options.id || `editor_${category}_${Date.now()}_${entityCounter++}`;

    // Determine parent planet: explicit option, or currently selected entity's planet, or first planet
    let parentPlanet: PlanetEntry | null = null;
    if (options.parentPlanet !== undefined) {
        parentPlanet = options.parentPlanet;
    } else if (options.parentPlanetName) {
        parentPlanet = activePlanets.find(p => p.name === options.parentPlanetName) || null;
    } else if (STATE.editorSelectedEntity) {
        if (STATE.editorSelectedEntity.isMoon === false && STATE.editorSelectedEntity.distance !== undefined) {
            parentPlanet = STATE.editorSelectedEntity;
        } else if (STATE.editorSelectedEntity.parentPlanet) {
            parentPlanet = STATE.editorSelectedEntity.parentPlanet;
        }
    } else if (activePlanets.length > 0 && category !== 'voyager_probe') {
        parentPlanet = activePlanets.find(p => !p.isMoon) || activePlanets[0];
    }

    const minSafe = parentPlanet ? getPlanetMinSafeOrbitRadius(parentPlanet) : 0;
    const defaultOrbitRadius = parentPlanet ? Math.max(minSafe + 6.0, (parentPlanet.size || 3.5) * 4.2 + 16.0) : 0;
    const orbitRadius = options.orbitRadius !== undefined ? options.orbitRadius : defaultOrbitRadius;
    const orbitAngle = options.orbitAngle !== undefined ? options.orbitAngle : Math.round((Math.random() * Math.PI * 2) * 100) / 100;
    const orbitSpeed = options.orbitSpeed !== undefined ? options.orbitSpeed : (parentPlanet ? 0.035 : 0);

    let meshGroup: THREE.Group;
    let updateFn: ((dt: number) => void) | undefined;
    let defaultName = 'Neues Objekt';
    let baseRadius = 1.0;

    switch (category) {
        case 'jamal_shuttle': {
            const ctrl = createJamalResearchShuttleMesh(0.65);
            meshGroup = ctrl.group;
            updateFn = ctrl.update;
            defaultName = "Forschungsschiff 'Ar-Riḥla'";
            baseRadius = 0.65;
            break;
        }
        case 'towing_drone': {
            const ctrl = createTowingDroneMesh(0.45);
            meshGroup = ctrl.group;
            updateFn = (dt: number) => ctrl.update(dt);
            defaultName = 'INSAN-Abschleppdrohne TX-9';
            baseRadius = 0.45;
            break;
        }
        case 'space_station': {
            const ctrl = createSpaceStationMesh('citadel', 0xf59e0b);
            meshGroup = ctrl.group;
            updateFn = ctrl.update;
            defaultName = 'INSAN-Verwaltungsstation';
            baseRadius = 4.2;
            break;
        }
        case 'trade_hub': {
            const ctrl = createSpaceStationMesh('trade_hub', 0x38bdf8);
            meshGroup = ctrl.group;
            updateFn = ctrl.update;
            defaultName = 'Freies Handels-Relais';
            baseRadius = 3.6;
            break;
        }
        case 'voyager_probe': {
            const ctrl = createVoyagerProbeMesh(1.4);
            meshGroup = ctrl.group;
            updateFn = ctrl.update;
            defaultName = 'Archaische Raumsonde';
            baseRadius = 1.4;
            break;
        }
        case 'derelict_wreck': {
            const ctrl = createDerelictWreckMesh(1.1);
            meshGroup = ctrl.group;
            updateFn = ctrl.update;
            defaultName = 'Schiffswrack (Bergungsgut)';
            baseRadius = 1.1;
            break;
        }
        case 'psionic_anomaly':
        default: {
            const ctrl = createPsionicAnomalyMesh(1.2);
            meshGroup = ctrl.group;
            updateFn = ctrl.update;
            defaultName = 'Psionische Subraum-Anomalie';
            baseRadius = 1.2;
            break;
        }
    }

    const scale = options.scale !== undefined ? options.scale : 1.0;
    const rotationY = options.rotationY !== undefined ? options.rotationY : 0;
    meshGroup.scale.set(scale, scale, scale);
    meshGroup.rotation.y = (rotationY * Math.PI) / 180;

    if (parentPlanet && parentPlanet.mesh) {
        const pPos = parentPlanet.mesh.position;
        const initX = pPos.x + Math.cos(orbitAngle) * orbitRadius;
        const initZ = pPos.z + Math.sin(orbitAngle) * orbitRadius;
        meshGroup.position.set(initX, 0, initZ);
    } else if (options.position) {
        meshGroup.position.set(options.position.x, options.position.y || 0, options.position.z);
    } else {
        meshGroup.position.set(editorCamTarget.x, 0, editorCamTarget.z);
    }

    if (scene) {
        scene.add(meshGroup);
    }

    const entityObj: any = {
        id,
        name: options.name || defaultName,
        category,
        type: category,
        mesh: meshGroup,
        update: updateFn,
        position: meshGroup.position,
        scale,
        rotationY,
        radius: baseRadius * scale,
        size: baseRadius * scale,
        mass: 0.05,
        gravityRange: 0.0,
        parentPlanet,
        parentPlanetName: parentPlanet ? parentPlanet.name : null,
        orbitRadius,
        orbitAngle,
        orbitSpeed,
        questId: options.questId || '',
        dialogNodeId: options.dialogNodeId || '',
        modelSource: options.modelSource || 'procedural',
        customModelName: options.customModelName || '',
        isEditorEntity: true,
        isSpecialEntity: true,
        scanned: false
    };

    STATE.editorEntities.push(entityObj);
    STATE.gravitySources.push(entityObj);

    if (STATE.editorActive) {
        selectEditorEntity(entityObj);
        renderEditorOutliner();
        renderEditorInspector();
    }

    return entityObj;
}

/**
 * Updates properties on the currently selected editor entity and refreshes the 3D scene & UI.
 */
export function updateSelectedEntityProperties(patch: Partial<EditorEntityPatch>): any {
    const sel = STATE.editorSelectedEntity;
    if (!sel) return null;

    if (patch.name !== undefined) {
        sel.name = patch.name;
    }
    if (patch.scale !== undefined && patch.scale > 0) {
        sel.scale = Number(patch.scale);
        if (sel.mesh) {
            sel.mesh.scale.set(sel.scale, sel.scale, sel.scale);
        }
    }
    if (patch.rotationY !== undefined) {
        sel.rotationY = Number(patch.rotationY);
        if (sel.mesh) {
            sel.mesh.rotation.y = (sel.rotationY * Math.PI) / 180;
        }
    }
    if (patch.parentPlanetName !== undefined) {
        if (!patch.parentPlanetName || patch.parentPlanetName === '__deep_space__') {
            sel.parentPlanet = null;
            sel.parentPlanetName = null;
        } else {
            const foundPlanet = activePlanets.find(p => p.name === patch.parentPlanetName);
            if (foundPlanet) {
                sel.parentPlanet = foundPlanet;
                sel.parentPlanetName = foundPlanet.name;
                const minSafe = getPlanetMinSafeOrbitRadius(foundPlanet);
                if (!sel.orbitRadius || sel.orbitRadius < minSafe) {
                    sel.orbitRadius = Math.max(minSafe + 4.0, (foundPlanet.size || 3.5) * 4.2 + 16.0);
                }
            }
        }
    }
    if (patch.orbitRadius !== undefined) {
        sel.orbitRadius = Math.max(1.0, Number(patch.orbitRadius));
    }
    if (patch.orbitAngle !== undefined) {
        sel.orbitAngle = Number(patch.orbitAngle);
    }
    if (patch.orbitSpeed !== undefined) {
        sel.orbitSpeed = Number(patch.orbitSpeed);
    }
    if (patch.position !== undefined && !sel.parentPlanet) {
        if (sel.mesh) {
            sel.mesh.position.set(patch.position.x, patch.position.y || 0, patch.position.z);
        }
        if (sel.position) {
            sel.position.set(patch.position.x, patch.position.y || 0, patch.position.z);
        }
    }
    if (patch.questId !== undefined) {
        sel.questId = patch.questId;
    }
    if (patch.dialogNodeId !== undefined) {
        sel.dialogNodeId = patch.dialogNodeId;
    }

    applyEntityTransformToMesh(sel);
    renderEditorOutliner();
    renderEditorInspector();
    return sel;
}

/**
 * Snaps the selected entity's orbit radius to a guaranteed safe altitude outside its parent planet's 2.85x expansion zone.
 */
export function snapSelectedEntityToSafeOrbit(): any {
    const sel = STATE.editorSelectedEntity;
    if (!sel || !sel.parentPlanet) return null;
    const minSafe = getPlanetMinSafeOrbitRadius(sel.parentPlanet);
    const recommended = Math.round((minSafe + 8.0) * 10) / 10;
    return updateSelectedEntityProperties({ orbitRadius: recommended });
}

/**
 * Deletes a custom editor-spawned entity from the scene and state.
 */
export function deleteEditorEntity(entity?: any): boolean {
    const target = entity || STATE.editorSelectedEntity;
    if (!target) return false;

    if (target.mesh && scene) {
        scene.remove(target.mesh);
    }

    if (STATE.editorEntities) {
        const idx = STATE.editorEntities.indexOf(target);
        if (idx !== -1) STATE.editorEntities.splice(idx, 1);
    }

    const gIdx = STATE.gravitySources.indexOf(target);
    if (gIdx !== -1) STATE.gravitySources.splice(gIdx, 1);

    if (STATE.editorSelectedEntity === target) {
        STATE.editorSelectedEntity = null;
        if (transformControls) transformControls.detach();
    }

    updateEditorVisualGuides();
    renderEditorOutliner();
    renderEditorInspector();
    return true;
}

/**
 * Selects an entity in the editor, attaches the 3D TransformControls gizmo, and updates UI panels.
 */
export function selectEditorEntity(entity: any | null) {
    STATE.editorSelectedEntity = entity;

    if (transformControls) {
        if (entity && entity.mesh && STATE.editorActive) {
            transformControls.attach(entity.mesh);
        } else {
            transformControls.detach();
        }
    }

    updateEditorVisualGuides();
    renderEditorOutliner();
    renderEditorInspector();
}

/**
 * Focuses the editor camera smoothly onto the specified entity.
 */
export function focusEditorCameraOn(entity: any) {
    if (!entity) return;
    const pos = entity.mesh ? entity.mesh.position : entity.position;
    if (!pos) return;

    editorCamTarget.set(pos.x, pos.y || 0, pos.z);
    const distOffset = Math.max(24, (entity.size || entity.radius || 3.0) * 5.5);
    editorCamPos.set(pos.x, distOffset * 0.9, pos.z + distOffset);
    editorYaw = 0;
    editorPitch = -0.68;

    if (camera && STATE.editorActive) {
        camera.position.copy(editorCamPos);
        camera.up.set(0, 1, 0);
        camera.lookAt(editorCamTarget);
    }
}

/**
 * Teleports the player's bio-ship right next to the currently selected entity for instant playtesting!
 */
export function teleportPlayerToSelectedEntity(): boolean {
    const sel = STATE.editorSelectedEntity;
    if (!sel) return false;
    const pos = sel.mesh ? sel.mesh.position : sel.position;
    if (!pos) return false;

    const standoff = Math.max(8.0, (sel.size || sel.radius || 1.5) * 2.5 + 6.0);
    STATE.playerPosition.set(pos.x, 0, pos.z + standoff);
    STATE.playerVelocity.set(0, 0, 0);
    if (STATE.playerGroup) {
        STATE.playerGroup.position.copy(STATE.playerPosition);
    }
    addLogEntry("SYSTEM", `🚀 EDITOR-TELEPORT: Najmafar zu '${sel.name}' verlegt (${standoff.toFixed(1)} AE Abstand).`);
    return true;
}

/**
 * Loads a custom 3D model (.glb / .gltf) into the target entity using Three.js GLTFLoader.
 */
export async function loadCustomGlbForEntity(entity: any, fileOrUrl: File | string): Promise<boolean> {
    if (!entity || !entity.mesh) return false;

    const loader = new GLTFLoader();
    let url = '';
    let modelName = '';
    let revokeAfter = false;

    if (typeof fileOrUrl === 'string') {
        url = fileOrUrl;
        modelName = fileOrUrl.split('/').pop() || 'custom_model.glb';
    } else {
        url = URL.createObjectURL(fileOrUrl);
        modelName = fileOrUrl.name;
        revokeAfter = true;
    }

    return new Promise<boolean>((resolve) => {
        loader.load(
            url,
            (gltf) => {
                if (revokeAfter) URL.revokeObjectURL(url);
                // Clear existing procedural children
                while (entity.mesh.children.length > 0) {
                    entity.mesh.remove(entity.mesh.children[0]);
                }
                // Normalize bounding box to ~2.0 units so scale slider stays intuitive
                const box = new THREE.Box3().setFromObject(gltf.scene);
                const sizeVec = new THREE.Vector3();
                box.getSize(sizeVec);
                const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 0.001);
                const normScale = 2.0 / maxDim;
                gltf.scene.scale.set(normScale, normScale, normScale);

                entity.mesh.add(gltf.scene);
                entity.modelSource = 'custom_glb';
                entity.customModelName = modelName;

                addLogEntry("SYSTEM", `📦 3D-MODELL GELADEN: '${modelName}' erfolgreich auf '${entity.name}' angewendet!`);
                renderEditorInspector();
                resolve(true);
            },
            undefined,
            (err) => {
                if (revokeAfter) URL.revokeObjectURL(url);
                console.error('[WorldEditor] GLTFLoader error:', err);
                addLogEntry("SYSTEM", `⚠️ Fehler beim Laden des 3D-Modells '${modelName}'.`);
                resolve(false);
            }
        );
    });
}

/**
 * Updates all custom editor entities each frame (orbits & procedural animations).
 */
export function updateCustomEditorEntities(dt: number) {
    if (!STATE.editorEntities || STATE.editorEntities.length === 0) return;

    STATE.editorEntities.forEach(ent => {
        if (ent.update && dt > 0) {
            ent.update(dt);
        }
        // Don't overwrite mesh position while user is actively dragging it with the 3D gizmo
        if (transformControls && transformControls.dragging && STATE.editorSelectedEntity === ent) {
            return;
        }
        if (ent.parentPlanet && ent.parentPlanet.mesh) {
            if (dt > 0) {
                ent.orbitAngle = (ent.orbitAngle || 0) + (ent.orbitSpeed || 0) * dt;
            }
            const pPos = ent.parentPlanet.mesh.position;
            const pScale = Math.max(1.0, ent.parentPlanet.mesh.scale?.x || 1.0);
            const baseR = Number(ent.orbitRadius || 28.0);
            const effectiveR = baseR + (pScale - 1.0) * (baseR * 0.45 + 4.0);
            const ex = pPos.x + Math.cos(ent.orbitAngle) * effectiveR;
            const ez = pPos.z + Math.sin(ent.orbitAngle) * effectiveR;
            ent.position.set(ex, 0, ez);
            if (ent.mesh) {
                ent.mesh.position.set(ex, 0, ez);
            }
        }
    });
}

/**
 * Checks if the player is near any custom editor entity with a bound dialogue node and opens it on [F].
 */
export function triggerNearestEditorEntityInteraction(): boolean {
    const allEntities = getSystemEditableEntities();
    for (const ent of allEntities) {
        if (!ent.dialogNodeId) continue;
        const pos = ent.mesh ? ent.mesh.position : ent.position;
        if (!pos) continue;
        const dist = STATE.playerPosition.distanceTo(pos);
        if (dist <= 28) {
            openNpcDialogue(ent.dialogNodeId);
            return true;
        }
    }
    return false;
}

/**
 * Serializes all editable entities and generates both JSON and TypeScript export code.
 */
export function exportSystemEditorConfig(): SystemEditorExport {
    const sysId = STATE.currentSystemId || 0;
    const activeSys = STATE.universe?.systems?.find((s: any) => s.id === sysId) || { name: `System #${sysId}` };
    const entities = getSystemEditableEntities();

    const serialized: SerializedEditorEntity[] = entities.map((ent, idx) => {
        const pos = ent.mesh ? ent.mesh.position : (ent.position || { x: 0, y: 0, z: 0 });
        const parentName = ent.parentPlanet ? ent.parentPlanet.name : (ent.parentPlanetName || null);
        return {
            id: ent.id || `entity_${idx + 1}`,
            name: ent.name || 'Objekt',
            category: ent.category || 'jamal_shuttle',
            isBuiltIn: Boolean(ent.isBuiltIn),
            builtInKey: ent.builtInKey,
            scale: Number(ent.scale ?? ent.mesh?.scale?.x ?? 1.0),
            rotationY: Number(ent.rotationY ?? Math.round(((ent.mesh?.rotation?.y || 0) * 180) / Math.PI)),
            parentPlanetName: parentName,
            orbitRadius: Number(Math.round((ent.orbitRadius ?? 0) * 100) / 100),
            orbitAngle: Number(Math.round((ent.orbitAngle ?? 0) * 1000) / 1000),
            orbitSpeed: Number(ent.orbitSpeed ?? 0.035),
            position: {
                x: Math.round((pos.x || 0) * 100) / 100,
                y: Math.round((pos.y || 0) * 100) / 100,
                z: Math.round((pos.z || 0) * 100) / 100
            },
            questId: ent.questId || '',
            dialogNodeId: ent.dialogNodeId || '',
            modelSource: ent.modelSource || 'procedural',
            customModelName: ent.customModelName || ''
        };
    });

    const tsLines = serialized.map(s => {
        if (s.parentPlanetName) {
            return `// ${s.name} (${s.category}) -> Orbit um '${s.parentPlanetName}'\n` +
                `spawnEditorAsset('${s.category}', {\n` +
                `    name: ${JSON.stringify(s.name)},\n` +
                `    parentPlanetName: ${JSON.stringify(s.parentPlanetName)},\n` +
                `    orbitRadius: ${s.orbitRadius},\n` +
                `    orbitAngle: ${s.orbitAngle},\n` +
                `    orbitSpeed: ${s.orbitSpeed},\n` +
                `    scale: ${s.scale},${s.dialogNodeId ? `\n    dialogNodeId: ${JSON.stringify(s.dialogNodeId)},` : ''}\n` +
                `});`;
        } else {
            return `// ${s.name} (${s.category}) -> Deep Space\n` +
                `spawnEditorAsset('${s.category}', {\n` +
                `    name: ${JSON.stringify(s.name)},\n` +
                `    position: { x: ${s.position.x}, y: ${s.position.y}, z: ${s.position.z} },\n` +
                `    scale: ${s.scale},${s.dialogNodeId ? `\n    dialogNodeId: ${JSON.stringify(s.dialogNodeId)},` : ''}\n` +
                `});`;
        }
    });

    return {
        systemId: sysId,
        systemName: activeSys.name,
        timestamp: new Date().toISOString(),
        entities: serialized,
        typescriptSnippet: tsLines.join('\n\n')
    };
}

/**
 * Persists the current system's editor overrides & custom spawned objects to localStorage.
 */
export function saveSystemEditorToStorage(systemId?: number): boolean {
    try {
        const sysId = systemId !== undefined ? systemId : (STATE.currentSystemId || 0);
        const exported = exportSystemEditorConfig();
        localStorage.setItem(`najmafar_editor_sys_${sysId}`, JSON.stringify(exported));
        addLogEntry("SYSTEM", `💾 EDITOR: ${exported.entities.length} Objekt(e) für ${exported.systemName} lokal gespeichert.`);
        return true;
    } catch (e) {
        console.error('[WorldEditor] Failed to save to localStorage:', e);
        return false;
    }
}

/**
 * Loads saved editor overrides & custom objects for the given star system from localStorage.
 */
export function loadSystemEditorFromStorage(systemId?: number): boolean {
    try {
        const sysId = systemId !== undefined ? systemId : (STATE.currentSystemId || 0);
        const raw = localStorage.getItem(`najmafar_editor_sys_${sysId}`);
        if (!raw) return false;

        const data: SystemEditorExport = JSON.parse(raw);
        if (!data || !Array.isArray(data.entities)) return false;

        data.entities.forEach(saved => {
            if (saved.isBuiltIn) {
                let target: any = null;
                if (saved.builtInKey === 'jamalShip') target = STATE.jamalShip;
                else if (saved.builtInKey === 'towingDrone') target = STATE.towingDrone;
                else if (saved.builtInKey === 'voyagerProbe') target = STATE.voyagerProbe;
                else if (saved.builtInKey === 'spaceStation' && STATE.spaceStations) {
                    target = STATE.spaceStations.find(s => s.name === saved.name) || STATE.spaceStations[0];
                }

                if (target) {
                    target.name = saved.name;
                    target.scale = saved.scale;
                    target.rotationY = saved.rotationY;
                    target.orbitRadius = saved.orbitRadius;
                    target.orbitAngle = saved.orbitAngle;
                    target.orbitSpeed = saved.orbitSpeed;
                    target.questId = saved.questId;
                    target.dialogNodeId = saved.dialogNodeId;
                    if (saved.parentPlanetName) {
                        const p = activePlanets.find(pl => pl.name === saved.parentPlanetName);
                        if (p) target.parentPlanet = p;
                    } else {
                        target.parentPlanet = null;
                        if (target.position && saved.position) {
                            target.position.set(saved.position.x, saved.position.y || 0, saved.position.z);
                        }
                    }
                    applyEntityTransformToMesh(target);
                }
            } else {
                // Avoid duplicate spawn if already present
                const existing = (STATE.editorEntities || []).find(e => e.id === saved.id);
                if (!existing) {
                    spawnEditorAsset(saved.category, {
                        id: saved.id,
                        name: saved.name,
                        scale: saved.scale,
                        rotationY: saved.rotationY,
                        parentPlanetName: saved.parentPlanetName,
                        orbitRadius: saved.orbitRadius,
                        orbitAngle: saved.orbitAngle,
                        orbitSpeed: saved.orbitSpeed,
                        position: saved.position,
                        questId: saved.questId,
                        dialogNodeId: saved.dialogNodeId
                    });
                }
            }
        });

        return true;
    } catch (e) {
        console.error('[WorldEditor] Failed to load from localStorage:', e);
        return false;
    }
}

/**
 * Clears custom editor entities when leaving a star system.
 */
export function clearCustomEditorEntities() {
    if (STATE.editorEntities) {
        STATE.editorEntities.forEach(ent => {
            if (ent.mesh && scene) {
                scene.remove(ent.mesh);
            }
            const gIdx = STATE.gravitySources.indexOf(ent);
            if (gIdx !== -1) STATE.gravitySources.splice(gIdx, 1);
        });
    }
    STATE.editorEntities = [];
    STATE.editorSelectedEntity = null;
    if (transformControls) {
        transformControls.detach();
    }
}

/**
 * Sets the editor simulation speed (0 = Paused, 1 = 1x, 5 = 5x, 20 = 20x).
 */
export function setEditorTimeScale(scale: number) {
    STATE.editorTimeScale = Math.max(0, scale);
    const btns = document.querySelectorAll('.editor-speed-btn');
    btns.forEach(b => {
        const s = Number((b as HTMLElement).dataset.speed ?? -1);
        b.classList.toggle('active', s === STATE.editorTimeScale);
    });
}

/**
 * Sets the 3D TransformControls gizmo mode ('translate' | 'rotate' | 'scale').
 */
export function setEditorGizmoMode(mode: 'translate' | 'rotate' | 'scale') {
    if (transformControls) {
        transformControls.mode = mode;
    }
    const btns = document.querySelectorAll('.editor-gizmo-btn');
    btns.forEach(b => {
        const m = (b as HTMLElement).dataset.mode;
        b.classList.toggle('active', m === mode);
    });
}

/**
 * Toggles the In-Game World & Quest Editor ("Cosmic Director") on or off.
 */
export function toggleWorldEditor(forceState?: boolean): boolean {
    if (!editorInitialized) {
        initWorldEditor();
    }

    const nextState = typeof forceState === 'boolean' ? forceState : !STATE.editorActive;
    STATE.editorActive = nextState;

    const overlay = document.getElementById('world-editor-overlay');
    const hudContainer = document.getElementById('hud-container');
    const leftScanner = document.getElementById('left-deck-panel');

    if (nextState) {
        // Entering Editor Mode
        STATE.editorTimeScale = 0; // Pause orbits by default for effortless placement
        if (camera) {
            savedCameraPos.copy(camera.position);
            savedCameraUp.copy(camera.up);
            savedCameraFov = camera.fov;

            editorCamTarget.copy(STATE.playerPosition);
            editorCamPos.set(STATE.playerPosition.x, 85, STATE.playerPosition.z + 75);
            editorYaw = 0;
            editorPitch = -0.82;
            camera.position.copy(editorCamPos);
            camera.up.set(0, 1, 0);
            camera.lookAt(editorCamTarget);
        }

        if (overlay) overlay.classList.remove('hidden');
        if (hudContainer) hudContainer.style.opacity = '0.15';
        if (leftScanner) leftScanner.classList.remove('visible');

        // Auto-select Jamal's ship, first space station, or first planet if nothing is selected
        if (!STATE.editorSelectedEntity) {
            const editables = getSystemEditableEntities();
            if (editables.length > 0) {
                selectEditorEntity(editables[0]);
                focusEditorCameraOn(editables[0]);
            } else if (activePlanets.length > 0) {
                selectEditorEntity(activePlanets[0]);
                focusEditorCameraOn(activePlanets[0]);
            }
        } else {
            selectEditorEntity(STATE.editorSelectedEntity);
        }

        setEditorTimeScale(0);
        renderEditorOutliner();
        renderEditorInspector();
        updateEditorVisualGuides();
    } else {
        // Exiting Editor Mode -> Back to Ship Gameplay
        if (transformControls) {
            transformControls.detach();
        }
        if (orbitGuideGroup) {
            orbitGuideGroup.visible = false;
        }
        if (overlay) overlay.classList.add('hidden');
        if (hudContainer) hudContainer.style.opacity = '1';

        if (camera) {
            camera.up.copy(savedCameraUp);
            camera.fov = savedCameraFov;
            camera.updateProjectionMatrix();
        }
    }

    return STATE.editorActive;
}

export function isWorldEditorOpen(): boolean {
    return Boolean(STATE.editorActive);
}

/**
 * Frame update called from main.ts when `STATE.editorActive` is true.
 * Handles Editor Free-Fly Camera movement and optional time-scaled orbital preview!
 */
export function updateWorldEditor(dt: number) {
    if (!STATE.editorActive) return;

    // 1. Free-Fly Camera Locomotion (WASD / Arrows + Shift boost + Q/E altitude)
    const speed = (editorKeys['shift'] ? 140.0 : 58.0) * dt;
    const forward = new THREE.Vector3(Math.sin(editorYaw), 0, -Math.cos(editorYaw));
    const right = new THREE.Vector3(Math.cos(editorYaw), 0, Math.sin(editorYaw));

    if (editorKeys['w'] || editorKeys['arrowup']) {
        editorCamPos.addScaledVector(forward, speed);
    }
    if (editorKeys['s'] || editorKeys['arrowdown']) {
        editorCamPos.addScaledVector(forward, -speed);
    }
    if (editorKeys['a'] || editorKeys['arrowleft']) {
        editorCamPos.addScaledVector(right, -speed);
    }
    if (editorKeys['d'] || editorKeys['arrowright']) {
        editorCamPos.addScaledVector(right, speed);
    }
    if (editorKeys['q']) {
        editorCamPos.y = Math.max(8.0, editorCamPos.y - speed * 0.8);
    }
    if (editorKeys['e']) {
        editorCamPos.y = Math.min(480.0, editorCamPos.y + speed * 0.8);
    }

    if (camera) {
        camera.position.copy(editorCamPos);
        camera.up.set(0, 1, 0);
        const lookDir = new THREE.Vector3(
            Math.sin(editorYaw) * Math.cos(editorPitch),
            Math.sin(editorPitch),
            -Math.cos(editorYaw) * Math.cos(editorPitch)
        );
        editorCamTarget.copy(editorCamPos).addScaledVector(lookDir, 60.0);
        camera.lookAt(editorCamTarget);
    }

    updateEditorVisualGuides();
}

/**
 * Updates live numeric readouts in the Inspector without rebuilding the entire DOM while dragging.
 */
function refreshInspectorValuesLive() {
    const sel = STATE.editorSelectedEntity;
    if (!sel) return;

    const rSlider = document.getElementById('ed-prop-orbit-radius') as HTMLInputElement | null;
    const rNum = document.getElementById('ed-prop-orbit-radius-num') as HTMLInputElement | null;
    const aSlider = document.getElementById('ed-prop-orbit-angle') as HTMLInputElement | null;
    const aNum = document.getElementById('ed-prop-orbit-angle-num') as HTMLInputElement | null;
    const safetyBadge = document.getElementById('ed-orbit-safety-badge');

    if (rSlider && rNum && sel.orbitRadius !== undefined) {
        rSlider.value = String(sel.orbitRadius);
        rNum.value = String(sel.orbitRadius);
    }
    if (aSlider && aNum && sel.orbitAngle !== undefined) {
        const deg = Math.round((sel.orbitAngle * 180) / Math.PI);
        aSlider.value = String(deg);
        aNum.value = String(deg);
    }
    if (safetyBadge && sel.parentPlanet) {
        const safety = isEntityOrbitSafe(sel);
        safetyBadge.innerHTML = safety.safe
            ? `<span style="color:#10b981;">🟢 Sicherer Orbit (Min: ${safety.minSafeRadius} AE)</span>`
            : `<span style="color:#ef4444;font-weight:700;">🔴 KOLLISION bei 2.85x Zoom! (Min: ${safety.minSafeRadius} AE)</span>`;
    }

    const posX = document.getElementById('ed-prop-pos-x') as HTMLInputElement | null;
    const posZ = document.getElementById('ed-prop-pos-z') as HTMLInputElement | null;
    if (posX && sel.mesh) posX.value = String(Math.round(sel.mesh.position.x * 10) / 10);
    if (posZ && sel.mesh) posZ.value = String(Math.round(sel.mesh.position.z * 10) / 10);
}

/**
 * Renders the Left-Side Hierarchical Scene Outliner.
 */
export function renderEditorOutliner() {
    const listEl = document.getElementById('editor-outliner-list');
    if (!listEl) return;

    const sysId = STATE.currentSystemId || 0;
    const activeSys = STATE.universe?.systems?.find((s: any) => s.id === sysId) || { name: `Sektor #${sysId}` };
    const sysTitleEl = document.getElementById('editor-system-title');
    if (sysTitleEl) {
        sysTitleEl.innerText = `${activeSys.name} (ID: ${sysId})`;
    }

    const editables = getSystemEditableEntities();
    const planets = activePlanets.filter(p => !p.isMoon);
    const moons = activePlanets.filter(p => p.isMoon);

    let html = '';

    // 1. Planets & their Orbital Children
    planets.forEach((p, idx) => {
        const isPlanetSel = STATE.editorSelectedEntity === p;
        html += `
            <div class="editor-tree-item planet-item ${isPlanetSel ? 'selected' : ''}" data-planet-idx="${idx}">
                <span class="tree-icon">🪐</span>
                <span class="tree-label">${p.name} <small style="opacity:0.6;">(r=${p.size})</small></span>
                <button class="tree-focus-btn" data-focus-planet="${idx}" title="Kamera fokussieren">🎯</button>
            </div>
        `;

        // Moons of this planet
        const childMoons = moons.filter(m => m.parentPlanet === p);
        childMoons.forEach(m => {
            const mIdx = activePlanets.indexOf(m);
            const isMSel = STATE.editorSelectedEntity === m;
            html += `
                <div class="editor-tree-item child-item ${isMSel ? 'selected' : ''}" data-planet-idx="${mIdx}">
                    <span class="tree-icon">🌑</span>
                    <span class="tree-label">${m.name}</span>
                    <button class="tree-focus-btn" data-focus-planet="${mIdx}" title="Kamera fokussieren">🎯</button>
                </div>
            `;
        });

        // Stations & Vessels orbiting this planet
        const orbitalEntities = editables.filter(e => e.parentPlanet === p);
        orbitalEntities.forEach(ent => {
            const eIdx = editables.indexOf(ent);
            const isESel = STATE.editorSelectedEntity === ent;
            const icon = ent.category === 'space_station' || ent.category === 'trade_hub' ? '🛰️'
                : (ent.category === 'towing_drone' ? '🤖'
                : (ent.category === 'derelict_wreck' ? '💥'
                : (ent.category === 'psionic_anomaly' ? '🌌' : '🚀')));
            const safety = isEntityOrbitSafe(ent);
            const warnBadge = !safety.safe ? `<span title="Kollisionsgefahr!" style="color:#ef4444;margin-left:4px;">⚠️</span>` : '';
            html += `
                <div class="editor-tree-item child-item ${isESel ? 'selected' : ''}" data-entity-idx="${eIdx}">
                    <span class="tree-icon">${icon}</span>
                    <span class="tree-label">${ent.name}${warnBadge}</span>
                    <button class="tree-focus-btn" data-focus-entity="${eIdx}" title="Kamera fokussieren">🎯</button>
                </div>
            `;
        });
    });

    // 2. Deep Space (Unbound) Entities
    const deepSpaceEntities = editables.filter(e => !e.parentPlanet);
    if (deepSpaceEntities.length > 0) {
        html += `<div class="editor-tree-section">🌌 TIEFRAUM (DEEP SPACE)</div>`;
        deepSpaceEntities.forEach(ent => {
            const eIdx = editables.indexOf(ent);
            const isESel = STATE.editorSelectedEntity === ent;
            const icon = ent.category === 'voyager_probe' ? '🛰️'
                : (ent.category === 'derelict_wreck' ? '💥'
                : (ent.category === 'psionic_anomaly' ? '🌌' : '🚀'));
            html += `
                <div class="editor-tree-item ${isESel ? 'selected' : ''}" data-entity-idx="${eIdx}">
                    <span class="tree-icon">${icon}</span>
                    <span class="tree-label">${ent.name}</span>
                    <button class="tree-focus-btn" data-focus-entity="${eIdx}" title="Kamera fokussieren">🎯</button>
                </div>
            `;
        });
    }

    listEl.innerHTML = html;

    // Bind click listeners
    listEl.querySelectorAll('[data-entity-idx]').forEach(el => {
        el.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).classList.contains('tree-focus-btn')) return;
            const idx = Number((el as HTMLElement).dataset.entityIdx);
            if (editables[idx]) selectEditorEntity(editables[idx]);
        });
    });
    listEl.querySelectorAll('[data-planet-idx]').forEach(el => {
        el.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).classList.contains('tree-focus-btn')) return;
            const idx = Number((el as HTMLElement).dataset.planetIdx);
            if (activePlanets[idx]) selectEditorEntity(activePlanets[idx]);
        });
    });
    listEl.querySelectorAll('[data-focus-entity]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = Number((btn as HTMLElement).dataset.focusEntity);
            if (editables[idx]) {
                selectEditorEntity(editables[idx]);
                focusEditorCameraOn(editables[idx]);
            }
        });
    });
    listEl.querySelectorAll('[data-focus-planet]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = Number((btn as HTMLElement).dataset.focusPlanet);
            if (activePlanets[idx]) {
                selectEditorEntity(activePlanets[idx]);
                focusEditorCameraOn(activePlanets[idx]);
            }
        });
    });
}

/**
 * Renders the Right-Side Property Inspector for the currently selected entity.
 */
export function renderEditorInspector() {
    const bodyEl = document.getElementById('editor-inspector-body');
    if (!bodyEl) return;

    const sel = STATE.editorSelectedEntity;
    if (!sel) {
        bodyEl.innerHTML = `<div style="color:#64748b;font-size:0.82rem;padding:16px;text-align:center;">Wähle links im Szenen-Baum oder im 3D-Viewport ein Objekt aus, oder spawne unten ein neues Asset.</div>`;
        return;
    }

    const isPlanet = Boolean(sel.distance !== undefined && sel.source !== undefined);
    const pos = sel.mesh ? sel.mesh.position : (sel.position || { x: 0, y: 0, z: 0 });
    const curScale = Number(sel.scale ?? sel.mesh?.scale?.x ?? 1.0);
    const curRotDeg = Math.round(sel.rotationY ?? ((sel.mesh?.rotation?.y || 0) * 180) / Math.PI);

    if (isPlanet) {
        const minSafe = getPlanetMinSafeOrbitRadius(sel);
        bodyEl.innerHTML = `
            <div class="ed-field-group">
                <label class="ed-label">Himmelskörper</label>
                <div style="font-weight:700;color:#f8fafc;font-size:0.95rem;">🪐 ${sel.name}</div>
                <div style="color:#94a3b8;font-size:0.76rem;margin-top:4px;">Typ: ${sel.type} • Basis-Radius: ${sel.size} AE</div>
                <div style="color:#10b981;font-size:0.76rem;margin-top:4px;">🟢 Min. sicherer Stations-Orbit: <b>${minSafe} AE</b></div>
            </div>
            <div class="ed-field-group">
                <button id="ed-spawn-on-planet-btn" class="ed-action-btn primary" style="width:100%;">+ Objekt in sicheren Orbit setzen</button>
                <button id="ed-teleport-player-btn" class="ed-action-btn" style="width:100%;margin-top:6px;">🚀 Spielerschiff hierhin teleportieren</button>
            </div>
        `;
        document.getElementById('ed-spawn-on-planet-btn')?.addEventListener('click', () => {
            spawnEditorAsset('space_station', { parentPlanet: sel });
        });
        document.getElementById('ed-teleport-player-btn')?.addEventListener('click', () => {
            teleportPlayerToSelectedEntity();
        });
        return;
    }

    const planets = activePlanets.filter(p => !p.isMoon);
    const parentName = sel.parentPlanet ? sel.parentPlanet.name : '__deep_space__';
    const orbitRadius = Math.round((sel.orbitRadius ?? 28) * 10) / 10;
    const orbitAngleDeg = Math.round(((sel.orbitAngle ?? 0) * 180) / Math.PI);
    const orbitSpeed = Number(sel.orbitSpeed ?? 0.035);
    const safety = isEntityOrbitSafe(sel);

    const dialogueKeys = Object.keys(DIALOGUE_NODES || {});
    const dialogueOptionsHtml = [
        `<option value="">-- Kein Dialog verknüpft --</option>`,
        ...dialogueKeys.map(k => `<option value="${k}" ${sel.dialogNodeId === k ? 'selected' : ''}>${k} (${DIALOGUE_NODES[k]?.speakerName || 'NPC'})</option>`)
    ].join('');

    const planetOptionsHtml = [
        `<option value="__deep_space__" ${parentName === '__deep_space__' ? 'selected' : ''}>🌌 Frei im System (Deep Space)</option>`,
        ...planets.map(p => `<option value="${p.name}" ${parentName === p.name ? 'selected' : ''}>🪐 Orbit: ${p.name}</option>`)
    ].join('');

    bodyEl.innerHTML = `
        <div class="ed-field-group">
            <label class="ed-label">Bezeichnung / Name</label>
            <input id="ed-prop-name" class="ed-input" type="text" value="${(sel.name || '').replace(/"/g, '&quot;')}" />
        </div>

        <div class="ed-field-group">
            <label class="ed-label">Größe / Skalierung (Scale: <span id="ed-scale-val">${curScale.toFixed(2)}x</span>)</label>
            <div class="ed-slider-row">
                <input id="ed-prop-scale" type="range" min="0.1" max="6.0" step="0.05" value="${curScale}" />
                <input id="ed-prop-scale-num" class="ed-num-input" type="number" step="0.05" min="0.1" max="10" value="${curScale}" />
            </div>
        </div>

        <div class="ed-field-group">
            <label class="ed-label">Rotation Y (${curRotDeg}°)</label>
            <div class="ed-slider-row">
                <input id="ed-prop-rot" type="range" min="-180" max="180" step="1" value="${curRotDeg}" />
                <input id="ed-prop-rot-num" class="ed-num-input" type="number" step="5" value="${curRotDeg}" />
            </div>
        </div>

        <div class="ed-field-group">
            <label class="ed-label">Orbit-Bindung (Parent)</label>
            <select id="ed-prop-parent" class="ed-select">${planetOptionsHtml}</select>
        </div>

        ${sel.parentPlanet ? `
            <div class="ed-field-group" style="background:rgba(15,23,42,0.65);padding:8px;border-radius:6px;border:1px solid rgba(56,189,248,0.2);">
                <label class="ed-label">Orbit-Radius (AE)</label>
                <div class="ed-slider-row">
                    <input id="ed-prop-orbit-radius" type="range" min="5" max="140" step="0.5" value="${orbitRadius}" />
                    <input id="ed-prop-orbit-radius-num" class="ed-num-input" type="number" step="0.5" value="${orbitRadius}" />
                </div>
                <div id="ed-orbit-safety-badge" style="font-size:0.74rem;margin-top:4px;">
                    ${safety.safe
                        ? `<span style="color:#10b981;">🟢 Sicherer Orbit (Min: ${safety.minSafeRadius} AE)</span>`
                        : `<span style="color:#ef4444;font-weight:700;">🔴 KOLLISION bei 2.85x Zoom! (Min: ${safety.minSafeRadius} AE)</span>`}
                </div>
                ${!safety.safe ? `<button id="ed-snap-safe-btn" class="ed-action-btn primary" style="width:100%;margin-top:6px;">⚡ Auf sicheren Orbit setzen (${(safety.minSafeRadius + 8).toFixed(1)} AE)</button>` : ''}

                <label class="ed-label" style="margin-top:8px;">Orbit-Winkel (0°–360°)</label>
                <div class="ed-slider-row">
                    <input id="ed-prop-orbit-angle" type="range" min="0" max="360" step="1" value="${orbitAngleDeg}" />
                    <input id="ed-prop-orbit-angle-num" class="ed-num-input" type="number" step="5" value="${orbitAngleDeg}" />
                </div>

                <label class="ed-label" style="margin-top:8px;">Umlauf-Speed (rad/s)</label>
                <input id="ed-prop-orbit-speed" class="ed-input" type="number" step="0.005" value="${orbitSpeed}" />
            </div>
        ` : `
            <div class="ed-field-group">
                <label class="ed-label">Tiefraum-Koordinaten (X / Z in AE)</label>
                <div style="display:flex;gap:6px;">
                    <input id="ed-prop-pos-x" class="ed-input" type="number" step="1" value="${Math.round(pos.x * 10) / 10}" placeholder="X" />
                    <input id="ed-prop-pos-z" class="ed-input" type="number" step="1" value="${Math.round(pos.z * 10) / 10}" placeholder="Z" />
                </div>
            </div>
        `}

        <div class="ed-field-group">
            <label class="ed-label">Dialog bei Interaktion [F]</label>
            <select id="ed-prop-dialog" class="ed-select">${dialogueOptionsHtml}</select>
        </div>

        <div class="ed-field-group" style="border-top:1px solid rgba(148,163,184,0.15);padding-top:8px;">
            <label class="ed-label">3D-Modell Quelle (${sel.modelSource === 'custom_glb' ? `GLB: ${sel.customModelName}` : 'Prozedural'})</label>
            <input id="ed-glb-file-input" type="file" accept=".glb,.gltf" style="display:none;" />
            <button id="ed-load-glb-btn" class="ed-action-btn" style="width:100%;">📂 Eigenes .GLB / .GLTF Modell laden...</button>
        </div>

        <div class="ed-field-group" style="display:flex;flex-direction:column;gap:6px;border-top:1px solid rgba(148,163,184,0.15);padding-top:8px;">
            <button id="ed-teleport-player-btn" class="ed-action-btn primary">🚀 Spielerschiff hierhin teleportieren</button>
            <button id="ed-copy-entity-code-btn" class="ed-action-btn">📋 Objekt-Code in Zwischenablage</button>
            ${!sel.isBuiltIn ? `<button id="ed-delete-entity-btn" class="ed-action-btn danger">🗑️ Objekt löschen</button>` : ''}
        </div>
    `;

    // Wire up Inspector listeners
    const nameInput = document.getElementById('ed-prop-name') as HTMLInputElement | null;
    nameInput?.addEventListener('change', () => updateSelectedEntityProperties({ name: nameInput.value }));

    const scaleSlider = document.getElementById('ed-prop-scale') as HTMLInputElement | null;
    const scaleNum = document.getElementById('ed-prop-scale-num') as HTMLInputElement | null;
    scaleSlider?.addEventListener('input', () => {
        const v = Number(scaleSlider.value);
        if (scaleNum) scaleNum.value = String(v);
        const lbl = document.getElementById('ed-scale-val');
        if (lbl) lbl.innerText = `${v.toFixed(2)}x`;
        sel.scale = v;
        if (sel.mesh) sel.mesh.scale.set(v, v, v);
        updateEditorVisualGuides();
    });
    scaleNum?.addEventListener('change', () => updateSelectedEntityProperties({ scale: Number(scaleNum.value) }));

    const rotSlider = document.getElementById('ed-prop-rot') as HTMLInputElement | null;
    const rotNum = document.getElementById('ed-prop-rot-num') as HTMLInputElement | null;
    rotSlider?.addEventListener('input', () => {
        const v = Number(rotSlider.value);
        if (rotNum) rotNum.value = String(v);
        sel.rotationY = v;
        if (sel.mesh) sel.mesh.rotation.y = (v * Math.PI) / 180;
    });
    rotNum?.addEventListener('change', () => updateSelectedEntityProperties({ rotationY: Number(rotNum.value) }));

    const parentSelect = document.getElementById('ed-prop-parent') as HTMLSelectElement | null;
    parentSelect?.addEventListener('change', () => {
        updateSelectedEntityProperties({ parentPlanetName: parentSelect.value });
    });

    const rSlider = document.getElementById('ed-prop-orbit-radius') as HTMLInputElement | null;
    const rNum = document.getElementById('ed-prop-orbit-radius-num') as HTMLInputElement | null;
    rSlider?.addEventListener('input', () => {
        sel.orbitRadius = Number(rSlider.value);
        applyEntityTransformToMesh(sel);
        refreshInspectorValuesLive();
    });
    rNum?.addEventListener('change', () => updateSelectedEntityProperties({ orbitRadius: Number(rNum.value) }));

    document.getElementById('ed-snap-safe-btn')?.addEventListener('click', () => {
        snapSelectedEntityToSafeOrbit();
    });

    const aSlider = document.getElementById('ed-prop-orbit-angle') as HTMLInputElement | null;
    const aNum = document.getElementById('ed-prop-orbit-angle-num') as HTMLInputElement | null;
    aSlider?.addEventListener('input', () => {
        sel.orbitAngle = (Number(aSlider.value) * Math.PI) / 180;
        applyEntityTransformToMesh(sel);
        refreshInspectorValuesLive();
    });
    aNum?.addEventListener('change', () => {
        updateSelectedEntityProperties({ orbitAngle: (Number(aNum.value) * Math.PI) / 180 });
    });

    const speedInput = document.getElementById('ed-prop-orbit-speed') as HTMLInputElement | null;
    speedInput?.addEventListener('change', () => {
        updateSelectedEntityProperties({ orbitSpeed: Number(speedInput.value) });
    });

    const posX = document.getElementById('ed-prop-pos-x') as HTMLInputElement | null;
    const posZ = document.getElementById('ed-prop-pos-z') as HTMLInputElement | null;
    const onPosChange = () => {
        if (!posX || !posZ) return;
        updateSelectedEntityProperties({
            position: { x: Number(posX.value), y: 0, z: Number(posZ.value) }
        });
    };
    posX?.addEventListener('change', onPosChange);
    posZ?.addEventListener('change', onPosChange);

    const dialogSelect = document.getElementById('ed-prop-dialog') as HTMLSelectElement | null;
    dialogSelect?.addEventListener('change', () => {
        updateSelectedEntityProperties({ dialogNodeId: dialogSelect.value });
    });

    const glbInput = document.getElementById('ed-glb-file-input') as HTMLInputElement | null;
    document.getElementById('ed-load-glb-btn')?.addEventListener('click', () => {
        glbInput?.click();
    });
    glbInput?.addEventListener('change', () => {
        if (glbInput.files && glbInput.files[0]) {
            loadCustomGlbForEntity(sel, glbInput.files[0]);
        }
    });

    document.getElementById('ed-teleport-player-btn')?.addEventListener('click', () => {
        teleportPlayerToSelectedEntity();
    });

    document.getElementById('ed-copy-entity-code-btn')?.addEventListener('click', () => {
        const exp = exportSystemEditorConfig();
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(exp.typescriptSnippet);
        }
        showEditorExportModal(exp);
    });

    document.getElementById('ed-delete-entity-btn')?.addEventListener('click', () => {
        deleteEditorEntity(sel);
    });
}

/**
 * Displays the Code / JSON Export Modal with 1-click Copy.
 */
export function showEditorExportModal(exported?: SystemEditorExport) {
    const data = exported || exportSystemEditorConfig();
    const modal = document.getElementById('editor-export-modal');
    const textarea = document.getElementById('editor-export-textarea') as HTMLTextAreaElement | null;
    if (!modal || !textarea) return;

    const combinedOutput = `// === TYPESCRIPT SPAWN SNIPPET (${data.systemName}) ===\n${data.typescriptSnippet}\n\n// === RAW JSON CONFIG ===\n${JSON.stringify(data, null, 2)}`;
    textarea.value = combinedOutput;
    modal.classList.remove('hidden');
}

/**
 * Injects the Editor DOM Overlay and CSS into the document if not already present,
 * and initializes Three.js TransformControls and keyboard/mouse listeners.
 */
export function initWorldEditor() {
    if (editorInitialized) return;
    editorInitialized = true;

    if (typeof document !== 'undefined' && !document.getElementById('world-editor-overlay')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'world-editor-styles';
        styleEl.innerHTML = `
            #world-editor-overlay.hidden, #editor-export-modal.hidden { display: none !important; }
            #world-editor-overlay {
                position: fixed; inset: 0; pointer-events: none; z-index: 8500;
                font-family: 'Outfit', sans-serif; color: #f8fafc;
            }
            .editor-topbar {
                position: absolute; top: 10px; left: 16px; right: 16px; height: 46px;
                background: rgba(9, 14, 28, 0.92); border: 1px solid rgba(56, 189, 248, 0.35);
                border-radius: 10px; display: flex; align-items: center; justify-content: space-between;
                padding: 0 14px; pointer-events: auto; backdrop-filter: blur(12px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.65);
            }
            .editor-brand { display: flex; align-items: center; gap: 10px; font-family: 'Orbitron', sans-serif; font-size: 0.82rem; font-weight: 700; color: #38bdf8; }
            .editor-toolbar-group { display: flex; align-items: center; gap: 6px; }
            .editor-btn {
                background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(148, 163, 184, 0.25);
                color: #e2e8f0; padding: 5px 10px; border-radius: 6px; font-size: 0.75rem;
                cursor: pointer; transition: all 0.15s ease;
            }
            .editor-btn:hover { border-color: #38bdf8; color: #ffffff; background: rgba(56, 189, 248, 0.18); }
            .editor-btn.active { background: rgba(56, 189, 248, 0.28); border-color: #38bdf8; color: #38bdf8; font-weight: 700; }
            .editor-btn.accent { background: rgba(16, 185, 129, 0.2); border-color: #10b981; color: #34d399; }
            .editor-sidebar-left {
                position: absolute; top: 66px; left: 16px; bottom: 74px; width: 270px;
                background: rgba(9, 14, 28, 0.9); border: 1px solid rgba(56, 189, 248, 0.28);
                border-radius: 10px; display: flex; flex-direction: column; pointer-events: auto;
                backdrop-filter: blur(12px); overflow: hidden;
            }
            .editor-sidebar-right {
                position: absolute; top: 66px; right: 16px; bottom: 74px; width: 310px;
                background: rgba(9, 14, 28, 0.9); border: 1px solid rgba(56, 189, 248, 0.28);
                border-radius: 10px; display: flex; flex-direction: column; pointer-events: auto;
                backdrop-filter: blur(12px); overflow: hidden;
            }
            .editor-panel-header {
                padding: 10px 12px; font-family: 'Orbitron', sans-serif; font-size: 0.74rem;
                font-weight: 700; color: #38bdf8; border-bottom: 1px solid rgba(148, 163, 184, 0.15);
                display: flex; justify-content: space-between; align-items: center;
            }
            .editor-panel-scroll { flex: 1; overflow-y: auto; padding: 8px; }
            .editor-tree-section { font-size: 0.68rem; font-weight: 700; color: #94a3b8; margin: 10px 4px 4px; letter-spacing: 0.06em; }
            .editor-tree-item {
                display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 6px;
                cursor: pointer; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 2px;
            }
            .editor-tree-item.child-item { padding-left: 22px; font-size: 0.77rem; }
            .editor-tree-item:hover { background: rgba(56, 189, 248, 0.12); color: #ffffff; }
            .editor-tree-item.selected { background: rgba(56, 189, 248, 0.24); border-left: 3px solid #38bdf8; color: #ffffff; font-weight: 600; }
            .tree-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .tree-focus-btn { background: transparent; border: none; cursor: pointer; font-size: 0.8rem; opacity: 0.65; }
            .tree-focus-btn:hover { opacity: 1; transform: scale(1.15); }
            .ed-field-group { margin-bottom: 10px; }
            .ed-label { display: block; font-size: 0.72rem; color: #94a3b8; margin-bottom: 4px; }
            .ed-input, .ed-select {
                width: 100%; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(148, 163, 184, 0.3);
                color: #f8fafc; padding: 6px 8px; border-radius: 6px; font-size: 0.8rem; box-sizing: border-box;
            }
            .ed-slider-row { display: flex; align-items: center; gap: 8px; }
            .ed-slider-row input[type="range"] { flex: 1; accent-color: #38bdf8; }
            .ed-num-input {
                width: 64px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(148, 163, 184, 0.3);
                color: #f8fafc; padding: 4px 6px; border-radius: 5px; font-size: 0.78rem;
            }
            .ed-action-btn {
                background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(148, 163, 184, 0.3);
                color: #e2e8f0; padding: 7px 10px; border-radius: 6px; font-size: 0.78rem; cursor: pointer;
            }
            .ed-action-btn.primary { background: rgba(56, 189, 248, 0.2); border-color: #38bdf8; color: #38bdf8; font-weight: 600; }
            .ed-action-btn.danger { background: rgba(239, 68, 68, 0.18); border-color: #ef4444; color: #fca5a5; }
            .editor-bottombar {
                position: absolute; bottom: 12px; left: 16px; right: 16px; height: 52px;
                background: rgba(9, 14, 28, 0.92); border: 1px solid rgba(56, 189, 248, 0.35);
                border-radius: 10px; display: flex; align-items: center; justify-content: space-between;
                padding: 0 14px; pointer-events: auto; backdrop-filter: blur(12px);
            }
            .editor-spawn-palette { display: flex; align-items: center; gap: 6px; overflow-x: auto; }
            #editor-export-modal {
                position: fixed; inset: 0; background: rgba(2, 6, 23, 0.82); z-index: 9200;
                display: flex; align-items: center; justify-content: center; pointer-events: auto;
            }
            .editor-modal-card {
                width: 680px; max-width: 92vw; background: #0f172a; border: 1px solid #38bdf8;
                border-radius: 12px; padding: 16px; color: #f8fafc;
            }
        `;
        if (document.head) document.head.appendChild(styleEl);

        const overlay = document.createElement('div');
        overlay.id = 'world-editor-overlay';
        overlay.className = 'hidden';
        overlay.innerHTML = `
            <header class="editor-topbar">
                <div class="editor-brand">
                    <span>🛠️ COSMIC DIRECTOR</span>
                    <span id="editor-system-title" style="color:#94a3b8;font-size:0.75rem;">System</span>
                </div>
                <div class="editor-toolbar-group">
                    <span style="font-size:0.72rem;color:#94a3b8;margin-right:4px;">ORBIT-ZEIT:</span>
                    <button class="editor-btn editor-speed-btn active" data-speed="0">⏸️ Pause</button>
                    <button class="editor-btn editor-speed-btn" data-speed="1">▶️ 1x</button>
                    <button class="editor-btn editor-speed-btn" data-speed="5">⏩ 5x</button>
                    <button class="editor-btn editor-speed-btn" data-speed="20">⏫ 20x</button>
                </div>
                <div class="editor-toolbar-group">
                    <span style="font-size:0.72rem;color:#94a3b8;margin-right:4px;">3D-GIZMO:</span>
                    <button class="editor-btn editor-gizmo-btn active" data-mode="translate">✥ Move [T]</button>
                    <button class="editor-btn editor-gizmo-btn" data-mode="rotate">↻ Rotate [R]</button>
                    <button class="editor-btn editor-gizmo-btn" data-mode="scale">⤢ Scale [Y]</button>
                </div>
                <div class="editor-toolbar-group">
                    <button id="editor-save-local-btn" class="editor-btn accent">💾 Lokal Speichern</button>
                    <button id="editor-export-btn" class="editor-btn">📋 JSON / TS Export</button>
                    <button id="editor-close-btn" class="editor-btn" style="border-color:#f43f5e;color:#fda4af;">✕ Spiel fortsetzen [F1]</button>
                </div>
            </header>

            <aside class="editor-sidebar-left">
                <div class="editor-panel-header">
                    <span>SZENEN-BAUM (OUTLINER)</span>
                </div>
                <div id="editor-outliner-list" class="editor-panel-scroll"></div>
            </aside>

            <aside class="editor-sidebar-right">
                <div class="editor-panel-header">
                    <span>EIGENSCHAFTEN (INSPECTOR)</span>
                </div>
                <div id="editor-inspector-body" class="editor-panel-scroll"></div>
            </aside>

            <footer class="editor-bottombar">
                <div class="editor-spawn-palette">
                    <span style="font-size:0.72rem;font-weight:700;color:#38bdf8;margin-right:4px;">+ ASSET SPAWNEN:</span>
                    <button class="editor-btn" data-spawn="jamal_shuttle">🚀 Forschungsschiff</button>
                    <button class="editor-btn" data-spawn="towing_drone">🤖 Abschleppdrohne</button>
                    <button class="editor-btn" data-spawn="space_station">🛰️ INSAN-Zitadelle</button>
                    <button class="editor-btn" data-spawn="trade_hub">🛸 Handels-Station</button>
                    <button class="editor-btn" data-spawn="voyager_probe">🛰️ Voyager-Sonde</button>
                    <button class="editor-btn" data-spawn="derelict_wreck">💥 Schiffswrack</button>
                    <button class="editor-btn" data-spawn="psionic_anomaly">🌌 Psio-Anomalie</button>
                </div>
                <div style="font-size:0.72rem;color:#94a3b8;">
                    Kamera: <b>WASD</b> Fliegen • <b>Q/E</b> Höhe • <b>Rechtsklick</b> Umschauen • <b>Mausrad</b> Zoom
                </div>
            </footer>

            <div id="editor-export-modal" class="hidden">
                <div class="editor-modal-card">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                        <strong style="color:#38bdf8;font-family:'Orbitron',sans-serif;">📋 SYSTEM- & QUEST-KONFIGURATION EXPORT</strong>
                        <button id="editor-export-close-btn" class="editor-btn">✕ Schließen</button>
                    </div>
                    <textarea id="editor-export-textarea" rows="16" style="width:100%;background:#020617;color:#38bdf8;border:1px solid #334155;border-radius:8px;padding:10px;font-family:monospace;font-size:0.76rem;box-sizing:border-box;"></textarea>
                    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
                        <button id="editor-export-copy-btn" class="ed-action-btn primary">📋 In Zwischenablage kopieren</button>
                    </div>
                </div>
            </div>
        `;
        if (document.body) document.body.appendChild(overlay);

        // Bind Topbar & Bottombar buttons
        overlay.querySelectorAll('.editor-speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                setEditorTimeScale(Number((btn as HTMLElement).dataset.speed || 0));
            });
        });
        overlay.querySelectorAll('.editor-gizmo-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = ((btn as HTMLElement).dataset.mode || 'translate') as 'translate' | 'rotate' | 'scale';
                setEditorGizmoMode(mode);
            });
        });
        overlay.querySelectorAll('[data-spawn]').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = (btn as HTMLElement).dataset.spawn as EditorAssetCategory;
                spawnEditorAsset(cat);
            });
        });

        document.getElementById('editor-save-local-btn')?.addEventListener('click', () => {
            saveSystemEditorToStorage();
        });
        document.getElementById('editor-export-btn')?.addEventListener('click', () => {
            showEditorExportModal();
        });
        document.getElementById('editor-close-btn')?.addEventListener('click', () => {
            toggleWorldEditor(false);
        });
        document.getElementById('editor-export-close-btn')?.addEventListener('click', () => {
            document.getElementById('editor-export-modal')?.classList.add('hidden');
        });
        document.getElementById('editor-export-copy-btn')?.addEventListener('click', () => {
            const ta = document.getElementById('editor-export-textarea') as HTMLTextAreaElement | null;
            if (ta && navigator?.clipboard?.writeText) {
                navigator.clipboard.writeText(ta.value);
                addLogEntry("SYSTEM", "📋 Editor-Code in die Zwischenablage kopiert!");
            }
        });
    }

    // Initialize Three.js TransformControls if renderer & camera exist
    if (camera && renderer && renderer.domElement && !transformControls) {
        try {
            transformControls = new TransformControls(camera, renderer.domElement);
            transformControls.size = 0.95;
            transformHelper = transformControls.getHelper();
            scene.add(transformHelper);

            transformControls.addEventListener('objectChange', () => {
                if (STATE.editorSelectedEntity) {
                    syncEntityOrbitFromWorldPosition(STATE.editorSelectedEntity);
                }
            });
        } catch (e) {
            // Ignore in headless test environment
        }
    }

    ensureOrbitGuideGroup();

    // Global Keyboard & Mouse Listeners for Editor Mode
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

            if (e.key === 'F1') {
                e.preventDefault();
                if (STATE.gameStarted && !STATE.prologueActive) {
                    toggleWorldEditor();
                }
                return;
            }

            if (!STATE.editorActive || isTyping) return;

            const k = e.key.toLowerCase();
            editorKeys[k] = true;
            if (e.shiftKey) editorKeys['shift'] = true;

            if (k === 't') setEditorGizmoMode('translate');
            else if (k === 'r') setEditorGizmoMode('rotate');
            else if (k === 'y') setEditorGizmoMode('scale');
            else if (k === 'f' && STATE.editorSelectedEntity) {
                focusEditorCameraOn(STATE.editorSelectedEntity);
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && STATE.editorSelectedEntity && !STATE.editorSelectedEntity.isBuiltIn) {
                deleteEditorEntity(STATE.editorSelectedEntity);
            }
        });

        window.addEventListener('keyup', (e: KeyboardEvent) => {
            const k = e.key.toLowerCase();
            editorKeys[k] = false;
            if (!e.shiftKey) editorKeys['shift'] = false;
        });

        window.addEventListener('mousedown', (e: MouseEvent) => {
            if (!STATE.editorActive) return;
            if (e.button === 2 || e.button === 1) {
                isRightMouseDragging = true;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
            }
        });

        window.addEventListener('mousemove', (e: MouseEvent) => {
            if (!STATE.editorActive || !isRightMouseDragging) return;
            const dx = e.clientX - lastMouseX;
            const dy = e.clientY - lastMouseY;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            editorYaw += dx * 0.0045;
            editorPitch = Math.max(-1.48, Math.min(0.45, editorPitch - dy * 0.0045));
        });

        window.addEventListener('mouseup', () => {
            isRightMouseDragging = false;
        });

        window.addEventListener('contextmenu', (e: MouseEvent) => {
            if (STATE.editorActive) e.preventDefault();
        });

        window.addEventListener('wheel', (e: WheelEvent) => {
            if (!STATE.editorActive) return;
            if ((e.target as HTMLElement)?.closest('.editor-sidebar-left, .editor-sidebar-right, #editor-export-modal')) return;
            editorCamPos.y = Math.max(8.0, Math.min(480.0, editorCamPos.y + e.deltaY * 0.06));
        });
    }
}
