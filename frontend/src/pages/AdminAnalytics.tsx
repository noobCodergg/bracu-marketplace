import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Bar,BarChart,CartesianGrid,Legend,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts';
import { Button,Empty,Loading } from '../components/ui';
import { companyAnalyticsService } from '../services';
import { formatDateTime } from '../utils/dateTime';

const money=(value:number)=>new Intl.NumberFormat('en-BD',{style:'currency',currency:'BDT'}).format(value);
const productName=(value:string)=>value==='BOOST'?'Product boost':'Premium analytics';

export function AdminAnalytics(){
  const [days,setDays]=useState(30);
  const query=useQuery({queryKey:['company-analytics',days],queryFn:()=>companyAnalyticsService.get(days),staleTime:300_000});
  const data=query.data;
  return <>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-3xl font-extrabold">Company earnings</h1><p className="mt-1 text-stone-500">Income from product boosts and premium analytics purchases.</p></div>
      <div className="flex flex-wrap gap-3"><select aria-label="Analytics period" className="field w-auto" value={days} onChange={event=>setDays(Number(event.target.value))}>{[7,30,90,365].map(value=><option key={value} value={value}>Last {value} days</option>)}</select><Button variant="secondary" disabled={query.isFetching} onClick={()=>query.refetch()}>Refresh</Button></div>
    </div>
    <p className="mb-6 rounded-xl bg-stone-50 p-4 text-sm text-stone-600">Profit is successful payment income minus payment processing costs. Company overhead and taxes are excluded.</p>
    {query.isLoading?<Loading/>:query.isError?<div role="alert" className="card p-6"><p>{query.error.message}</p><Button onClick={()=>query.refetch()}>Retry</Button></div>:data&&<>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Company profit',money(data.summary.profit)],['Net revenue',money(data.summary.revenue)],['Boost revenue',money(data.breakdown.find(item=>item.product==='BOOST')?.revenue??0)],['Premium analytics revenue',money(data.breakdown.find(item=>item.product==='PREMIUM_ANALYTICS')?.revenue??0)]].map(([label,value])=><div key={label} className="card p-5"><p className="text-sm text-stone-500">{label}</p><p className="mt-2 text-2xl font-extrabold">{value}</p></div>)}</div>
      <section className="card mt-6 p-6"><h2 className="text-xl font-extrabold">Revenue and profit</h2><p className="text-sm text-stone-500">Daily totals in BDT, Bangladesh time.</p><div className="mt-5 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.trend}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" minTickGap={30}/><YAxis/><Tooltip/><Legend/><Bar dataKey="revenue" name="Net revenue (BDT)" fill="#20a45b"/><Bar dataKey="profit" name="Profit (BDT)" fill="#7c3aed"/></BarChart></ResponsiveContainer></div></section>
      <section className="card mt-6 overflow-x-auto p-6"><h2 className="mb-4 text-xl font-extrabold">Income breakdown</h2><table className="w-full min-w-[700px] text-left text-sm"><thead><tr>{['Source','Purchases','Received','Direct costs','Profit'].map(label=><th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{data.breakdown.map(item=><tr key={item.product} className="border-t"><td className="p-3 font-bold">{productName(item.product)}</td><td className="p-3">{item.purchases}</td>{[item.gross,item.directCosts,item.profit].map((value,index)=><td key={index} className="p-3">{money(value)}</td>)}</tr>)}</tbody></table></section>
      <section className="card mt-6 overflow-x-auto p-6"><h2 className="mb-4 text-xl font-extrabold">Latest successful payments</h2>{data.recentPayments.length?<table className="w-full min-w-[800px] text-left text-sm"><thead><tr>{['Paid at (Dhaka)','Reference','Customer','Purchase','Received','Direct cost'].map(label=><th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{data.recentPayments.map(item=><tr key={item.id} className="border-t"><td className="p-3">{formatDateTime(item.paidAt)}</td><td className="p-3">{item.reference}</td><td className="p-3">{item.buyerEmail}</td><td className="p-3">{productName(item.product)}</td><td className="p-3">{money(item.amount)}</td><td className="p-3">{money(item.directCost)}</td></tr>)}</tbody></table>:<Empty title="No successful payments yet" body="Completed boost and premium analytics payments will appear here automatically."/>}<p className="mt-3 text-xs text-stone-500">Latest 50 receipts in this period. Totals include every receipt in the period.</p></section>
    </>}
  </>;
}
