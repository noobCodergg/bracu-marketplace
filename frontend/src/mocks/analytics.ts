export const premiumProductInsights=[
  {foodId:'f1',name:'Chicken Khichuri Bowl',impressions:1840,clicks:426,addToCart:138,orders:74},
  {foodId:'f2',name:'Campus Kacchi Box',impressions:2160,clicks:512,addToCart:164,orders:81},
  {foodId:'f3',name:'Creamy Chicken Pasta',impressions:1120,clicks:218,addToCart:69,orders:32},
  {foodId:'f5',name:'Green Power Bowl',impressions:780,clicks:126,addToCart:42,orders:19},
];

export const premiumSearchInsights=[
  {keyword:'kacchi near bracu',searches:386,clicks:174,orders:42,trend:18},
  {keyword:'homemade lunch',searches:312,clicks:128,orders:31,trend:9},
  {keyword:'chicken khichuri',searches:264,clicks:119,orders:27,trend:22},
  {keyword:'food under 150',searches:241,clicks:84,orders:18,trend:-4},
  {keyword:'healthy campus meal',searches:156,clicks:51,orders:11,trend:14},
  {keyword:'quick dinner',searches:121,clicks:38,orders:7,trend:6},
];

export const demandHeatmap=[
  {day:'Sun',slots:[18,42,76,54]},{day:'Mon',slots:[24,58,88,61]},
  {day:'Tue',slots:[21,49,82,67]},{day:'Wed',slots:[28,63,94,72]},
  {day:'Thu',slots:[32,71,100,86]},{day:'Fri',slots:[15,36,64,91]},
  {day:'Sat',slots:[12,29,51,78]},
];

export const customerInsights={uniqueBuyers:146,returningBuyers:57,repeatRate:39.0,averageOrdersPerReturningBuyer:3.4,estimatedLifetimeValue:524,segments:[{name:'Budget lunch buyers',share:38},{name:'Comfort food regulars',share:27},{name:'Healthy meal buyers',share:19},{name:'Evening snack buyers',share:16}]};

export const conversionAlerts=[
  {food:'Creamy Chicken Pasta',issue:'High views, low orders',views:1120,conversion:2.9,recommendation:'Test a 10% discount or improve the first image.'},
  {food:'Green Power Bowl',issue:'Low search click-through',views:780,conversion:2.4,recommendation:'Add “healthy lunch” to the title and dietary tags.'},
];

export const searchOpportunities=[
  {keyword:'budget lunch under 100',searches:448,competition:'Low',match:'No exact listing',suggestion:'Create a compact lunch box under BDT 100.'},
  {keyword:'high protein meal',searches:294,competition:'Medium',match:'Weak match',suggestion:'Add protein quantity to relevant titles.'},
  {keyword:'late afternoon snacks',searches:238,competition:'Low',match:'No exact listing',suggestion:'Add a 4:30–6:00 PM snack delivery slot.'},
];
