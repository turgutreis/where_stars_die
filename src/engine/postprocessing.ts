import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { scene, camera, renderer, ambientLight } from './scene';
import { STATE } from '../core/state';
import { alienShipController } from '../procedural/meshes';
import { ColorGradingProfile, LIGHTING_PROFILES, getLightingProfileForSystem } from '../graphics/lighting-profiles';

export let composer: EffectComposer | null = null;
export let bloomPass: UnrealBloomPass | null = null;
export let distortionPass: ShaderPass | null = null;
export let colorGradingPass: ShaderPass | null = null;

export const SpacetimeDistortionShader = {
    uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        uResolution: { value: new THREE.Vector2(1920, 1080) },
        uTime: { value: 0.0 },
        uWarpBubblePos: { value: new THREE.Vector2(0.5, 0.5) },
        uWarpIntensity: { value: 0.0 },
        uRippleCount: { value: 0 },
        uRipples: {
            value: [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0)
            ]
        }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uResolution;
        uniform float uTime;
        uniform vec2 uWarpBubblePos;
        uniform float uWarpIntensity;
        uniform int uRippleCount;
        uniform vec3 uRipples[8];
        varying vec2 vUv;

        void main() {
            vec2 aspect = vec2(uResolution.x / max(1.0, uResolution.y), 1.0);
            vec2 uv = vUv;
            vec2 totalOffset = vec2(0.0);

            // 1. Expanding Spacetime Gravitational Pulse Waves in the ship's wake
            for (int i = 0; i < 8; i++) {
                if (i >= uRippleCount) break;
                vec3 r = uRipples[i]; // r.x, r.y = screen center, r.z = screen radius
                if (r.z <= 0.001) continue;

                vec2 dVec = (uv - r.xy) * aspect;
                float dist = length(dVec);
                float diff = dist - r.z;
                float waveWidth = 0.040; // Broad, soft optical wave distortion instead of thin sharp ring

                if (abs(diff) < waveWidth && dist > 0.0005) {
                    float waveProgress = clamp(r.z / 0.35, 0.0, 1.0);
                    float strength = (1.0 - waveProgress) * (1.0 - waveProgress); // Soft quadratic dispersion
                    float waveShape = sin(diff / waveWidth * 3.14159);
                    
                    // Subtle, authentic optical refraction ripple across background stars
                    float displaceMag = waveShape * strength * 0.003;
                    totalOffset += (dVec / dist) * displaceMag / aspect;
                }
            }

            // 2. CRITICAL: Absolute Ship Protection Mask
            // Najmafar itself remains 100% crystal clear, sharp and completely undistorted
            float distToShip = length((uv - uWarpBubblePos) * aspect);
            float shipProtection = smoothstep(0.025, 0.065, distToShip);
            totalOffset *= shipProtection;

            // Cap total offset to guarantee subtlety and prevent visual jarring
            float maxDisplace = 0.0055;
            float totalLen = length(totalOffset);
            if (totalLen > maxDisplace) {
                totalOffset = (totalOffset / totalLen) * maxDisplace;
            }

            // 3. Chromatic Gravitational Lensing (Delicate prism dispersion in the wake)
            float offsetLen = length(totalOffset);
            if (offsetLen > 0.00005) {
                float rCol = texture2D(tDiffuse, uv + totalOffset * 1.03).r;
                float gCol = texture2D(tDiffuse, uv + totalOffset).g;
                float bCol = texture2D(tDiffuse, uv + totalOffset * 0.97).b;
                float aCol = texture2D(tDiffuse, uv).a;
                gl_FragColor = vec4(rCol, gCol, bCol, aCol);
            } else {
                gl_FragColor = texture2D(tDiffuse, uv);
            }
        }
    `
};

export const ColorGradingShader = {
    uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        uColorFilter: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        uShadowTint: { value: new THREE.Vector3(0.04, 0.06, 0.12) },
        uExposure: { value: 1.0 },
        uContrast: { value: 1.0 },
        uSaturation: { value: 1.0 },
        uVignette: { value: 0.22 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec3 uColorFilter;
        uniform vec3 uShadowTint;
        uniform float uExposure;
        uniform float uContrast;
        uniform float uSaturation;
        uniform float uVignette;
        varying vec2 vUv;

        void main() {
            vec4 col = texture2D(tDiffuse, vUv);
            
            // 1. Exposure scaling
            vec3 c = col.rgb * uExposure;

            // 2. Color filter (Stellar temperature highlight & midtone tint)
            c *= uColorFilter;

            // 3. Shadow Tint (Subtle chromatic lift for cosmic darks)
            float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
            float shadowFactor = clamp(1.0 - lum * 2.2, 0.0, 1.0);
            c += uShadowTint * shadowFactor * 0.16;

            // 4. Contrast curve around perceptual midtone (0.18)
            c = (c - 0.18) * uContrast + 0.18;
            c = max(vec3(0.0), c);

            // 5. Saturation
            lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = mix(vec3(lum), c, uSaturation);

            // 6. Cinematic Vignette (radial falloff toward screen corners)
            vec2 coord = (vUv - 0.5) * 2.0;
            float vig = 1.0 - dot(coord, coord) * (uVignette * 0.5);
            c *= clamp(vig, 0.0, 1.0);

            gl_FragColor = vec4(c, col.a);
        }
    `
};

