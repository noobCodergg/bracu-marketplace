import type {
User
} from "../types";
import { apiRequest } from './http';

export const authService = {
  login: (input: { email: string; password: string }) =>
    apiRequest<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  register: (input: { name: string; email: string; password: string }) =>
    apiRequest<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  logout: () => apiRequest<never>("/auth/logout", { method: "POST" }),
};

export interface OwnSellerApplication {
  id: string;
  store: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: string;
  retryAt: string | null;
}

export const sellerApplicationService = {
  mine: () =>
    apiRequest<OwnSellerApplication | null>("/seller-applications/mine"),
  submit: (input: {
    store: string;
    phone: string;
    bracuId: string;
    description: string;
  }) =>
    apiRequest("/seller-applications", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
