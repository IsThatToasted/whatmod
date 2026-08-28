export type ProjectStatus = 'lead' | 'estimating' | 'scheduled' | 'active' | 'paused' | 'complete' | 'archived';

export interface Project {
  id: string;
  name: string;
  address: string;
  clientName: string;
  status: ProjectStatus;
  trade: 'painting' | 'general' | 'drywall' | 'flooring' | 'roofing' | 'other';
  progress: number;
  crewCount: number;
  updatedAt: string;
}

export interface EstimateDraft {
  id: string;
  projectName: string;
  customerName: string;
  address: string;
  notes: string[];
  rooms: EstimateRoom[];
  createdAt: string;
}

export interface EstimateRoom {
  id: string;
  name: string;
  widthFt?: number;
  lengthFt?: number;
  heightFt?: number;
  doors: number;
  windows: number;
  surfaces: SurfaceMeasurement[];
}

export interface SurfaceMeasurement {
  id: string;
  kind: 'walls' | 'ceiling' | 'baseboard' | 'crown' | 'doors' | 'windows' | 'trim' | 'floor' | 'other';
  quantity: number;
  unit: 'sqft' | 'lnft' | 'each';
  condition: 'good' | 'prep' | 'repair';
  confidence?: number;
}
