export interface Vector2D {
  x: number;
  y: number;
}

export interface GameEntity {
  id: string;
  type: 'player' | 'enemy' | 'projectile' | 'unknown';
  position: Vector2D;
  velocity?: Vector2D;
  health?: number;
  state: string;
}

export interface GameState {
  timestamp: number;
  entities: GameEntity[];
}

export interface Prediction {
  action: string;
  probability: number;
}

export interface StrategicStep {
  description: string;
  targetPosition?: Vector2D;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface StrategyAnalysis {
  currentStrategy: string;
  predictedNextMove: string;
  threatLevel: 'low' | 'medium' | 'high';
  confidence: number;
  predictions: Prediction[];
  multiStepPlan?: StrategicStep[];
}

export interface UserSettings {
  entityColors: {
    player: string;
    enemy: string;
    projectile: string;
    unknown: string;
  };
  textSize: 'small' | 'medium' | 'large';
  showGrid: boolean;
  gridOpacity: number;
}
