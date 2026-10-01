export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  language: string;
  badge: string;
  description: string;
  content: string;
}

export interface AcousticTelemetry {
  currentDb: number;
  ambientDb: number;
  isSpike: boolean;
  rawEnergy: number;
}
