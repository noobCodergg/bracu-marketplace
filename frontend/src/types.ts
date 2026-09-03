export type Role='ADMIN'|'SELLER'|'BUYER'; export type AccountStatus='PENDING'|'ACTIVE'|'SUSPENDED'|'BANNED'|'FROZEN'|'REJECTED';
export type FoodStatus='ACTIVE'|'PAUSED'|'PRE_ORDER_AVAILABLE'|'OUT_OF_STOCK'|'REMOVED'; export type OrderStatus='PENDING'|'ACCEPTED'|'PREPARING'|'READY'|'OUT_FOR_DELIVERY'|'PACKED'|'DELIVERED'|'COMPLETED'|'CANCELLED';
export interface User{id:string;name:string;email:string;role:Role;status:AccountStatus;avatar:string;joined:string;store?:string;reason?:string}
export interface FoodItem{id:string;name:string;sellerId:string;seller:string;description:string;price:number;discountPrice?:number;category:string;subcategory?:string;image:string;images:string[];quantity:number;status:FoodStatus;boosted:boolean;boostEnds?:string;prepMinutes:number;dietary:string[];spicy:number;ingredients:string[];deliverySlots:string[];rating:number;orders:number;seo?:{title:string;keywords:string[];metaDescription:string;score:number;updatedAt:string}}
export interface Coupon{id:string;sellerId:string;seller:string;code:string;discountPercent:number;active:boolean;createdAt:string;redemptions:number}
export interface OrderExtension{minutes:number;reason:string;status:'PENDING'|'APPROVED'|'REJECTED';requestedAt:string;decidedAt?:string}
export interface Order{id:string;foodId:string;food:string;itemType?:'FOOD'|'PRODUCT';image:string;buyer:string;seller:string;quantity:number;total:number;deliveryDate:string;deliveryTime:string;allocatedDeliveryAt?:string;deliveryAddress?:string;phone?:string;instructions?:string;extension?:OrderExtension;status:OrderStatus;createdAt:string}
export interface Report{id:string;reporter:string;target:string;type:'Seller'|'Buyer'|'Food';reason:string;date:string;status:'OPEN'|'UNDER_REVIEW'|'RESOLVED'|'DISMISSED'}
export interface Review{id:string;foodId:string;buyer:string;avatar:string;rating:number;comment:string;date:string;verified:boolean}
export interface SellerApplication{id:string;user:string;store:string;phone:string;bracuId:string;description:string;date:string;status:'PENDING'|'APPROVED'|'REJECTED'}
export interface ReactivationRequest{id:string;userId:string;user:string;role:Role;accountStatus:'FROZEN'|'SUSPENDED';reason:string;date:string;status:'PENDING'|'APPROVED'|'REJECTED'}
export interface ApiResponse<T>{data:T;message:string}
