export interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
  currentLeaseId: string | null;
  currentUnitId: string | null;
  currentUnitName: string | null;
  currentPropertyId: string | null;
  currentPropertyName: string | null;
  createdAt: string;
  updatedAt: string;
}
export const leaseStatuses = ['ACTIVE', 'UPCOMING', 'EXPIRED', 'TERMINATED'] as const;
export interface Lease {
  id: string;
  tenantId: string;
  tenantName: string;
  unitId: string;
  unitName: string;
  propertyId: string;
  propertyName: string;
  propertyActive: boolean;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  securityDeposit: string;
  status: (typeof leaseStatuses)[number];
  notes: string;
  terminatedAt: string | null;
  terminationReason: string;
  createdAt: string;
  updatedAt: string;
}
export interface LeaseOptions {
  tenants: { id: string; name: string; email: string }[];
  units: {
    id: string;
    name: string;
    propertyId: string;
    propertyName: string;
    propertyActive: boolean;
    status: string;
    monthlyRent: string;
  }[];
}
export function formatDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
