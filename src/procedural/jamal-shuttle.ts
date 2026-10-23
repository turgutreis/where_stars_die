import * as THREE from 'three';

export interface JamalShuttleController {
    group: THREE.Group;
    shuttleMesh: THREE.Group;
    towClampMesh: THREE.Group;
    citationHoloMesh: THREE.Mesh;
    coreLight: THREE.PointLight;
    isLiberated: boolean;
    setLiberated: (liberated: boolean) => void;
    update: (dt: number) => void;
}

export interface TowingDroneController {
    group: THREE.Group;
    droneBody: THREE.Group;
    scannerEye: THREE.Mesh;
    strobeLight: THREE.PointLight;
    tractorBeam: THREE.Mesh;
    citationTag: THREE.Group;
    isOverloaded: boolean;
    triggerOverload: () => void;
    update: (dt: number, targetPos?: THREE.Vector3) => void;
}

/**
 * Creates Dr. Tariq Jamal's research ship (Ar-Riḥla)
 * Equipped with high-tech science wings, quantum sensor arrays, and a glowing propulsion core.
 * Features a heavy industrial parking clamp (Parkkralle) locked onto the engines until liberated!
 */
export function createJamalResearchShuttleMesh(size: number = 0.65): JamalShuttleController {
    const group = new THREE.Group();
    (group as any).isJamalGroup = true;

    const shuttleMesh = new THREE.Group();
    group.add(shuttleMesh);

    // 1. Sleek science shuttle fuselage (Ceramic white & graphite composites)
    const hullMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.7,
        roughness: 0.35,
        emissive: 0x0f172a,
        emissiveIntensity: 0.2
    });

    const darkAccentMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.85,
        roughness: 0.25
    });

    const amberGlassMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.6,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.85
    });

    // Main Body
    const fuselageGeo = new THREE.ConeGeometry(size * 0.45, size * 2.2, 7);
    fuselageGeo.rotateX(Math.PI / 2); // Pointing forward along +Z
    const fuselage = new THREE.Mesh(fuselageGeo, hullMat);
    shuttleMesh.add(fuselage);

    // Cockpit Canopy (Amber glass)
    const cockpitGeo = new THREE.SphereGeometry(size * 0.28, 16, 12);
    cockpitGeo.scale(0.8, 0.55, 1.4);
    const cockpit = new THREE.Mesh(cockpitGeo, amberGlassMat);
    cockpit.position.set(0, size * 0.2, size * 0.35);
    shuttleMesh.add(cockpit);

    // Science Sensor Wings (Folding swept wings with sensor pylons)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(size * 1.6, -size * 0.8);
    wingShape.lineTo(size * 1.5, -size * 1.2);
    wingShape.lineTo(0, -size * 0.6);
    wingShape.closePath();

    const extrudeSettings = { depth: 0.08 * size, bevelEnabled: true, bevelThickness: 0.02 * size, bevelSize: 0.02 * size };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    wingGeo.center();

    // Right Wing
    const rightWing = new THREE.Mesh(wingGeo, darkAccentMat);
    rightWing.position.set(size * 0.9, 0, -size * 0.2);
    rightWing.rotation.x = Math.PI / 2;
    shuttleMesh.add(rightWing);

    // Left Wing
    const leftWing = new THREE.Mesh(wingGeo, darkAccentMat);
    leftWing.position.set(-size * 0.9, 0, -size * 0.2);
    leftWing.rotation.x = Math.PI / 2;
    leftWing.rotation.y = Math.PI;
    shuttleMesh.add(leftWing);

    // Twin Warp / Sublight Engine Nacelles
    const nacelleGeo = new THREE.CylinderGeometry(size * 0.14, size * 0.16, size * 1.2, 12);
    nacelleGeo.rotateX(Math.PI / 2);

    const rightNacelle = new THREE.Mesh(nacelleGeo, darkAccentMat);
    rightNacelle.position.set(size * 0.7, 0, -size * 0.8);
    shuttleMesh.add(rightNacelle);

    const leftNacelle = new THREE.Mesh(nacelleGeo, darkAccentMat);
    leftNacelle.position.set(-size * 0.7, 0, -size * 0.8);
    shuttleMesh.add(leftNacelle);

    // Thruster glow exhausts (Cyan / Blue)
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const thrusterGeo = new THREE.CircleGeometry(size * 0.13, 16);
    thrusterGeo.rotateY(Math.PI);

    const rightExhaust = new THREE.Mesh(thrusterGeo, thrusterMat);
    rightExhaust.position.set(size * 0.7, 0, -size * 1.4);
    shuttleMesh.add(rightExhaust);

    const leftExhaust = new THREE.Mesh(thrusterGeo, thrusterMat);
    leftExhaust.position.set(-size * 0.7, 0, -size * 1.4);
    shuttleMesh.add(leftExhaust);

    // Sensor dish on dorsal hull
    const dishGeo = new THREE.SphereGeometry(size * 0.24, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.4);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9, roughness: 0.1, side: THREE.DoubleSide });
    const sensorDish = new THREE.Mesh(dishGeo, dishMat);
    sensorDish.position.set(0, size * 0.45, -size * 0.2);
    sensorDish.rotation.x = -Math.PI * 0.35;
    shuttleMesh.add(sensorDish);

    // Science Quantum Core Light
    const coreLight = new THREE.PointLight(0x38bdf8, 1.8, 16, 1.2);
    coreLight.position.set(0, 0, -size * 0.9);
    group.add(coreLight);

    // 2. The Infamous AI Towing Clamp (Parkkralle)
    const towClampMesh = new THREE.Group();
    group.add(towClampMesh);

    const clampMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.8,
        roughness: 0.4,
        emissive: 0x78350f,
        emissiveIntensity: 0.4
    });

    // Locking ring clamped across the twin engine thrusters
    const clampRingGeo = new THREE.TorusGeometry(size * 0.85, size * 0.08, 8, 24);
    clampRingGeo.rotateY(Math.PI / 2);
    const clampRing = new THREE.Mesh(clampRingGeo, clampMat);
    clampRing.position.set(0, 0, -size * 1.1);
    towClampMesh.add(clampRing);

    // Heavy industrial crossbars with warning hazard stripes
    const barGeo = new THREE.BoxGeometry(size * 1.8, size * 0.12, size * 0.12);
    const bar1 = new THREE.Mesh(barGeo, clampMat);
    bar1.position.set(0, 0, -size * 1.1);
    towClampMesh.add(bar1);

    // Flashing Parking Violation Citation Hologram
    const holoCanvas = document.createElement('canvas');
    holoCanvas.width = 256;
    holoCanvas.height = 128;
    const ctx = holoCanvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.fillRect(0, 0, 256, 128);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PARKVERSTOSS', 128, 42);
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = '#fef08a';
        ctx.fillText('§42a HALTEVERBOT', 128, 76);
        ctx.font = '14px monospace';
        ctx.fillText('STATUS: WIRD ABGESCHLEPPT', 128, 104);
    }
    const holoTex = new THREE.CanvasTexture(holoCanvas);
    const holoMat = new THREE.MeshBasicMaterial({
        map: holoTex,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
    });
    const holoGeo = new THREE.PlaneGeometry(size * 1.4, size * 0.7);
    const citationHoloMesh = new THREE.Mesh(holoGeo, holoMat);
    citationHoloMesh.position.set(0, size * 0.9, -size * 1.1);
    towClampMesh.add(citationHoloMesh);

    // Liberated Protective Shield Bubble (Hidden until liberated)
    const shieldGeo = new THREE.SphereGeometry(size * 1.6, 24, 18);
    const shieldMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.22,
        roughness: 0.1,
        metalness: 0.9,
        side: THREE.DoubleSide
    });
    const shieldBubble = new THREE.Mesh(shieldGeo, shieldMat);
    shieldBubble.visible = false;
    group.add(shieldBubble);

    let isLiberated = false;

    const setLiberated = (liberated: boolean) => {
        isLiberated = liberated;
        towClampMesh.visible = !liberated;
        shieldBubble.visible = liberated;
        if (liberated) {
            coreLight.color.setHex(0x10b981);
            coreLight.intensity = 2.4;
            shuttleMesh.rotation.z = 0;
        }
    };

    let totalTime = 0;
    const update = (dt: number) => {
        totalTime += dt;
        if (!isLiberated) {
            // Slight struggling jitter while clamped
            shuttleMesh.rotation.z = Math.sin(totalTime * 4.5) * 0.04;
            citationHoloMesh.position.y = size * 0.9 + Math.sin(totalTime * 3) * 0.05;
            citationHoloMesh.rotation.y = Math.sin(totalTime * 1.5) * 0.15;
        } else {
            // Smooth free drifting and shield pulsation
            shieldBubble.rotation.y += dt * 0.2;
            shieldBubble.rotation.z += dt * 0.15;
            shuttleMesh.rotation.y += dt * 0.25;
        }
    };

    return {
        group,
        shuttleMesh,
        towClampMesh,
        citationHoloMesh,
        coreLight,
        isLiberated,
        setLiberated,
        update
    };
}

