import type {
Coupon,
Order,
OrderStatus
} from "../types";
import { apiRequest } from './http';

export const couponService = {
  list: (sellerId?: string) => {
    void sellerId;
    return apiRequest<Coupon[]>("/coupons");
  },
  create: (input: {
    sellerId?: string;
    seller?: string;
    code: string;
    discountPercent: number;
  }) =>
    apiRequest<Coupon>("/coupons", {
      method: "POST",
      body: JSON.stringify({
        code: input.code,
        discountPercent: input.discountPercent,
      }),
    }),
  toggle: (id: string) =>
    apiRequest<Coupon>(`/coupons/${id}/toggle`, { method: "PATCH" }),
  redeem: (code: string, sellerIds: string[]) =>
    apiRequest<Coupon>("/coupons/validate", {
      method: "POST",
      body: JSON.stringify({ code, sellerIds }),
    }),
};

export const orderService = {
  list: () => apiRequest<Order[]>("/orders"),
  place: (input: Omit<Order, "id" | "createdAt" | "status"> & {idempotencyKey?:string}) =>
    apiRequest<Order>("/orders", {
      method: "POST",
      body: JSON.stringify({...input,idempotencyKey:input.idempotencyKey??crypto.randomUUID()}),
    }),
  update: (id: string, status: OrderStatus) =>
    apiRequest<Order>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  cancel: (id: string) =>
    apiRequest<Order>(`/orders/${id}/cancel`, { method: "POST" }),
  requestExtension: (id: string, minutes: number, reason: string) =>
    apiRequest<Order>(`/orders/${id}/extension`, {
      method: "POST",
      body: JSON.stringify({ minutes, reason }),
    }),
  decideExtension: (id: string, decision: "APPROVED" | "REJECTED") =>
    apiRequest<Order>(`/orders/${id}/extension`, {
      method: "PATCH",
      body: JSON.stringify({ decision }),
    }),
};

export const sellerAvailabilityService = {
  get: (sellerId: string) =>
    apiRequest<boolean>(`/products/seller/${sellerId}/availability`),
  set: (_sellerId: string, accepting: boolean) =>
    apiRequest<boolean>("/products/seller/availability", {
      method: "PATCH",
      body: JSON.stringify({ accepting }),
    }),

};

export const reportService = {
  create: (input: {
    targetId: string;
    type: "Seller" | "Buyer" | "Food";
    reason: string;
  }) => apiRequest<import("../types").Report>("/reports", {method:"POST",body:JSON.stringify(input)}),
  activeProduct: (productId: string) =>
    apiRequest<{active:boolean;status?:"OPEN"|"UNDER_REVIEW";reportedAt?:string}>(`/reports/mine/product/${productId}/active`),
};

export const reviewService = {
  forFood: (foodId: string) =>
    apiRequest<import("../types").Review[]>(`/reviews/product/${foodId}`),
  submit: (foodId: string, input: { rating: number; comment: string }) =>
    apiRequest<import("../types").Review>(`/reviews/product/${foodId}`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
