import {create} from 'zustand';
import type {FoodItem} from '../types';

export interface CartItem{food:FoodItem;quantity:number;note?:string}
interface CartState{items:CartItem[];add:(item:CartItem)=>void;remove:(foodId:string)=>void;setQuantity:(foodId:string,quantity:number)=>void;clear:()=>void}

export const useCart=create<CartState>(set=>({
  items:[],
  add:item=>set(state=>{const existing=state.items.find(entry=>entry.food.id===item.food.id);return {items:existing?state.items.map(entry=>entry.food.id===item.food.id?{...entry,quantity:Math.min(entry.food.quantity,entry.quantity+item.quantity),note:item.note||entry.note}:entry):[...state.items,item]}}),
  remove:foodId=>set(state=>({items:state.items.filter(item=>item.food.id!==foodId)})),
  setQuantity:(foodId,quantity)=>set(state=>({items:state.items.map(item=>item.food.id===foodId?{...item,quantity:Math.max(1,Math.min(item.food.quantity,quantity))}:item)})),
  clear:()=>set({items:[]}),
}));
