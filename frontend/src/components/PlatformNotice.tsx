import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { platformService } from '../services/account';
export function PlatformNotice(){
 const {data}=useQuery({queryKey:['platform'],queryFn:platformService.get});
 useEffect(()=>{if(data?.name)document.title=data.name},[data?.name]);
 if(!data?.announcement&&!data?.supportEmail)return null;
 return <div className="bg-brand-50 px-5 py-2 text-center text-sm text-brand-800">{data.announcement}{data.supportEmail&&<a className="ml-3 underline" href={`mailto:${data.supportEmail}`}>Contact support</a>}</div>;
}
