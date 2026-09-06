import type { FoodItem,ProductVariant } from '../types';
export const sellingPrice=(product:FoodItem,variant?:ProductVariant)=>variant?.discountPrice??variant?.price??product.discountPrice??product.price;

export const boostPlans=[
  {days:1,label:'Starter',price:149},
  {days:7,label:'Popular',price:599},
  {days:30,label:'Pro',price:1499},
] as const;

export const analyticsPlan={id:'SELLER_ANALYTICS_MONTHLY',days:30,label:'Monthly analytics',price:999} as const;