// Lighting Dramaturgy State & Interpolation
let activeProfile: ColorGradingProfile = LIGHTING_PROFILES['Yellow Sun'];
let currentExposure = 1.05;
let currentContrast = 1.08;
let currentSaturation = 1.06;
let currentVignette = 0.22;
const currentColorFilter = new THREE.Color(0xfff8e8);
const currentShadowTint = new THREE.Color(0x090f1e);
const currentAmbientColor = new THREE.Color(0x243246);
let currentAmbientIntensity = 0.72;
let currentBloomThreshold = 0.88;
let currentBloomStrength = 0.55;

export function setColorGradingProfile(profile: ColorGradingProfile) {
    activeProfile = profile;
}

export function applySystemLighting(starType?: string, anomalyType?: string) {
    const profile = getLightingProfileForSystem(starType, anomalyType);
    setColorGradingProfile(profile);
}

export function getActiveLightingProfile(): ColorGradingProfile {
    return activeProfile;
}

export function updateColorGrading(dt: number) {
    if (!colorGradingPass) return;
    const lerpSpeed = Math.min(1.0, dt * 2.2);

    currentExposure = THREE.MathUtils.lerp(currentExposure, activeProfile.exposure, lerpSpeed);
    currentContrast = THREE.MathUtils.lerp(currentContrast, activeProfile.contrast, lerpSpeed);
    currentSaturation = THREE.MathUtils.lerp(currentSaturation, activeProfile.saturation, lerpSpeed);
    currentVignette = THREE.MathUtils.lerp(currentVignette, activeProfile.vignette, lerpSpeed);

    currentColorFilter.lerp(activeProfile.colorFilter, lerpSpeed);
    currentShadowTint.lerp(activeProfile.shadowTint, lerpSpeed);
    currentAmbientColor.lerp(new THREE.Color(activeProfile.ambientColor), lerpSpeed);
    currentAmbientIntensity = THREE.MathUtils.lerp(currentAmbientIntensity, activeProfile.ambientIntensity, lerpSpeed);

    if (ambientLight) {
        ambientLight.color.copy(currentAmbientColor);
        ambientLight.intensity = currentAmbientIntensity;
    }

    if (bloomPass) {
        currentBloomThreshold = THREE.MathUtils.lerp(currentBloomThreshold, activeProfile.bloomThreshold, lerpSpeed);
        currentBloomStrength = THREE.MathUtils.lerp(currentBloomStrength, activeProfile.bloomStrength, lerpSpeed);
        bloomPass.threshold = currentBloomThreshold;
        bloomPass.strength = currentBloomStrength;
    }

    const u = colorGradingPass.uniforms;
    u.uExposure.value = currentExposure;
    u.uContrast.value = currentContrast;
    u.uSaturation.value = currentSaturation;
    u.uVignette.value = currentVignette;
    u.uColorFilter.value.set(currentColorFilter.r, currentColorFilter.g, currentColorFilter.b);
    u.uShadowTint.value.set(currentShadowTint.r, currentShadowTint.g, currentShadowTint.b);
}

