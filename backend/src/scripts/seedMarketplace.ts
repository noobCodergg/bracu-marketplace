import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {connectDatabase,disconnectDatabase} from '../config/database.js';
import {ProductModel} from '../models/Product.js';
import {UserModel} from '../models/User.js';

const catalog:Record<string,string[]>={
  Food:['Breakfast','Lunch','Dinner','Snacks','Desserts','Drinks','Homemade','Healthy'],
  "Men's Clothing":['Shirts','T-Shirts','Pants','Jeans','Jackets','Traditional Wear'],
  "Men's Accessories":['Watches','Wallets','Belts','Bags','Sunglasses'],
  "Women's Clothing":['Kurtis','Sarees','Tops','Dresses','Pants','Traditional Wear'],
  "Women's Accessories":['Bags','Jewelry','Scarves','Watches','Hair Accessories'],
  'Kids Items':['Clothing','Toys','School Supplies','Art & Learning','Baby Care'],
  Stationery:['Notebooks','Pens & Pencils','Art Supplies','Study Kits','Office Supplies'],
};
const sellerNames=['Campus Cart','North Star Shop','Urban Basket','Daily Needs BD','Green Corner','Student Choice','Dhaka Finds','The Pantry','Style Station','Campus Closet','Quick Pick','Happy Trolley','Value Vault','Fresh & Fine','Little Things','Smart Supplies','Trend House','Home Kitchen','Essential Hub','BRACU Bazaar'];
const colors=['Black','Navy','White','Olive','Maroon','Beige'];
const images:Record<string,string>={
  Food:'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=80',
  "Men's Clothing":'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=1000&q=80',
  "Men's Accessories":'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1000&q=80',
  "Women's Clothing":'https://images.unsplash.com/photo-1583391733956-6c78276477e2?auto=format&fit=crop&w=1000&q=80',
  "Women's Accessories":'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=1000&q=80',
  'Kids Items':'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=1000&q=80',
  Stationery:'https://images.unsplash.com/photo-1455390582262-044cdead277e2?auto=format&fit=crop&w=1000&q=80',
};
const slug=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const money=(value:number)=>Math.round(value);

function variants(category:string,sellerIndex:number,subcategoryIndex:number){
  const base=category==='Food'?90+subcategoryIndex*18:category==='Stationery'?120+subcategoryIndex*75:450+subcategoryIndex*140;
  const cost=Math.round(base*.48);
  const common=(price:number,quantity:number)=>({price,discountPrice:money(price*.9),costPrice:cost,packagingCost:12+sellerIndex%4*3,otherCost:8+subcategoryIndex%3*4,quantity});
  if(category==='Food')return ['Small','Medium','Large'].map((size,index)=>({size,color:'',sku:`SEED-${sellerIndex+1}-${subcategoryIndex+1}-${size[0]}`,...common(base+index*35,12+sellerIndex%7+index*4)}));
  if(category==='Stationery')return [{size:'',color:'',sku:`SEED-${sellerIndex+1}-${subcategoryIndex+1}-DEFAULT`,...common(base,20+sellerIndex%9)}];
  return [
    {size:'M',color:colors[(sellerIndex+subcategoryIndex)%colors.length],sku:`SEED-${sellerIndex+1}-${subcategoryIndex+1}-M`,...common(base,8+sellerIndex%6)},
    {size:'L',color:colors[(sellerIndex+subcategoryIndex+1)%colors.length],sku:`SEED-${sellerIndex+1}-${subcategoryIndex+1}-L`,...common(base+80,6+subcategoryIndex%7)},
  ];
}

async function seed(){
  await connectDatabase();
  try{
    const passwordHash=await bcrypt.hash('SellerDemo123!',12);
    const sellers=[];
    for(let index=0;index<sellerNames.length;index++){
      const email=`demo.seller${String(index+1).padStart(2,'0')}@bracu-market.test`;
      const seller=await UserModel.findOneAndUpdate(
        {email},
        {$set:{name:`Demo Seller ${String(index+1).padStart(2,'0')}`,role:'SELLER',status:'ACTIVE',store:sellerNames[index],acceptingOrders:true,avatar:`https://ui-avatars.com/api/?name=${encodeURIComponent(sellerNames[index]!)}&background=DCFCE7&color=166534`},$setOnInsert:{passwordHash}},
        {new:true,upsert:true,setDefaultsOnInsert:true}
      );
      sellers.push(seller);
    }
    const operations=[] as Parameters<typeof ProductModel.bulkWrite>[0];
    for(let sellerIndex=0;sellerIndex<sellers.length;sellerIndex++){
      const seller=sellers[sellerIndex]!;
      let categoryIndex=0;
      for(const [category,subcategories] of Object.entries(catalog)){
        for(let subcategoryIndex=0;subcategoryIndex<subcategories.length;subcategoryIndex++){
          const subcategory=subcategories[subcategoryIndex]!,rows=variants(category,sellerIndex,subcategoryIndex);
          const name=`${sellerNames[sellerIndex]} ${subcategory} · ${category}`;
          const price=Math.min(...rows.map(row=>row.discountPrice));
          const quantity=rows.reduce((sum,row)=>sum+row.quantity,0);
          operations.push({updateOne:{filter:{sellerId:seller._id,category,subcategory},update:{$set:{seller:seller.store,name,description:`A quality ${subcategory.toLowerCase()} listing from ${seller.store}, prepared for B Market buyers with clear variant pricing, dependable availability and campus-friendly delivery.`,category,subcategory,price,quantity,status:'ACTIVE',images:[images[category]!,images[category]!],variants:rows,prepMinutes:category==='Food'?20+subcategoryIndex*5:60,dietary:category==='Food'?['Halal']:[],spicy:category==='Food'?subcategoryIndex%4:0,ingredients:category==='Food'?['Fresh ingredients','House seasoning','Prepared to order']:['Quality material','Campus friendly','Everyday use'],deliverySlots:['12:30 PM','1:30 PM','5:30 PM'],boosted:false,rating:4+((sellerIndex+subcategoryIndex)%9)/10,orders:(sellerIndex*3+subcategoryIndex*2)%55,seoTitle:`${subcategory} ${category} from ${seller.store}`.slice(0,60),searchKeywords:[subcategory.toLowerCase(),category.toLowerCase(),'b market'],metaDescription:`Shop ${subcategory.toLowerCase()} from ${seller.store} with variant-wise pricing and convenient delivery near BRAC University.`}},upsert:true}});
          categoryIndex++;
        }
      }
      if(categoryIndex!==40)throw Error(`Catalog coverage mismatch for ${seller.store}: ${categoryIndex}`);
    }
    const result=await ProductModel.bulkWrite(operations);
    console.log(`Seed complete: ${sellers.length} sellers, ${operations.length} products across 40 subcategories.`);
    console.log(`Inserted ${result.upsertedCount}; updated ${result.modifiedCount}; matched ${result.matchedCount}.`);
    console.log('Demo password for every seeded seller: SellerDemo123!');
  }finally{
    await disconnectDatabase();
  }
}

seed().catch(error=>{console.error(error instanceof Error?error.message:error);process.exit(1)});
