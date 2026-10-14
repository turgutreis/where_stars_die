import * as THREE from 'three';
import { scene } from '../engine/scene';
import { STATE } from '../core/state';

export let menagerieGroup: THREE.Group | null = null;
let containmentRings: THREE.Mesh[] = [];
let observationPods: THREE.Group[] = [];
let harvesterBeams: THREE.Line[] = [];
let isMenageriePresent = false;

/**
 * Builds the 3D Ceres-9 Menagerie Enclosure around Najmafar
 */
export function initMenagerieScene(targetScene: THREE.Scene = scene): THREE.Group {
    cleanupMenagerieScene(targetScene);

    menagerieGroup = new THREE.Group();
    menagerieGroup.name = "menagerie_ceres_9";
    containmentRings = [];
    observationPods = [];
    harvesterBeams = [];

    // 1. Massive Glowing Plasma Containment Torus Rings
    const ringRadii = [18, 24, 30, 36];
    ringRadii.forEach((r, idx) => {
        const ringGeo = new THREE.TorusGeometry(r, 0.65, 16, 80);
        const ringMat = new THREE.MeshBasicMaterial({
            color: idx % 2 === 0 ? 0x06b6d4 : 0xd946ef,
            transparent: true,
            opacity: 0.85,
            wireframe: idx % 2 === 1
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2 + (idx * 0.15);
        ring.rotation.y = idx * 0.3;
        menagerieGroup!.add(ring);
        containmentRings.push(ring);
    });

    // 2. Hexagonal Cylindrical Containment Forcefield
    const cylGeo = new THREE.CylinderGeometry(28, 28, 30, 24, 6, true);
    const cylMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.22,
        wireframe: true,
        side: THREE.DoubleSide
    });
    const cyl = new THREE.Mesh(cylGeo, cylMat);
    cyl.name = "containment_grid";
    menagerieGroup.add(cyl);

    // 3. Floating Tourist Observation Decks & Viewing Pods
    const podCount = 8;
    for (let i = 0; i < podCount; i++) {
        const angle = (i / podCount) * Math.PI * 2;
        const dist = 38 + Math.sin(i * 1.5) * 3;
        const height = (i % 2 === 0 ? 8 : -8) + Math.cos(i) * 2;

        const podGroup = new THREE.Group();
        podGroup.position.set(Math.cos(angle) * dist, height, Math.sin(angle) * dist);
        podGroup.lookAt(0, 0, 0); // Face inward at Najmafar!

        // Platform Hull
        const hullGeo = new THREE.BoxGeometry(4.5, 2.0, 3.0);
        const hullMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.4,
            metalness: 0.8
        });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        podGroup.add(hull);

        // Holographic Observation Windows
        const winGeo = new THREE.PlaneGeometry(4.0, 1.4);
        const winMat = new THREE.MeshBasicMaterial({
            color: 0xfacc15,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        });
        const win = new THREE.Mesh(winGeo, winMat);
        win.position.set(0, 0, -1.55);
        podGroup.add(win);

        // Blinking Navigation Lights
        const lightGeo = new THREE.SphereGeometry(0.3, 8, 8);
        const lightMat = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xef4444 : 0x38bdf8 });
        const beacon = new THREE.Mesh(lightGeo, lightMat);
        beacon.position.set(2.0, 1.1, 0);
        podGroup.add(beacon);

        menagerieGroup.add(podGroup);
        observationPods.push(podGroup);
    }

    // 4. Automated Harvester Plasma Saws (targeting lasers)
    const beamAngles = [0.8, 2.3, 3.9, 5.2];
    beamAngles.forEach(ang => {
        const startX = Math.cos(ang) * 35;
        const startZ = Math.sin(ang) * 35;
        const startY = 6;

        const targetX = (Math.random() - 0.5) * 3;
        const targetZ = (Math.random() - 0.5) * 3;
        const targetY = 0.5;

        const points = [
            new THREE.Vector3(startX, startY, startZ),
            new THREE.Vector3(targetX, targetY, targetZ)
        ];
        const beamGeo = new THREE.BufferGeometry().setFromPoints(points);
        const beamMat = new THREE.LineBasicMaterial({
            color: 0xf43f5e,
            linewidth: 2,
            transparent: true,
            opacity: 0.75
        });
        const beam = new THREE.Line(beamGeo, beamMat);
        menagerieGroup!.add(beam);
        harvesterBeams.push(beam);
    });

    targetScene.add(menagerieGroup);
    isMenageriePresent = true;
    return menagerieGroup;
}

/**
 * Updates dynamic rotation and pulsing of containment fields
 */
export function updateMenagerieScene(dt: number) {
    if (!isMenageriePresent || !menagerieGroup) return;

    containmentRings.forEach((r, idx) => {
        r.rotation.z += dt * (0.2 + idx * 0.1) * (idx % 2 === 0 ? 1 : -1);
        r.rotation.y += dt * 0.15;
    });

    observationPods.forEach((pod, idx) => {
        pod.position.y += Math.sin(Date.now() * 0.002 + idx) * 0.04;
    });

    harvesterBeams.forEach(b => {
        (b.material as THREE.LineBasicMaterial).opacity = 0.5 + Math.random() * 0.45;
    });
}

/**
 * Dramatically shatters and disintegrates the Menagerie on Raumfaltungs-Breakout
 */
export function shatterMenagerie(targetScene: THREE.Scene = scene, onComplete?: () => void) {
    if (!isMenageriePresent || !menagerieGroup) {
        if (onComplete) onComplete();
        return;
    }

    let progress = 0;
    const duration = 0.9; // seconds

    const animInterval = setInterval(() => {
        progress += 0.04;
        const factor = progress / duration;

        if (menagerieGroup) {
            // Rapidly expand and fade containment rings
            containmentRings.forEach(r => {
                r.scale.multiplyScalar(1.06);
                (r.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - factor);
            });

            // Disperse observation pods outwards
            observationPods.forEach(p => {
                p.position.multiplyScalar(1.04);
            });

            // Turn off beams
            harvesterBeams.forEach(b => {
                (b.material as THREE.LineBasicMaterial).opacity = 0;
            });
        }

        if (progress >= duration) {
            clearInterval(animInterval);
            cleanupMenagerieScene(targetScene);
            if (onComplete) onComplete();
        }
    }, 30);
}

export function cleanupMenagerieScene(targetScene: THREE.Scene = scene) {
    if (menagerieGroup) {
        targetScene.remove(menagerieGroup);
        menagerieGroup.traverse((child) => {
            if ((child as THREE.Mesh).geometry) {
                (child as THREE.Mesh).geometry.dispose();
            }
            if ((child as THREE.Mesh).material) {
                const mat = (child as THREE.Mesh).material;
                if (Array.isArray(mat)) mat.forEach(m => m.dispose());
                else mat.dispose();
            }
        });
        menagerieGroup = null;
    }
    containmentRings = [];
    observationPods = [];
    harvesterBeams = [];
    isMenageriePresent = false;
}

export function isMenagerieActive(): boolean {
    return isMenageriePresent;
}