/**
 * Creates the rogue AI Parking Enforcement Drone (TX-9 Orbit-Abschleppdienst)
 * Patrols alongside Jamal's ship, locking it with a glowing tractor beam and flashing yellow warning strobes.
 */
export function createTowingDroneMesh(size: number = 0.45): TowingDroneController {
    const group = new THREE.Group();
    (group as any).isTowingDroneGroup = true;

    const droneBody = new THREE.Group();
    group.add(droneBody);

    // 1. Faceted security drone chassis
    const bodyGeo = new THREE.DodecahedronGeometry(size * 0.55, 1);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.9,
        roughness: 0.25,
        emissive: 0x0f172a
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    droneBody.add(bodyMesh);

    // Hazard Stripes Ring (Yellow & Black)
    const ringGeo = new THREE.TorusGeometry(size * 0.65, size * 0.06, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.5,
        roughness: 0.5
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    droneBody.add(ringMesh);

    // Central Scanner / Radar Eye
    const eyeGeo = new THREE.SphereGeometry(size * 0.22, 16, 16);
    const eyeMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xb91c1c,
        emissiveIntensity: 0.85,
        metalness: 0.95,
        roughness: 0.1
    });
    const scannerEye = new THREE.Mesh(eyeGeo, eyeMat);
    scannerEye.position.set(0, 0, size * 0.5);
    droneBody.add(scannerEye);

    // Police / Towing Rotating Strobe Light (Flashing Yellow/Orange)
    const strobeMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const strobeGeo = new THREE.CylinderGeometry(size * 0.1, size * 0.12, size * 0.2, 8);
    const strobeBeacon = new THREE.Mesh(strobeGeo, strobeMat);
    strobeBeacon.position.set(0, size * 0.65, 0);
    droneBody.add(strobeBeacon);

    const strobeLight = new THREE.PointLight(0xf59e0b, 2.2, 16, 1.5);
    strobeLight.position.set(0, size * 0.75, 0);
    group.add(strobeLight);

    // Tow-Tractor Beam emitter horns
    const hornGeo = new THREE.ConeGeometry(size * 0.12, size * 0.4, 8);
    hornGeo.rotateX(Math.PI / 2);
    const leftHorn = new THREE.Mesh(hornGeo, bodyMat);
    leftHorn.position.set(-size * 0.35, -size * 0.2, size * 0.4);
    droneBody.add(leftHorn);

    const rightHorn = new THREE.Mesh(hornGeo, bodyMat);
    rightHorn.position.set(size * 0.35, -size * 0.2, size * 0.4);
    droneBody.add(rightHorn);

    // Hologram Citation Badge
    const citationTag = new THREE.Group();
    citationTag.position.set(0, size * 1.1, 0);
    droneBody.add(citationTag);

    // Pulsating Tractor Beam Mesh (Connecting Drone to Jamal's Ship)
    const beamGeo = new THREE.CylinderGeometry(size * 0.08, size * 0.32, 1.0, 12, 1, true);
    beamGeo.rotateX(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide
    });
    const tractorBeam = new THREE.Mesh(beamGeo, beamMat);
    tractorBeam.position.set(0, 0, 0);
    group.add(tractorBeam);

    let isOverloaded = false;
    let totalTime = 0;

    const triggerOverload = () => {
        isOverloaded = true;
        tractorBeam.visible = false;
        strobeLight.color.setHex(0x64748b);
        strobeLight.intensity = 0.3;
        scannerEye.material = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    };

    const update = (dt: number, targetPos?: THREE.Vector3) => {
        totalTime += dt;
        if (!isOverloaded) {
            // Hover float oscillation
            droneBody.position.y = Math.sin(totalTime * 2.8) * 0.25;
            droneBody.rotation.y += dt * 0.8;

            // Flash beacon light
            const strobePhase = Math.sin(totalTime * 8);
            strobeLight.intensity = strobePhase > 0 ? 3.0 : 0.4;

            // Align tractor beam towards target
            if (targetPos) {
                const myPos = group.position;
                const dir = targetPos.clone().sub(myPos);
                const len = dir.length();
                if (len > 0.01) {
                    tractorBeam.position.copy(dir.clone().multiplyScalar(0.5));
                    tractorBeam.scale.set(1, 1, len);
                    tractorBeam.lookAt(dir);
                    (beamMat as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(totalTime * 12) * 0.25;
                }
            }
        } else {
            // Spinning out and tumbling into vacuum
            droneBody.rotation.x += dt * 2.5;
            droneBody.rotation.z += dt * 1.8;
            group.position.y += dt * 0.5;
        }
    };

    return {
        group,
        droneBody,
        scannerEye,
        strobeLight,
        tractorBeam,
        citationTag,
        isOverloaded,
        triggerOverload,
        update
    };
}
