export interface Receipt {product:string;status:string;amount:number;directCost:number;paidAt:Date}
const round=(value:number)=>Math.round(value*100)/100;
export function summarizeReceipts(receipts:Receipt[]){
  const successful=receipts.filter(item=>item.status==='SUCCEEDED');
  const total=(items:Receipt[])=>{
    const gross=round(items.reduce((sum,item)=>sum+item.amount,0));
    const directCosts=round(items.reduce((sum,item)=>sum+item.directCost,0));
    const revenue=gross,profit=round(revenue-directCosts);
    return {gross,directCosts,revenue,profit,purchases:items.length};
  };
  return {summary:total(successful),breakdown:['BOOST','PREMIUM_ANALYTICS'].map(product=>({product,...total(successful.filter(item=>item.product===product))}))};
}
