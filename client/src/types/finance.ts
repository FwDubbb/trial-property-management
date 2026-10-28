import type { Page } from './portfolio';
export const expenseCategories = [
  'REPAIRS',
  'UTILITIES',
  'PROPERTY_TAXES',
  'INSURANCE',
  'CLEANING',
  'LANDSCAPING',
  'SUPPLIES',
  'OTHER',
] as const;
export interface Expense {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyActive: boolean;
  category: string;
  description: string;
  amount: string;
  expenseDate: string;
  notes: string;
  createdAt: string;
  recordedByName: string;
  voidedAt: string | null;
  voidedByName: string | null;
  voidReason: string;
  state: 'RECORDED' | 'VOIDED';
}
export interface ExpensePage extends Page<Expense> {
  recordedTotal: string;
}
export interface CashMonth {
  period: string;
  received: string;
  expenses: string;
  net: string;
}
export interface Dashboard {
  period: string;
  portfolio: {
    properties: number;
    activeProperties: number;
    units: number;
    occupied: number;
    vacant: number;
    tenants: number;
    openMaintenance: number;
  };
  rent: { expected: string; paid: string; outstanding: string; overdue: string };
  cash: CashMonth;
  trend: CashMonth[];
  categories: { category: string; amount: string }[];
  recentPayments: {
    id: string;
    tenantName: string;
    propertyName: string;
    amount: string;
    paymentDate: string;
    period: string;
  }[];
  recentMaintenance: {
    id: string;
    title: string;
    status: string;
    priority: string;
    submittedDate: string;
    propertyName: string;
  }[];
}
