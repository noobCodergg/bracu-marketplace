import { create } from 'zustand';
import type { FoodItem,ProductVariant } from '../types';
import { toast } from './toast';

export interface CartItem{food:FoodItem;quantity:number;note?:string;variant?:ProductVariant;checkoutKey?:string}
interface CartState{items:CartItem[];add:(item:CartItem)=>void;remove:(foodId:string,silent?:boolean)=>void;setQuantity:(foodId:string,quantity:number)=>void;clear:()=>void}

export const useCart=create<CartState>(set=>({
  items:[],
  add:item=>{toast.success(`${item.food.name} added to cart.`);set(state=>{const key=`${item.food.id}:${item.variant?.id??''}`;const existing=state.items.find(entry=>`${entry.food.id}:${entry.variant?.id??''}`===key);return {items:existing?state.items.map(entry=>`${entry.food.id}:${entry.variant?.id??''}`===key?{...entry,quantity:entry.quantity+item.quantity,note:item.note||entry.note}:entry):[...state.items,{...item,checkoutKey:crypto.randomUUID()}]}})},
  remove:(key,silent=false)=>{set(state=>({items:state.items.filter(item=>`${item.food.id}:${item.variant?.id??''}`!==key)}));if(!silent)toast.info('Item removed from cart.');},
  setQuantity:(key,quantity)=>set(state=>({items:state.items.map(item=>`${item.food.id}:${item.variant?.id??''}`===key?{...item,quantity:Math.max(1,quantity)}:item)})),
  clear:()=>set({items:[]}),
}));
