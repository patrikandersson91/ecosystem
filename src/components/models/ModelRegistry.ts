import type { ComponentType } from 'react';

import RabbitPreview from './previews/RabbitPreview.tsx';
import FoxPreview from './previews/FoxPreview.tsx';
import MoosePreview from './previews/MoosePreview.tsx';
import ConiferTreePreview from './previews/ConiferTreePreview.tsx';
import DeciduousTreePreview from './previews/DeciduousTreePreview.tsx';
import BushPreview from './previews/BushPreview.tsx';
import StonePreview from './previews/StonePreview.tsx';
import DaisyPreview from './previews/DaisyPreview.tsx';
import TulipPreview from './previews/TulipPreview.tsx';
import BluebellPreview from './previews/BluebellPreview.tsx';
import BirdPreview from './previews/BirdPreview.tsx';

export type ModelCategory = 'Animals' | 'Environment';

export interface ModelDefinition {
  id: string;
  name: string;
  category: ModelCategory;
  description: string;
  component: ComponentType;
  cameraDistance: number;
  cameraTargetY: number;
  accentColor: string;
}

export const MODEL_REGISTRY: ModelDefinition[] = [
  {
    id: 'rabbit',
    name: 'Rabbit',
    category: 'Animals',
    description: 'Herbivore that eats flowers and flees from foxes.',
    component: RabbitPreview,
    cameraDistance: 2.5,
    cameraTargetY: 0.3,
    accentColor: '#c49a6c',
  },
  {
    id: 'fox',
    name: 'Fox',
    category: 'Animals',
    description: 'Predator that hunts rabbits.',
    component: FoxPreview,
    cameraDistance: 4,
    cameraTargetY: 0.5,
    accentColor: '#c85a1c',
  },
  {
    id: 'moose',
    name: 'Moose',
    category: 'Animals',
    description: 'Large herbivore with palmate antlers.',
    component: MoosePreview,
    cameraDistance: 7,
    cameraTargetY: 1.5,
    accentColor: '#5f4026',
  },
  {
    id: 'bird',
    name: 'Bird',
    category: 'Animals',
    description: 'Flies in V-formation flocks across the sky.',
    component: BirdPreview,
    cameraDistance: 4,
    cameraTargetY: 0.8,
    accentColor: '#6b5a48',
  },
  {
    id: 'conifer-tree',
    name: 'Conifer Tree',
    category: 'Environment',
    description: 'Pine/spruce tree found in dense forest zones.',
    component: ConiferTreePreview,
    cameraDistance: 14,
    cameraTargetY: 2.3,
    accentColor: '#2a5e1a',
  },
  {
    id: 'deciduous-tree',
    name: 'Deciduous Tree',
    category: 'Environment',
    description: 'Oak/maple tree found at forest edges and meadows.',
    component: DeciduousTreePreview,
    cameraDistance: 12,
    cameraTargetY: 1.8,
    accentColor: '#3a7a2a',
  },
  {
    id: 'bush',
    name: 'Bush',
    category: 'Environment',
    description: 'Multi-lobed shrub scattered across the landscape.',
    component: BushPreview,
    cameraDistance: 3.5,
    cameraTargetY: 0.3,
    accentColor: '#3a7d28',
  },
  {
    id: 'stone',
    name: 'Stone',
    category: 'Environment',
    description: 'Craggy boulders and angular rocks scattered across the terrain.',
    component: StonePreview,
    cameraDistance: 2.5,
    cameraTargetY: 0.2,
    accentColor: '#8a8a8a',
  },
  {
    id: 'daisy',
    name: 'Daisy',
    category: 'Environment',
    description: 'Ring of flat oval petals around a round center.',
    component: DaisyPreview,
    cameraDistance: 2.5,
    cameraTargetY: 0.25,
    accentColor: '#e84393',
  },
  {
    id: 'tulip',
    name: 'Tulip',
    category: 'Environment',
    description: 'Cupped petals forming a goblet shape.',
    component: TulipPreview,
    cameraDistance: 2.5,
    cameraTargetY: 0.25,
    accentColor: '#fd79a8',
  },
  {
    id: 'bluebell',
    name: 'Bluebell',
    category: 'Environment',
    description: 'Drooping bell with small stamens.',
    component: BluebellPreview,
    cameraDistance: 2.5,
    cameraTargetY: 0.25,
    accentColor: '#6c5ce7',
  },
];
