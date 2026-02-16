import { useState } from 'react';
import ModelSidebar from '../components/models/ModelSidebar.tsx';
import ModelViewer from '../components/models/ModelViewer.tsx';
import { MODEL_REGISTRY } from '../components/models/ModelRegistry.ts';

export default function ModelsPage() {
  const [selectedModel, setSelectedModel] = useState(MODEL_REGISTRY[0]);

  return (
    <div className="flex h-screen w-screen bg-gray-950">
      <ModelSidebar
        models={MODEL_REGISTRY}
        selected={selectedModel}
        onSelect={setSelectedModel}
      />
      <ModelViewer model={selectedModel} />
    </div>
  );
}
