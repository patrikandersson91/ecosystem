// Shared soft shadow shader — radial gradient circle for natural-looking contact shadows

export const softShadowVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const softShadowFrag = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float dist = length(vUv - 0.5) * 2.0;
    // Gaussian-ish falloff: dark center, very soft fade to edges
    float alpha = exp(-dist * dist * 3.0) * uOpacity;
    // Extra smoothstep to ensure clean edge cutoff
    alpha *= 1.0 - smoothstep(0.7, 1.0, dist);
    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
  }
`
