import type { Page } from './portfolio';
export const paymentMethods = ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHECK', 'OTHER'] as const;
export const rentStatuses = ['PAID', 'PARTIALLY_PAID', 'UNPAID', 'OVERDUE'] as const;
export interface PaymentParties {
  leaseId: string;
  tenantId: string;
  tenantName: string;
  unitId: string;
  unitName: string;
  propertyId: string;
  propertyName: string;
}
export interface Payment extends PaymentParties {
  id: string;
  period: string;
  amount: string;
  paymentDate: string;
  method: string;
  reference: string;
  notes: string;
  state: 'RECORDED' | 'VOIDED';
  createdAt: string;
  recordedByName: string;
  voidedAt: string | null;
  voidedByName: string | null;
  voidReason: string;
}
export interface RentBalance extends PaymentParties {
  period: string;
  expected: string;
  paid: string;
  outstanding: string;
  dueDate: string;
  status: string;
  paymentStatus: string;
  overdue: boolean;
  termsRecorded: boolean;
}
export interface RentPage extends Page<RentBalance> {
  period: string;
  summary: { expected: string; paid: string; outstanding: string; overdue: string };
}
export interface PaymentOption extends PaymentParties {
  startDate: string;
  endDate: string;
}
export const currentMonth = () => new Date().toISOString().slice(0, 7);
export function formatMonth(month: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
}
