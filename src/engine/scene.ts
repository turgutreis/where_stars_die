import * as THREE from 'three';
import { resizePostProcessing } from './postprocessing';
import { createRealisticStarfield, CosmicBackgroundController } from './starfield';

export let scene: THREE.Scene = new THREE.Scene();
export let camera: THREE.PerspectiveCamera;
export let renderer: THREE.WebGLRenderer;
export let ambientLight: THREE.AmbientLight | null = null;
export let starfieldController: CosmicBackgroundController | null = null;

export function initScene(container?: HTMLElement) {
    const target = container || document.getElementById('canvas-container') || document.body;

    // Scene (Clear, deep cosmic void - no milky fog)
    scene = new THREE.Scene();

    // Camera (Top-down view with offset height)
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 65, 0);
    camera.lookAt(0, 0, 0);

    // Renderer with ACES Filmic Tone Mapping for crisp contrast & PCF Soft Shadows
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x010308, 1.0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    target.appendChild(renderer.domElement);

    // Celestial Ambient Light (Starlight from billions of stars, galactic disc & diffuse nebulae)
    // Dynamically graded according to current star system class
    ambientLight = new THREE.AmbientLight(0x243246, 0.72);
    scene.add(ambientLight);

    // Create Realistic Multi-Layered Astronomical Starfield (No donut holes!)
    starfieldController = createRealisticStarfield();
    scene.add(starfieldController.group);

    // Event Listener
    window.addEventListener('resize', onWindowResize);
}

export function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizePostProcessing(window.innerWidth, window.innerHeight);
}
