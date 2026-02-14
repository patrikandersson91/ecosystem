import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, Vector3, Mesh as TMesh } from 'three';
import type { DirectionalLight, HemisphereLight } from 'three';
import { Sky } from '@react-three/drei';
import {
  useEcosystem,
  useEcosystemDispatch,
} from '../../state/ecosystem-context.tsx';
import {
  DAY_DURATION,
  WORLD_SIZE,
  WEATHER_CHANGE_INTERVAL,
  RAIN_CHANCE,
} from '../../types/ecosystem.ts';
import { useWeatherRefs } from '../../state/weather-refs.tsx';
import SkyLife from './SkyLife.tsx';

// ─── Physically-motivated color palettes (Kelvin-inspired) ───────

const SKY_COLORS = {
  dawn: new Color('#ff9966'),
  morning: new Color('#87ceeb'),
  noon: new Color('#5ba3d9'),
  afternoon: new Color('#87ceeb'),
  dusk: new Color('#fd7e50'),
  night: new Color('#0a1628'),
};

const FOG_COLORS = {
  dawn: new Color('#ffc8a0'),
  day: new Color('#a8d5e2'),
  dusk: new Color('#e89070'),
  night: new Color('#101830'),
};

// Hemisphere sky colors (upper hemisphere)
const HEMI_SKY_COLORS = {
  dawn: new Color('#ffb080'),
  day: new Color('#c4dff6'),
  dusk: new Color('#ff9060'),
  night: new Color('#0e1a3a'),
};

// Hemisphere ground colors (lower hemisphere — ground bounce)
const HEMI_GROUND_COLORS = {
  dawn: new Color('#5a3d28'),
  day: new Color('#4a5e38'),
  dusk: new Color('#4a3020'),
  night: new Color('#0a0e14'),
};

// Sun colors — Kelvin-inspired temperatures
const SUN_COLORS = {
  dawn: new Color('#ff7b39'),     // 2200K deep amber
  morning: new Color('#ffc58f'),  // 3500K warm
  day: new Color('#fff5eb'),      // 6500K neutral daylight
  afternoon: new Color('#ffd6a5'),// 4000K warm
  dusk: new Color('#ff5722'),     // 2000K deep orange-red
  night: new Color('#1a237e'),    // 12000K cool blue
};

const UI_CLOCK_SYNC_INTERVAL = 0.12;

function lerpColor(a: Color, b: Color, t: number, out: Color): Color {
  out.r = a.r + (b.r - a.r) * t;
  out.g = a.g + (b.g - a.g) * t;
  out.b = a.b + (b.b - a.b) * t;
  return out;
}

function getSkyColor(t: number, out: Color): Color {
  if (t < 0.08) return lerpColor(SKY_COLORS.night, SKY_COLORS.dawn, t / 0.08, out);
  if (t < 0.14) return lerpColor(SKY_COLORS.dawn, SKY_COLORS.morning, (t - 0.08) / 0.06, out);
  if (t < 0.22) return lerpColor(SKY_COLORS.morning, SKY_COLORS.noon, (t - 0.14) / 0.08, out);
  if (t < 0.5) { out.copy(SKY_COLORS.noon); return out; }
  if (t < 0.62) return lerpColor(SKY_COLORS.noon, SKY_COLORS.afternoon, (t - 0.5) / 0.12, out);
  if (t < 0.72) return lerpColor(SKY_COLORS.afternoon, SKY_COLORS.dusk, (t - 0.62) / 0.1, out);
  if (t < 0.82) return lerpColor(SKY_COLORS.dusk, SKY_COLORS.night, (t - 0.72) / 0.1, out);
  out.copy(SKY_COLORS.night); return out;
}

