import { apiRequest } from './http';

export interface CompanyTotals {gross:number;directCosts:number;revenue:number;profit:number;purchases:number}

export interface CompanyReceipt {reference:string;buyerEmail:string;product:'BOOST'|'PREMIUM_ANALYTICS';amount:number;directCost:number;paidAt:string}

export interface CompanyAnalytics {summary:CompanyTotals;breakdown:(CompanyTotals & {product:string})[];trend:(CompanyTotals & {date:string})[];recentPayments:(CompanyReceipt & {id:string})[]}

export const companyAnalyticsService={get:(days:number)=>apiRequest<CompanyAnalytics>(`/admin/analytics?days=${days}`)};
