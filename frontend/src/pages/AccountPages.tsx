import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { FoodCard } from '../components/FoodCard';
import { Button,Empty,Loading } from '../components/ui';
import { accountService,platformService,type Profile } from '../services/account';
import { useAuth } from '../store/auth';

export function AccountSettings(){
 const user=useAuth(state=>state.user),setUser=useAuth(state=>state.setUser),qc=useQueryClient();
 const query=useQuery({queryKey:['profile',user?.id],queryFn:accountService.profile});
 const save=useMutation({mutationFn:accountService.save,meta:{successMessage:'Profile saved.'},onSuccess:profile=>{qc.setQueryData(['profile',user?.id],profile);setUser(profile)}});
 if(query.isLoading)return <Loading/>;if(!query.data)return <Empty title="Unable to load profile" body={query.error?.message}/>;
 return <><h1 className="mb-6 text-3xl font-extrabold">Account settings</h1><form key={query.data.id} className="card grid gap-5 p-6" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);save.mutate({name:String(data.get('name')),phone:String(data.get('phone')),notificationPreference:data.get('notificationPreference') as Profile['notificationPreference']})}}>
 <label><span className="label">Display name</span><input className="field" name="name" required minLength={2} maxLength={80} defaultValue={query.data.name}/></label><label><span className="label">Email</span><input className="field" disabled value={query.data.email}/></label><label><span className="label">Phone</span><input className="field" name="phone" maxLength={30} defaultValue={query.data.phone}/></label><label><span className="label">Notifications</span><select className="field" name="notificationPreference" defaultValue={query.data.notificationPreference}><option value="ALL">All updates</option><option value="ORDERS">Order and account updates only</option></select></label><Button disabled={save.isPending}>Save changes</Button></form></>;
}
export function PlatformSettings(){
 const qc=useQueryClient(),query=useQuery({queryKey:['platform'],queryFn:platformService.get});
 const save=useMutation({mutationFn:platformService.save,meta:{successMessage:'Platform settings saved.'},onSuccess:data=>qc.setQueryData(['platform'],data)});
 if(query.isLoading)return <Loading/>;if(!query.data)return <Empty title="Unable to load settings" body={query.error?.message}/>;
 return <><h1 className="mb-6 text-3xl font-extrabold">Platform settings</h1><form className="card grid gap-5 p-6" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);save.mutate({name:String(data.get('name')),supportEmail:String(data.get('supportEmail')),announcement:String(data.get('announcement'))})}}>{[['name','Platform name'],['supportEmail','Support email'],['announcement','Public announcement']].map(([name,label])=><label key={name}><span className="label">{label}</span><input name={name} className="field" type={name==='supportEmail'?'email':'text'} required={name==='name'} minLength={name==='name'?3:undefined} maxLength={name==='announcement'?500:100} defaultValue={query.data?.[name as keyof typeof query.data]}/></label>)}<Button disabled={save.isPending}>Save changes</Button></form></>;
}
export function SavedProducts(){const user=useAuth(state=>state.user);const query=useQuery({queryKey:['saved-products',user?.id],queryFn:accountService.saved});return <><h1 className="mb-6 text-3xl font-extrabold">Saved products</h1>{query.isLoading?<Loading/>:query.isError?<Empty title="Unable to load saved products" body={query.error.message}/>:query.data?.length?<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{query.data.map(food=><FoodCard key={food.id} food={food}/>)}</div>:<Empty title="No saved products" body="Use the heart on a product to save it here."/>}</>}
