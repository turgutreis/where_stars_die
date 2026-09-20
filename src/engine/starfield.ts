import * as THREE from 'three';
import { STATE } from '../core/state';

export interface CosmicBackgroundController {
    group: THREE.Group;
    celestialGroup: THREE.Group;
    dustPoints: THREE.Points;
    update: (dt: number, cameraOrPlayerPos?: THREE.Vector3, playerVelocity?: THREE.Vector3) => void;
    dispose: () => void;
}

/**
 * Creates an infinite, camera-anchored celestial skybox and dynamic local space dust.
 * 
 * 1. Infinite Celestial Skybox:
 *    - Follows camera position every frame (never terminates at any coordinate).
 *    - Zero translation parallax: background stars and deep nebulae remain fixed
 *      in screen space, forming authentic astronomical constellations.
 * 
 * 2. Dynamic Space Dust:
 *    - Local particle field (500 motes) streaming relative to ship velocity.
 *    - Seamlessly wraps around the player bounding box ([-85, 85] units).
 *    - Opacity and particle presence scale with velocity for kinetic speed feedback.
 */
export function createRealisticStarfield(): CosmicBackgroundController {
    const group = new THREE.Group();
    group.name = "CosmicBackgroundSystem";

    // =========================================================================
    // 1. CELESTIAL BACKGROUND DOME (Zero Parallax, Follows Camera Translation)
    // =========================================================================
    const celestialGroup = new THREE.Group();
    celestialGroup.name = "CelestialDome";
    group.add(celestialGroup);

    // Layer A: Deep Cosmic Micro-Stars (6,000 particles)
    const microCount = 6000;
    const microGeo = new THREE.BufferGeometry();
    const microPos = new Float32Array(microCount * 3);
    const microCol = new Float32Array(microCount * 3);

    for (let i = 0; i < microCount; i++) {
        // Uniform circular distribution covering a massive 1200-unit dome
        const r = Math.sqrt(Math.random()) * 1200;
        const theta = Math.random() * Math.PI * 2;

        microPos[i * 3] = Math.cos(theta) * r;
        // Subtle concave bowl curvature for natural spherical dome depth
        microPos[i * 3 + 1] = -240 - Math.pow(r / 1200, 2) * 160 - Math.random() * 40;
        microPos[i * 3 + 2] = Math.sin(theta) * r;

        // Astronomical spectral classification
        const rand = Math.random();
        if (rand < 0.40) {
            // Crisp White (A/F type)
            microCol[i * 3] = 0.95; microCol[i * 3 + 1] = 0.95; microCol[i * 3 + 2] = 1.0;
        } else if (rand < 0.65) {
            // Sol Yellow / Gold (G type)
            microCol[i * 3] = 1.0; microCol[i * 3 + 1] = 0.90; microCol[i * 3 + 2] = 0.65;
        } else if (rand < 0.85) {
            // Electric Cyan / Blue (O/B type)
            microCol[i * 3] = 0.45; microCol[i * 3 + 1] = 0.85; microCol[i * 3 + 2] = 1.0;
        } else {
            // Warm Orange / Red Dwarf (K/M type)
            microCol[i * 3] = 1.0; microCol[i * 3 + 1] = 0.55; microCol[i * 3 + 2] = 0.45;
        }
    }

    microGeo.setAttribute('position', new THREE.BufferAttribute(microPos, 3));
    microGeo.setAttribute('color', new THREE.BufferAttribute(microCol, 3));

    const microMat = new THREE.PointsMaterial({
        size: 0.65,
        vertexColors: true,
        transparent: true,
        opacity: 0.80,
        depthWrite: false
    });

    const microPoints = new THREE.Points(microGeo, microMat);
    celestialGroup.add(microPoints);

    // Layer B: Mid-Field Bright Stars (1,600 particles)
    const midCount = 1600;
    const midGeo = new THREE.BufferGeometry();
    const midPos = new Float32Array(midCount * 3);
    const midCol = new Float32Array(midCount * 3);

    for (let i = 0; i < midCount; i++) {
        const r = Math.sqrt(Math.random()) * 1150;
        const theta = Math.random() * Math.PI * 2;

        midPos[i * 3] = Math.cos(theta) * r;
        midPos[i * 3 + 1] = -210 - Math.pow(r / 1150, 2) * 140 - Math.random() * 30;
        midPos[i * 3 + 2] = Math.sin(theta) * r;

        const rand = Math.random();
        if (rand < 0.35) {
            midCol[i * 3] = 1.0; midCol[i * 3 + 1] = 1.0; midCol[i * 3 + 2] = 1.0;
        } else if (rand < 0.60) {
            midCol[i * 3] = 0.38; midCol[i * 3 + 1] = 0.88; midCol[i * 3 + 2] = 1.0;
        } else if (rand < 0.85) {
            midCol[i * 3] = 1.0; midCol[i * 3 + 1] = 0.85; midCol[i * 3 + 2] = 0.40;
        } else {
            midCol[i * 3] = 0.95; midCol[i * 3 + 1] = 0.45; midCol[i * 3 + 2] = 0.85;
        }
    }

    midGeo.setAttribute('position', new THREE.BufferAttribute(midPos, 3));
    midGeo.setAttribute('color', new THREE.BufferAttribute(midCol, 3));

    const midMat = new THREE.PointsMaterial({
        size: 1.25,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
    });

    const midPoints = new THREE.Points(midGeo, midMat);
    celestialGroup.add(midPoints);

    // Layer C: Prominent Celestial Beacon Stars (160 beacon stars)
    const beaconCount = 160;
    const beaconGeo = new THREE.BufferGeometry();
    const beaconPos = new Float32Array(beaconCount * 3);
    const beaconCol = new Float32Array(beaconCount * 3);

    for (let i = 0; i < beaconCount; i++) {
        const r = Math.sqrt(Math.random()) * 1100;
        const theta = Math.random() * Math.PI * 2;

        beaconPos[i * 3] = Math.cos(theta) * r;
        beaconPos[i * 3 + 1] = -190 - Math.pow(r / 1100, 2) * 110 - Math.random() * 20;
        beaconPos[i * 3 + 2] = Math.sin(theta) * r;

        const rand = Math.random();
        if (rand < 0.45) {
            beaconCol[i * 3] = 0.55; beaconCol[i * 3 + 1] = 0.95; beaconCol[i * 3 + 2] = 1.0;
        } else if (rand < 0.75) {
            beaconCol[i * 3] = 1.0; beaconCol[i * 3 + 1] = 0.92; beaconCol[i * 3 + 2] = 0.45;
        } else {
            beaconCol[i * 3] = 1.0; beaconCol[i * 3 + 1] = 1.0; beaconCol[i * 3 + 2] = 1.0;
        }
    }

    beaconGeo.setAttribute('position', new THREE.BufferAttribute(beaconPos, 3));
    beaconGeo.setAttribute('color', new THREE.BufferAttribute(beaconCol, 3));

    const beaconMat = new THREE.PointsMaterial({
        size: 1.9,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        depthWrite: false
    });

    const beaconPoints = new THREE.Points(beaconGeo, beaconMat);
    celestialGroup.add(beaconPoints);

    // Layer D: Deep Space Procedural Nebula Clouds
    let nebulaTex: THREE.Texture;
    if (typeof document !== 'undefined' && document.createElement) {
        const nebulaCanvas = document.createElement('canvas');
        nebulaCanvas.width = 256;
        nebulaCanvas.height = 256;
        const nCtx = nebulaCanvas.getContext ? nebulaCanvas.getContext('2d') : null;
        if (nCtx) {
            const gradient = nCtx.createRadialGradient(128, 128, 10, 128, 128, 128);
            gradient.addColorStop(0, 'rgba(168, 85, 247, 0.45)');
            gradient.addColorStop(0.35, 'rgba(56, 189, 248, 0.25)');
            gradient.addColorStop(0.7, 'rgba(15, 23, 42, 0.12)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            nCtx.fillStyle = gradient;
            nCtx.fillRect(0, 0, 256, 256);
            nebulaTex = new THREE.CanvasTexture(nebulaCanvas);
        } else {
            nebulaTex = new THREE.Texture();
        }
    } else {
        nebulaTex = new THREE.Texture();
    }

    const nebulaGeo = new THREE.PlaneGeometry(450, 450);
    nebulaGeo.rotateX(-Math.PI / 2);

    const nebulaColors = [0x6366f1, 0x06b6d4, 0xd946ef, 0x3b82f6, 0x8b5cf6, 0x0284c7];
    const nebulaMeshes: THREE.Mesh[] = [];

    for (let k = 0; k < 8; k++) {
        const nMat = new THREE.MeshBasicMaterial({
            map: nebulaTex,
            color: nebulaColors[k % nebulaColors.length],
            transparent: true,
            opacity: 0.14,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        const nMesh = new THREE.Mesh(nebulaGeo, nMat);
        const ang = (k / 8) * Math.PI * 2 + 0.35;
        const dist = 180 + (k % 4) * 140;
        nMesh.position.set(Math.cos(ang) * dist, -280 - k * 10, Math.sin(ang) * dist);
        nMesh.rotation.y = k * 0.9;
        celestialGroup.add(nMesh);
        nebulaMeshes.push(nMesh);
    }

    // =========================================================================
    // 2. DYNAMIC SPACE DUST SYSTEM (Kinetic Velocity Feedback)
    // =========================================================================
    const dustCount = 550;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    const dustCol = new Float32Array(dustCount * 3);
    const dustDrift = new Float32Array(dustCount * 2); // Micro ambient drift (dx, dz)

    const HALF_X = 85.0;
    const HALF_Z = 85.0;
    const MIN_Y = -28.0;
    const MAX_Y = 12.0;

    for (let i = 0; i < dustCount; i++) {
        dustPos[i * 3] = (Math.random() - 0.5) * (HALF_X * 2);
        dustPos[i * 3 + 1] = MIN_Y + Math.random() * (MAX_Y - MIN_Y);
        dustPos[i * 3 + 2] = (Math.random() - 0.5) * (HALF_Z * 2);

        // Ambient Brownian drift for alive vacuum
        dustDrift[i * 2] = (Math.random() - 0.5) * 0.8;
        dustDrift[i * 2 + 1] = (Math.random() - 0.5) * 0.8;

        // Subtle luminescent hues (cyan, celestial blue, soft lavender)
        const rand = Math.random();
        if (rand < 0.55) {
            dustCol[i * 3] = 0.55; dustCol[i * 3 + 1] = 0.90; dustCol[i * 3 + 2] = 1.0;
        } else if (rand < 0.85) {
            dustCol[i * 3] = 0.85; dustCol[i * 3 + 1] = 0.95; dustCol[i * 3 + 2] = 1.0;
        } else {
            dustCol[i * 3] = 0.80; dustCol[i * 3 + 1] = 0.65; dustCol[i * 3 + 2] = 1.0;
        }
    }

    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));

    const dustMat = new THREE.PointsMaterial({
        size: 1.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const dustPoints = new THREE.Points(dustGeo, dustMat);
    dustPoints.name = "DynamicSpaceDust";
    group.add(dustPoints);

    return {
        group,
        celestialGroup,
        dustPoints,
        update: (dt: number, cameraOrPlayerPos?: THREE.Vector3, playerVelocity?: THREE.Vector3) => {
            // Determine camera / reference focus position
            const camPos = cameraOrPlayerPos || STATE.playerPosition;
            if (camPos) {
                // Infinite Celestial Skybox locks to camera translation (never clips, never ends)
                group.position.x = camPos.x;
                group.position.z = camPos.z;
            }

            // Zero Parallax Guarantee:
            // Celestial group has 0 local translation offset relative to the camera.
            // Constellations stay rock-solid in screen space.

            // Dynamic Space Dust stream:
            const vel = playerVelocity || STATE.playerVelocity || new THREE.Vector3(0, 0, 0);
            const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);

            // Dynamically modulate dust presence and size with velocity
            if (speed < 0.8) {
                // Ship is resting or drifting slowly: very faint ambient cosmic motes
                dustMat.opacity = THREE.MathUtils.lerp(dustMat.opacity, 0.10, Math.min(1.0, dt * 3.0));
                dustMat.size = THREE.MathUtils.lerp(dustMat.size, 1.0, Math.min(1.0, dt * 3.0));
            } else {
                // Ship is actively thrusting, cruising or warping
                const targetOpacity = Math.min(0.85, 0.15 + (speed / 32.0) * 0.50);
                const targetSize = Math.min(2.1, 1.1 + (speed / 40.0) * 0.80);
                dustMat.opacity = THREE.MathUtils.lerp(dustMat.opacity, targetOpacity, Math.min(1.0, dt * 4.0));
                dustMat.size = THREE.MathUtils.lerp(dustMat.size, targetSize, Math.min(1.0, dt * 4.0));
            }

            // Update particle positions in local camera space
            const positions = dustGeo.attributes.position.array as Float32Array;
            const fullSpanX = HALF_X * 2;
            const fullSpanZ = HALF_Z * 2;

            for (let i = 0; i < dustCount; i++) {
                const idx = i * 3;

                if (speed > 0.05) {
                    // Stream opposite to velocity vector
                    positions[idx] -= vel.x * 1.12 * dt;
                    positions[idx + 2] -= vel.z * 1.12 * dt;
                } else {
                    // Gentle ambient Brownian drift
                    positions[idx] += dustDrift[i * 2] * dt;
                    positions[idx + 2] += dustDrift[i * 2 + 1] * dt;
                }

                // Seamless local toroidal wrapping around player
                if (positions[idx] > HALF_X) {
                    positions[idx] -= fullSpanX;
                } else if (positions[idx] < -HALF_X) {
                    positions[idx] += fullSpanX;
                }

                if (positions[idx + 2] > HALF_Z) {
                    positions[idx + 2] -= fullSpanZ;
                } else if (positions[idx + 2] < -HALF_Z) {
                    positions[idx + 2] += fullSpanZ;
                }
            }

            dustGeo.attributes.position.needsUpdate = true;
        },
        dispose: () => {
            microGeo.dispose();
            microMat.dispose();
            midGeo.dispose();
            midMat.dispose();
            beaconGeo.dispose();
            beaconMat.dispose();
            dustGeo.dispose();
            dustMat.dispose();
            nebulaGeo.dispose();
            nebulaTex.dispose();
            nebulaMeshes.forEach(m => (m.material as THREE.Material).dispose());
        }
    };
}
