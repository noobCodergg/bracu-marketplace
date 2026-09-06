import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Clock,Heart,Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { accountService } from '../services/account';
import { useAuth } from '../store/auth';
import { toast } from '../store/toast';
import type { FoodItem } from '../types';
import { Badge } from './ui';

export function FoodCard({food}:{food:FoodItem}){
  const user=useAuth(state=>state.user),qc=useQueryClient();
  const saved=useQuery({queryKey:['saved-products',user?.id],queryFn:accountService.saved,enabled:!!user});
  const isSaved=!!saved.data?.some(item=>item.id===food.id);
  const toggle=useMutation({mutationFn:()=>isSaved?accountService.unsaveProduct(food.id):accountService.saveProduct(food.id),meta:{successMessage:isSaved?'Product removed from saved items.':'Product saved.'},onSuccess:()=>qc.invalidateQueries({queryKey:['saved-products',user?.id]})});
  const closed=food.sellerAcceptingOrders===false;
  return <article className="relative"><Link to={`/foods/${food.id}`} className="card group overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl">
    <div className="relative h-48 overflow-hidden"><img src={food.image} alt={food.name} className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${closed?'opacity-60':''}`}/><div className="absolute left-3 top-3 flex flex-col items-start gap-2">{closed&&<span className="badge bg-red-600 text-white">This seller is not taking orders</span>}{food.boosted&&<span className="badge bg-amber-400 text-amber-950">✦ Featured</span>}{food.discountPrice&&<span className="badge bg-red-500 text-white">{Math.round((1-food.discountPrice/food.price)*100)}% OFF</span>}</div>
    </div><div className="p-4"><div className="mb-2 flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-600">{food.category}</p><h3 className="mt-1 font-extrabold">{food.name}</h3></div><span className="flex items-center gap-1 text-sm font-bold"><Star size={14} fill="#f4b740" className="text-amber-400"/>{food.rating}</span></div><p className="text-sm text-stone-500">by {food.seller}</p><div className="mt-4 flex items-center justify-between"><div><span className="text-lg font-extrabold">৳{food.discountPrice??food.price}</span>{food.discountPrice&&<span className="ml-2 text-xs text-stone-400 line-through">৳{food.price}</span>}</div><span className="flex items-center gap-1 text-xs text-stone-500"><Clock size={14}/>{food.prepMinutes} min</span></div><div className="mt-3 flex flex-wrap gap-2"><Badge tone={food.status==='ACTIVE'?'green':food.status==='PRE_ORDER_AVAILABLE'?'purple':food.status==='OUT_OF_STOCK'?'gray':'red'}>{food.status.replaceAll('_',' ')}</Badge>{closed&&<Badge tone="red">Orders closed</Badge>}</div></div>
  </Link><button type="button" aria-label={isSaved?"Unsave product":"Save product"} aria-pressed={isSaved} disabled={toggle.isPending} className="absolute right-3 top-3 rounded-full bg-white/90 p-2" onClick={()=>{if(!user){toast.info("Sign in to save products.");return}toggle.mutate()}}><Heart size={17} fill={isSaved?"currentColor":"none"}/></button></article>;
}