export function initPostProcessing() {
    if (!renderer || !scene || !camera) return;

    // 1. Create Effect Composer with full window render resolution
    composer = new EffectComposer(renderer);

    // 2. Base Scene Render Pass
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // 3. Spacetime Gravitational Distortion Pass (Refracts scene behind warp waves & ship)
    const distortionResolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    SpacetimeDistortionShader.uniforms.uResolution.value.copy(distortionResolution);
    distortionPass = new ShaderPass(SpacetimeDistortionShader);
    composer.addPass(distortionPass);

    // 4. Cinematic Selective Unreal Bloom Pass (Half resolution for high-efficiency M4 tile rendering)
    const bloomResolution = new THREE.Vector2(Math.floor(window.innerWidth * 0.5), Math.floor(window.innerHeight * 0.5));
    bloomPass = new UnrealBloomPass(
        bloomResolution,
        0.55,  // Bloom strength
        0.28,  // Bloom radius
        0.88   // Luminance threshold
    );
    composer.addPass(bloomPass);

    // 5. System-Specific Color Grading & Cinematic Contrast Pass
    colorGradingPass = new ShaderPass(ColorGradingShader);
    composer.addPass(colorGradingPass);

    // 6. Output Pass for tone mapping & color correction
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
}

export function resizePostProcessing(width: number, height: number) {
    if (composer) {
        composer.setSize(width, height);
    }
    if (bloomPass) {
        bloomPass.resolution.set(Math.floor(width * 0.5), Math.floor(height * 0.5));
    }
    if (distortionPass && distortionPass.uniforms.uResolution) {
        distortionPass.uniforms.uResolution.value.set(width, height);
    }
}

let lastDistortionTime = performance.now();

export function updateSpacetimeDistortion(dt: number) {
    if (!distortionPass || !camera) return;

    const uniforms = distortionPass.uniforms;
    uniforms.uTime.value += dt;

    if (typeof window !== 'undefined' && window.innerWidth) {
        uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    }

    // A. Ship Warp Bubble in screen space
    if (STATE.playerPosition) {
        const shipScreen = STATE.playerPosition.clone().project(camera);
        // Convert from [-1, 1] NDC to [0, 1] UV
        const uvX = (shipScreen.x + 1.0) * 0.5;
        const uvY = (shipScreen.y + 1.0) * 0.5;
        uniforms.uWarpBubblePos.value.set(uvX, uvY);

        const isThrusting = Boolean(STATE.isThrusting || (STATE.keys && STATE.keys.w));
        const targetWarp = isThrusting ? 1.0 : 0.0;
        uniforms.uWarpIntensity.value = THREE.MathUtils.lerp(
            uniforms.uWarpIntensity.value,
            targetWarp,
            Math.min(1.0, dt * 9.0)
        );
    }

    // B. Active Spacetime Gravitational Pulse Shockwaves
    if (alienShipController && typeof alienShipController.getRipples === 'function') {
        const ripples = alienShipController.getRipples();
        const count = Math.min(ripples.length, 8);
        uniforms.uRippleCount.value = count;

        const camHeight = Math.max(20.0, camera.position.y || 65.0);

        for (let i = 0; i < count; i++) {
            const r = ripples[i];
            const screenPos = r.position.clone().project(camera);
            const rX = (screenPos.x + 1.0) * 0.5;
            const rY = (screenPos.y + 1.0) * 0.5;

            // Project 3D radius to screen UV radius based on camera perspective
            const screenRadius = (r.worldRadius / camHeight) * 0.72;
            uniforms.uRipples.value[i].set(rX, rY, screenRadius);
        }
    } else {
        uniforms.uRippleCount.value = 0;
    }

    // Performance: Bypass full-screen postprocessing pass entirely when no spacetime distortion is occurring
    const isDistortionActive = uniforms.uWarpIntensity.value > 0.005 || uniforms.uRippleCount.value > 0;
    distortionPass.enabled = isDistortionActive;
}

export function renderPostProcessing() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastDistortionTime) * 0.001);
    lastDistortionTime = now;

    if (composer) {
        updateSpacetimeDistortion(dt);
        updateColorGrading(dt);
        composer.render();
    } else if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}
