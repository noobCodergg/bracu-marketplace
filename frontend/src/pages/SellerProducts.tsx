import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Check,Crown,Plus,Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge,Button,Confirm,Empty,Loading,Modal,Spinner } from '../components/ui';
import { boostPlans,productService } from '../services';
import { useAuth } from '../store/auth';
import { formatDate } from '../utils/dateTime';

export function RealSellerProducts(){
  const user=useAuth(state=>state.user),nav=useNavigate(),qc=useQueryClient();
  const [removeId,setRemoveId]=useState<string|null>(null),[boostId,setBoostId]=useState<string|null>(null),[boostDays,setBoostDays]=useState<1|7|30>(7);
  const {data=[],isLoading}=useQuery({queryKey:['database-products'],queryFn:productService.mine});
  const products=data.filter(product=>product.sellerId===user?.id),selectedPlan=boostPlans.find(plan=>plan.days===boostDays)!;
  const refresh=()=>{void qc.invalidateQueries({queryKey:['database-products']});void qc.invalidateQueries({queryKey:['foods']})};
  const remove=useMutation({meta:{successMessage:"Product deleted."},mutationFn:productService.remove,onSuccess:()=>{refresh();setRemoveId(null)}}),status=useMutation({meta:{successMessage:"Product status updated."},mutationFn:({id,next}:{id:string;next:'ACTIVE'|'PAUSED'})=>productService.setStatus(id,next),onSuccess:refresh}),boost=useMutation({meta:{successMessage:"Product boost activated."},mutationFn:()=>productService.boost(boostId!,boostDays),onSuccess:()=>{refresh();setBoostId(null)}});
  const duration=(days:number)=>days===30?'1 month':`${days} day${days===1?'':'s'}`;
  return <>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-extrabold">Products</h1><p className="mt-1 text-stone-500">Manage product details, images, variants, stock, boost, and availability.</p></div><Button onClick={()=>nav('/seller/foods/new')}><Plus size={17}/>Add product</Button></div>
    {isLoading?<Loading/>:products.length?<div className="card overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="border-b bg-stone-50"><tr>{['Product','Price','Stock','Variants','Images','Status','Boost','Actions'].map(label=><th className="px-5 py-4" key={label}>{label}</th>)}</tr></thead><tbody>{products.map(product=><tr className="border-b last:border-0" key={product.id}>
      <td className="px-5 py-3"><div className="flex items-center gap-3"><img src={product.image} alt="" className="h-12 w-14 rounded-xl object-cover"/><div><b className="block">{product.name}</b><small className="text-stone-500">{product.category} · {product.subcategory}</small></div></div></td><td className="px-5 font-bold">BDT {product.discountPrice??product.price}</td><td className="px-5">{product.quantity}</td><td className="px-5">{product.variants?.length??0}</td><td className="px-5">{product.images.length}</td><td className="px-5"><Badge tone={product.status==='ACTIVE'?'green':'gray'}>{product.status.replaceAll('_',' ')}</Badge></td><td className="px-5">{product.boosted?<Badge tone="amber">Until {formatDate(product.boostEnds)}</Badge>:<span className="text-stone-400">Not boosted</span>}</td>
      <td className="px-5"><div className="flex gap-3"><button className="font-bold text-brand-700" onClick={()=>nav(`/seller/foods/${product.id}/edit`)}>Edit</button><button className="font-bold text-amber-700" onClick={()=>status.mutate({id:product.id,next:product.status==='ACTIVE'?'PAUSED':'ACTIVE'})}>{product.status==='ACTIVE'?'Pause':'Activate'}</button><button disabled={product.boosted} className={`inline-flex items-center gap-1 font-bold ${product.boosted?'cursor-not-allowed text-stone-400':'text-violet-700'}`} onClick={()=>setBoostId(product.id)}><Crown size={14}/>{product.boosted?'Boost active':'Premium boost'}</button><button className="font-bold text-red-600" onClick={()=>setRemoveId(product.id)}>Delete</button></div></td>
    </tr>)}</tbody></table></div>:<Empty title="No products yet" body="Add your first product with images, stock, and category-specific variants."/>}
    <Confirm open={!!removeId} title="Delete this product?" body="The product will be removed from your storefront. Existing orders are not affected." onClose={()=>setRemoveId(null)} onConfirm={()=>removeId&&remove.mutate(removeId)}/>
    <Modal open={!!boostId} title="Premium product boost" onClose={()=>setBoostId(null)}>
      <div className="rounded-2xl bg-gradient-to-br from-violet-100 to-amber-50 p-5 text-center"><Badge tone="purple"><Crown size={13}/> PREMIUM</Badge><Sparkles className="mx-auto mt-4 text-violet-700" size={36}/><h3 className="mt-3 text-xl font-extrabold">Feature this product</h3><p className="mt-2 text-sm text-stone-600">Get priority placement in its category and relevant marketplace searches.</p></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">{boostPlans.map(plan=><button type="button" key={plan.days} onClick={()=>setBoostDays(plan.days)} className={`relative rounded-2xl border p-4 text-left transition ${boostDays===plan.days?'border-violet-600 bg-violet-50 ring-2 ring-violet-100':'border-stone-200 hover:border-violet-300'}`}>{boostDays===plan.days&&<Check className="absolute right-3 top-3 text-violet-700" size={17}/>}<span className="text-xs font-bold uppercase text-violet-700">{plan.label}</span><b className="mt-2 block text-lg">{duration(plan.days)}</b><span className="mt-1 block text-2xl font-extrabold">৳{plan.price}</span></button>)}</div>
      <div className="mt-5 flex items-center justify-between rounded-xl bg-stone-50 p-4"><span><b>Demo total</b><small className="block text-stone-500">No real payment will be charged</small></span><b className="text-xl">৳{selectedPlan.price}</b></div>
      {boost.isError&&<p className="mt-3 text-sm font-semibold text-red-600">{(boost.error as Error).message}</p>}<Button className="mt-4 w-full" disabled={boost.isPending} onClick={()=>boost.mutate()}>{boost.isPending?<Spinner/>:`Unlock & boost for ${duration(selectedPlan.days)}`}</Button>
    </Modal>
  </>;
}
