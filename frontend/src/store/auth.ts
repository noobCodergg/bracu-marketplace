import { cancelApiRequests } from '../services/http';
import { create } from 'zustand';
import { apiConfig } from '../config/api';
import { client } from '../config/queryClient';
import type { User } from '../types';
import { useCart } from './cart';
import { toast,useToasts } from './toast';
interface AuthState {user:User|null;ready:boolean;setUser:(user:User|null)=>void;restore:()=>Promise<void>;logout:()=>Promise<void>}
let generation=0;
export const useAuth=create<AuthState>((set,get)=>{
 const assign=(user:User|null)=>{if(get().user?.id!==user?.id||get().user?.role!==user?.role){cancelApiRequests();void client.cancelQueries();client.clear();if(get().user)useCart.getState().clear();useToasts.setState({items:[]});}set({user,ready:true});};
 return {user:null,ready:false,setUser:user=>{if(!user){void get().logout();return}generation++;assign(user);},
 restore:async()=>{const current=generation;try{const response=await fetch(apiConfig.baseUrl+'/auth/me',{credentials:'include'});if(!response.ok){if(response.status===401||response.status===403){if(current===generation)assign(null);return}throw Error('Session check failed');}const body=await response.json() as {data:User};if(current===generation)assign(body.data);}catch{if(current===generation)set({ready:true});}},
 logout:async()=>{const current=++generation;try{const response=await fetch(apiConfig.baseUrl+'/auth/logout',{method:'POST',credentials:'include'});if(!response.ok)throw Error('Sign out failed. Please try again.');if(current===generation){assign(null);toast.success('Signed out successfully.');}}catch(error){toast.error(error);}}};
});
