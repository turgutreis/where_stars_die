import * as THREE from 'three';

const atmosphereVertexShader = `
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const atmosphereFragmentShader = `
uniform vec3 glowColor;
uniform float intensityMultiplier;
uniform vec3 uStarPosition;

varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
    // 1. Soft Fresnel limb darkening / atmospheric rim
    float dotNV = dot(vViewDir, vNormal);
    float fresnel = 1.0 - max(dotNV, 0.0);
    float glow = pow(fresnel, 3.2) * intensityMultiplier;

    // 2. Solar illumination direction towards star
    vec3 lightDir = normalize(uStarPosition - vWorldPosition);
    float sunDot = dot(vWorldNormal, lightDir);

    // Day/Night factor: sunlit hemisphere is bright, night drops off cleanly
    float dayFactor = smoothstep(-0.18, 0.28, sunDot);

    // Subtle ionospheric night airglow (avoids unphysical black void while preserving night)
    float nightAirglow = 0.035 * intensityMultiplier;

    // 3. Rayleigh Twilight Sunset scattering at day/night terminator (sunDot around 0.0)
    // Deepen the atmosphere's glow color along the terminator; only illuminate where sun shines
    float twilightFactor = smoothstep(0.24, 0.0, abs(sunDot - 0.02)) * smoothstep(-0.05, 0.15, sunDot);
    vec3 sunsetColor = mix(glowColor * vec3(1.15, 0.72, 0.35), vec3(1.0, 0.45, 0.12), 0.35);

    // Smoothly blend day atmospheric color and warm twilight terminator
    vec3 finalColor = mix(glowColor, sunsetColor, twilightFactor * 0.65);

    // Atmosphere alpha: Day hemisphere is bright, night fades cleanly to minimal ionospheric airglow
    float alpha = glow * (dayFactor * 0.92 + twilightFactor * 0.28 + nightAirglow);

    gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
}
`;

export function createAtmosphereMesh(
    planetRadius: number,
    hexColor: number,
    intensity = 1.25,
    starPos: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
): THREE.Mesh {
    const color = new THREE.Color(hexColor);

    const atmosphereGeo = new THREE.SphereGeometry(planetRadius * 1.045, 36, 36);
    const atmosphereMat = new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: {
            glowColor: { value: color },
            intensityMultiplier: { value: intensity },
            uStarPosition: { value: starPos }
        },
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        transparent: true,
        depthWrite: false
    });

    return new THREE.Mesh(atmosphereGeo, atmosphereMat);
}

