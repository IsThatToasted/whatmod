import type { Project } from '../types/domain';

export const sampleProjects: Project[] = [
  {
    id: 'p-1', name: 'Hamilton Residence', address: 'Lancaster, PA', clientName: 'Maya Hamilton',
    status: 'estimating', trade: 'painting', progress: 18, crewCount: 0, updatedAt: 'Today'
  },
  {
    id: 'p-2', name: 'North Queen Retail Fit-Out', address: 'Lancaster, PA', clientName: 'North Queen Retail',
    status: 'active', trade: 'painting', progress: 67, crewCount: 5, updatedAt: '12 min ago'
  },
  {
    id: 'p-3', name: 'York Medical Offices', address: 'York, PA', clientName: 'Keystone Medical',
    status: 'scheduled', trade: 'general', progress: 0, crewCount: 8, updatedAt: 'Yesterday'
  }
];
