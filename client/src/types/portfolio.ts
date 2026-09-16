export const propertyTypes = [
  'APARTMENT',
  'HOUSE',
  'TOWNHOUSE',
  'COMMERCIAL',
  'MIXED_USE',
  'OTHER',
] as const;
export const unitStatuses = ['VACANT', 'OCCUPIED', 'MAINTENANCE', 'UNAVAILABLE'] as const;
export type PropertyType = (typeof propertyTypes)[number];
export type UnitStatus = (typeof unitStatuses)[number];
export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  region: string;
  country: string;
  propertyType: PropertyType;
  notes: string;
  active: boolean;
  unitCount: number;
  occupiedCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface Unit {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyActive: boolean;
  name: string;
  bedrooms: number;
  bathrooms: number;
  monthlyRent: string;
  status: UnitStatus;
  activeLeaseId: string | null;
  hasUpcomingLease: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface PropertyOption {
  id: string;
  name: string;
  active: boolean;
}
export interface PortfolioSummary {
  properties: number;
  units: number;
  occupied: number;
  vacant: number;
}
export function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
export function amount(value: string) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
