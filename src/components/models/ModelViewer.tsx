import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center } from '@react-three/drei';
import type { ModelDefinition } from './ModelRegistry.ts';

function ViewerScene({ model }: { model: ModelDefinition }) {
  const ModelComponent = model.component;
  return (
    <>
      <color attach="background" args={['#b8d4e8']} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 8, 3]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.001}
      />
      <directionalLight position={[-3, 4, -2]} intensity={0.2} />
      <hemisphereLight args={['#87ceeb', '#4a7a3a', 0.3]} />
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={0.5}
        maxDistance={20}
        target={[0, model.cameraTargetY, 0]}
      />
      <Center disableY>
        <ModelComponent />
      </Center>
      {/* Grass ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[8, 48]} />
        <meshStandardMaterial color="#5a8a3c" roughness={0.95} />
      </mesh>
    </>
  );
}

export default function ModelViewer({ model }: { model: ModelDefinition }) {
  return (
    <div className="relative flex-1">
      {/* Model info overlay */}
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <h2 className="text-xl font-bold text-gray-800">{model.name}</h2>
        <p className="mt-1 text-sm text-gray-500">{model.description}</p>
      </div>
      <Canvas
        key={model.id}
        camera={{
          position: [0, model.cameraTargetY + model.cameraDistance * 0.35, model.cameraDistance],
          fov: 50,
          near: 0.1,
          far: 100,
        }}
        shadows
        dpr={[1, 2]}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <ViewerScene model={model} />
        </Suspense>
      </Canvas>
    </div>
  );
}