function getFogColor(t: number, out: Color): Color {
  if (t < 0.1) return lerpColor(FOG_COLORS.night, FOG_COLORS.dawn, t / 0.1, out);
  if (t < 0.2) return lerpColor(FOG_COLORS.dawn, FOG_COLORS.day, (t - 0.1) / 0.1, out);
  if (t < 0.62) { out.copy(FOG_COLORS.day); return out; }
  if (t < 0.72) return lerpColor(FOG_COLORS.day, FOG_COLORS.dusk, (t - 0.62) / 0.1, out);
  if (t < 0.82) return lerpColor(FOG_COLORS.dusk, FOG_COLORS.night, (t - 0.72) / 0.1, out);
  out.copy(FOG_COLORS.night); return out;
}

function getHemiSkyColor(t: number, out: Color): Color {
  if (t < 0.1) return lerpColor(HEMI_SKY_COLORS.night, HEMI_SKY_COLORS.dawn, t / 0.1, out);
  if (t < 0.2) return lerpColor(HEMI_SKY_COLORS.dawn, HEMI_SKY_COLORS.day, (t - 0.1) / 0.1, out);
  if (t < 0.62) { out.copy(HEMI_SKY_COLORS.day); return out; }
  if (t < 0.72) return lerpColor(HEMI_SKY_COLORS.day, HEMI_SKY_COLORS.dusk, (t - 0.62) / 0.1, out);
  if (t < 0.82) return lerpColor(HEMI_SKY_COLORS.dusk, HEMI_SKY_COLORS.night, (t - 0.72) / 0.1, out);
  out.copy(HEMI_SKY_COLORS.night); return out;
}

function getHemiGroundColor(t: number, out: Color): Color {
  if (t < 0.1) return lerpColor(HEMI_GROUND_COLORS.night, HEMI_GROUND_COLORS.dawn, t / 0.1, out);
  if (t < 0.2) return lerpColor(HEMI_GROUND_COLORS.dawn, HEMI_GROUND_COLORS.day, (t - 0.1) / 0.1, out);
  if (t < 0.62) { out.copy(HEMI_GROUND_COLORS.day); return out; }
  if (t < 0.72) return lerpColor(HEMI_GROUND_COLORS.day, HEMI_GROUND_COLORS.dusk, (t - 0.62) / 0.1, out);
  if (t < 0.82) return lerpColor(HEMI_GROUND_COLORS.dusk, HEMI_GROUND_COLORS.night, (t - 0.72) / 0.1, out);
  out.copy(HEMI_GROUND_COLORS.night); return out;
}

function getSunColor(t: number, out: Color): Color {
  if (t < 0.08) return lerpColor(SUN_COLORS.night, SUN_COLORS.dawn, t / 0.08, out);
  if (t < 0.14) return lerpColor(SUN_COLORS.dawn, SUN_COLORS.morning, (t - 0.08) / 0.06, out);
  if (t < 0.22) return lerpColor(SUN_COLORS.morning, SUN_COLORS.day, (t - 0.14) / 0.08, out);
  if (t < 0.58) { out.copy(SUN_COLORS.day); return out; }
  if (t < 0.64) return lerpColor(SUN_COLORS.day, SUN_COLORS.afternoon, (t - 0.58) / 0.06, out);
  if (t < 0.72) return lerpColor(SUN_COLORS.afternoon, SUN_COLORS.dusk, (t - 0.64) / 0.08, out);
  if (t < 0.82) return lerpColor(SUN_COLORS.dusk, SUN_COLORS.night, (t - 0.72) / 0.1, out);
  out.copy(SUN_COLORS.night); return out;
}

function getHemiIntensity(t: number): number {
  if (t < 0.08) return 0.18 + (t / 0.08) * 0.22;
  if (t < 0.16) return 0.4 + ((t - 0.08) / 0.08) * 0.3;
  if (t < 0.62) return 0.7;
  if (t < 0.72) return 0.7 - ((t - 0.62) / 0.1) * 0.3;
  if (t < 0.82) return 0.4 - ((t - 0.72) / 0.1) * 0.22;
  return 0.18;
}

