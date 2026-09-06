export type Role = "ADMIN" | "SELLER" | "BUYER";
export type AccountStatus =
  "PENDING" | "ACTIVE" | "SUSPENDED" | "BANNED" | "FROZEN" | "REJECTED";
export type FoodStatus =
  "ACTIVE" | "PAUSED" | "PRE_ORDER_AVAILABLE" | "OUT_OF_STOCK" | "REMOVED";
export type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "PACKED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "RETURNED";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  avatar: string;
  joined: string;
  store?: string;
  reason?: string;
  restrictionEnds?: string;
}
export interface ProductVariant {
  id?: string;
  size?: string;
  color?: string;
  sku?: string;
  price: number;
  discountPrice?: number;
  costPrice: number;
  packagingCost: number;
  otherCost: number;
  quantity: number;
}
export interface FoodItem {
  id: string;
  name: string;
  sellerId: string;
  seller: string;
  sellerAcceptingOrders?: boolean;
  description: string;
  price: number;
  costPrice?: number;
  packagingCost?: number;
  otherCost?: number;
  discountPrice?: number;
  category: string;
  subcategory?: string;
  image: string;
  images: string[];
  variants?: ProductVariant[];
  quantity: number;
  status: FoodStatus;
  boosted: boolean;
  boostEnds?: string;
  prepMinutes: number;
  dietary: string[];
  spicy: number;
  ingredients: string[];
  deliverySlots: string[];
  rating: number;
  orders: number;
  seo?: {
    title: string;
    keywords: string[];
    metaDescription: string;
    score: number;
    updatedAt: string;
  };
}
export interface Coupon {
  id: string;
  sellerId: string;
  seller: string;
  code: string;
  discountPercent: number;
  active: boolean;
  createdAt: string;
  redemptions: number;
}
export interface OrderExtension {
  minutes: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  decidedAt?: string;
}
export interface Order {
  id: string;
  buyerId?: string;
  sellerId?: string;
  foodId: string;
  variantId?: string;
  variantLabel?: string;
  food: string;
  itemType?: "FOOD" | "PRODUCT";
  image: string;
  buyer: string;
  seller: string;
  quantity: number;
  total: number;
  couponCode?: string;
  discountPercent?: number;
  discountAmount?: number;
  deliveryDate: string;
  deliveryTime: string;
  allocatedDeliveryAt?: string;
  deliveryAddress?: string;
  phone?: string;
  instructions?: string;
  extension?: OrderExtension;
  status: OrderStatus;
  createdAt: string;
}
export interface Report {
  id: string;
  reporterId?: string;
  reporter: string;
  targetId?: string;
  target: string;
  type: "Seller" | "Buyer" | "Food";
  reason: string;
  date: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
  action?: "UNDER_REVIEW" | "RESOLVE" | "DISMISS" | "WARN" | "SUSPEND" | "BAN" | "REMOVE";
  moderatorNote?: string;
  restrictionEnds?: string;
}
export interface Review {
  id: string;
  foodId: string;
  buyer: string;
  avatar: string;
  rating: number;
  comment: string;
  date: string;
  verified: boolean;
}
export interface SellerApplication {
  id: string;
  user: string;
  store: string;
  phone: string;
  bracuId: string;
  description: string;
  date: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}
export interface ReactivationRequest {
  id: string;
  userId: string;
  user: string;
  role: Role;
  accountStatus: "FROZEN" | "SUSPENDED";
  reason: string;
  date: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}
export interface ApiResponse<T> {
  data: T;
  message: string;
}
