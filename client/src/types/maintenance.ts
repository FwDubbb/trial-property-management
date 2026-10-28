import type { PropertyOption } from './portfolio';
export const maintenanceStatuses = [
  'SUBMITTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export const maintenancePriorities = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'] as const;
export type MaintenanceStatus = (typeof maintenanceStatuses)[number];
export interface MaintenanceRequest {
  id: string;
  requestNumber: string;
  propertyId: string;
  propertyName: string;
  propertyActive: boolean;
  unitId: string | null;
  unitName: string | null;
  tenantId: string | null;
  tenantName: string | null;
  title: string;
  description: string;
  priority: string;
  status: MaintenanceStatus;
  submittedDate: string;
  assignedTo: string;
  notes: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  version: number;
}
export interface MaintenanceEvent {
  id: string;
  action: string;
  fromStatus: MaintenanceStatus | null;
  toStatus: MaintenanceStatus;
  assignedTo: string;
  priority: string;
  reason: string;
  createdAt: string;
  actorName: string;
}
export interface MaintenanceDetail {
  request: MaintenanceRequest;
  events: MaintenanceEvent[];
}
export interface MaintenanceOptions {
  properties: PropertyOption[];
  units: { id: string; name: string; propertyId: string }[];
  tenants: { id: string; name: string; unitIds: string[] }[];
}