function getSunIntensity(t: number): number {
  if (t < 0.08) return 0.18 + (t / 0.08) * 0.77;
  if (t < 0.16) return 0.95 + ((t - 0.08) / 0.08) * 0.6;
  if (t < 0.62) return 1.55;
  if (t < 0.72) return 1.55 - ((t - 0.62) / 0.1) * 0.6;
  if (t < 0.82) return 0.95 - ((t - 0.72) / 0.1) * 0.77;
  return 0.18;
}

export default function WeatherSystem() {
  const state = useEcosystem();
  const dispatch = useEcosystemDispatch();
  const { scene } = useThree();
  const weatherRefs = useWeatherRefs();

  const sunRef = useRef<DirectionalLight>(null!);
  const hemiRef = useRef<HemisphereLight>(null!);
  const skyRef = useRef<any>(null);
  const sunMeshRef = weatherRefs.sunMeshRef;

  const sunPos = useMemo(() => new Vector3(), []);
  const tempColor = useMemo(() => new Color(), []);
  const tempColor2 = useMemo(() => new Color(), []);
  const simTimeRef = useRef(state.time);
  const timeOfDayRef = useRef(state.timeOfDay);
  const uiSyncTimerRef = useRef(0);
  const pendingTickDeltaRef = useRef(0);
  const weatherTimerRef = useRef(0);

  useEffect(() => {
    simTimeRef.current = state.time;
  }, [state.time]);

  useEffect(() => {
    timeOfDayRef.current = state.timeOfDay;
  }, [state.timeOfDay]);

  useFrame((_, rawDelta) => {
    if (state.paused) return;

    const delta = rawDelta * state.speed;
    simTimeRef.current += delta;
    timeOfDayRef.current = (timeOfDayRef.current + delta / DAY_DURATION) % 1;
    pendingTickDeltaRef.current += delta;
    uiSyncTimerRef.current += delta;

    // Publish throttled clock updates to React state
    if (uiSyncTimerRef.current >= UI_CLOCK_SYNC_INTERVAL) {
      dispatch({
        type: 'ADVANCE_CLOCK',
        delta: pendingTickDeltaRef.current,
        timeOfDay: timeOfDayRef.current,
      });
      uiSyncTimerRef.current = 0;
      pendingTickDeltaRef.current = 0;
    }

    // Weather change logic
    weatherTimerRef.current += delta;
    if (weatherTimerRef.current >= WEATHER_CHANGE_INTERVAL) {
      weatherTimerRef.current = 0;
      const shouldRain = Math.random() < RAIN_CHANCE;
      dispatch({
        type: 'SET_WEATHER',
        weather: shouldRain ? 'rainy' : 'sunny',
        intensity: shouldRain ? 0.5 + Math.random() * 0.5 : 0,
        nextChangeAt: simTimeRef.current + WEATHER_CHANGE_INTERVAL,
      });
    }

    const t = timeOfDayRef.current;
    const isRaining = state.weather.type === 'rainy';
    const rainDim = isRaining ? 0.65 + (1 - state.weather.intensity) * 0.35 : 1.0;

    // Update shared weather refs
    weatherRefs.timeOfDay.current = t;
    weatherRefs.isRaining.current = isRaining;
    weatherRefs.rainIntensity.current = state.weather.intensity;

    // Sun position — realistic east-to-west arc
    const dayStart = 0.08;
    const dayEnd = 0.72;
    const isDay = t >= dayStart && t <= dayEnd;
    if (isDay) {
      const dayProgress = (t - dayStart) / (dayEnd - dayStart);
      const sunArc = dayProgress * Math.PI;
      sunPos.set(
        -Math.cos(sunArc) * 40,
        Math.sin(sunArc) * 35 + 2,
        -15,
      );
    } else {
      sunPos.set(0, -20, -15);
    }

    // Update directional light
    sunRef.current.position.copy(sunPos);
    sunRef.current.target.position.set(0, 0, 0);
    sunRef.current.target.updateMatrixWorld();

    // Update sun mesh for god rays (positioned far away in sun direction)
    if (sunMeshRef.current) {
      const sunDir = sunPos.clone().normalize();
      sunMeshRef.current.position.copy(sunDir.multiplyScalar(WORLD_SIZE * 4));
      // Sun mesh emissive brightness scales with sun being above horizon
      const sunAltitude = Math.max(0, sunPos.y / 37);
      const mat = (sunMeshRef.current as TMesh).material as any;
      if (mat?.emissiveIntensity !== undefined) {
        mat.emissiveIntensity = sunAltitude * 3.0 * rainDim;
      }
    }

    // Update shared sun position & color refs
    weatherRefs.sunPosition.current.copy(sunPos);

    // Sky shader
    if (skyRef.current?.material?.uniforms) {
      const uniforms = skyRef.current.material.uniforms;
      uniforms.sunPosition.value.copy(sunPos);
      uniforms.rayleigh.value = isDay ? 2.2 : 0.52;
      uniforms.turbidity.value = isDay ? (isRaining ? 14 : 8.5) : 11;
      uniforms.mieCoefficient.value = isRaining ? 0.02 : 0.005;
      uniforms.mieDirectionalG.value = 0.84;
    }

    // Sun intensity & color
    const sunIntensity = getSunIntensity(t) * rainDim;
    sunRef.current.intensity = sunIntensity;
    getSunColor(t, tempColor);
    sunRef.current.color.copy(tempColor);
    weatherRefs.sunColor.current.copy(tempColor);

    // Hemisphere light (replaces ambient)
    hemiRef.current.intensity = getHemiIntensity(t) * rainDim;
    getHemiSkyColor(t, tempColor);
    hemiRef.current.color.copy(tempColor);
    getHemiGroundColor(t, tempColor2);
    hemiRef.current.groundColor.copy(tempColor2);

    // Sky background color
    getSkyColor(t, tempColor);
    if (isRaining) {
      tempColor.lerp(new Color('#4a5568'), state.weather.intensity * 0.5);
    }
    scene.background = tempColor;
    weatherRefs.skyColor.current.copy(tempColor);

    // Fog
    getFogColor(t, tempColor);
    if (isRaining) {
      tempColor.lerp(new Color('#6b7b8d'), state.weather.intensity * 0.3);
    }
    if (scene.fog && 'color' in scene.fog) {
      (scene.fog as any).color.copy(tempColor);
      const isNight = t > 0.72 || t < 0.08;
      // Bring fog closer during rain for atmosphere
      const rainFogMul = isRaining ? 0.7 : 1.0;
      (scene.fog as any).near = (isNight ? WORLD_SIZE * 1.2 : WORLD_SIZE * 1.6) * rainFogMul;
      (scene.fog as any).far = (isNight ? WORLD_SIZE * 3.2 : WORLD_SIZE * 4.2) * rainFogMul;
    }
  });

  return (
    <>
      <Sky
        ref={skyRef}
        distance={WORLD_SIZE * 8}
        sunPosition={[0, 1, 0]}
        turbidity={8.5}
        rayleigh={2.2}
        mieCoefficient={0.005}
        mieDirectionalG={0.84}
      />
      <SkyLife />

      {/* Hemisphere light — sky + ground bounce GI approximation */}
      <hemisphereLight
        ref={hemiRef}
        color="#c4dff6"
        groundColor="#4a5e38"
        intensity={0.7}
      />

      {/* Directional sun light */}
      <directionalLight
        ref={sunRef}
        position={[15, 35, -15]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={120}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />

      {/* Sun mesh for god rays — emissive sphere positioned at sun direction */}
      <mesh ref={sunMeshRef as any} position={[0, WORLD_SIZE * 2, -WORLD_SIZE]}>
        <sphereGeometry args={[12, 16, 16]} />
        <meshBasicMaterial color="#fff8e7" transparent opacity={0.95} />
      </mesh>

      <fog
        attach="fog"
        args={['#a8d5e2', WORLD_SIZE * 1.6, WORLD_SIZE * 4.2]}
      />
    </>
  );
}
