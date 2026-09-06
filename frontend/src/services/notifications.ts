import { apiRequest } from './http';

export interface LiveNotification {
  id: string;
  type:
    | "NEW_ORDER"
    | "ORDER_STATUS"
    | "EXTENSION_REQUEST"
    | "EXTENSION_DECISION"
    | "API_ABUSE"
    | "ACCOUNT_WARNING"
    | "APPLICATION_DECISION";
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export const notificationService = {
  list: () => apiRequest<LiveNotification[]>("/notifications"),
  read: (id: string) =>
    apiRequest<LiveNotification>(`/notifications/${id}/read`, {
      method: "PATCH",
    }),
  readAll: () =>
    apiRequest<null>("/notifications/read-all", { method: "PATCH" }),
};
