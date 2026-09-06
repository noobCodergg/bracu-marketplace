import type {
OrderStatus
} from "../types";
import { apiRequest } from './http';

export const seoService = {
  analyze(input: {
    title: string;
    keywords: string[];
    metaDescription: string;
  }) {
    const checks = [
      input.title.length >= 30 && input.title.length <= 60,
      input.keywords.length >= 3,
      input.keywords.some((keyword) =>
        input.title.toLowerCase().includes(keyword.toLowerCase()),
      ),
      input.metaDescription.length >= 80 && input.metaDescription.length <= 160,
      /bracu|campus|dhaka/i.test(input.metaDescription + " " + input.title),
    ];
    return {
      score: checks.filter(Boolean).length * 20,
      checks: [
        { label: "Title is 30–60 characters", pass: checks[0] },
        { label: "At least 3 focused keywords", pass: checks[1] },
        { label: "Primary keyword appears in title", pass: checks[2] },
        { label: "Description is 80–160 characters", pass: checks[3] },
        { label: "Includes a relevant local term", pass: checks[4] },
      ],
    };
  },
  save:(foodId:string,input:{title:string;keywords:string[];metaDescription:string})=>apiRequest('/seller/analytics/product-intelligence-settings/'+foodId,{method:'PATCH',body:JSON.stringify({seoTitle:input.title,searchKeywords:input.keywords,metaDescription:input.metaDescription})}),
};

export interface SellerAnalyticsData {
  rangeDays: number;
  summary: {
    revenue: number;
    totalCost: number;
    grossSales: number;
    netSales: number;
    totalOrders: number;
    completedOrders: number;
    unitsSold: number;
    averageOrderValue: number;
    cancelledOrders: number;
    cancellationRate: number;
    totalListings: number;
    activeListings: number;
    boostedListings: number;
    totalDiscounts: number;
    uniqueBuyers: number;
    repeatBuyerRate: number;
  };
  comparison: {
    revenue: number;
    orders: number;
    units: number;
    averageOrderValue: number;
  };
  trend: {
    date: string;
    label: string;
    revenue: number;
    orders: number;
    units: number;
  }[];
  statusCounts: Record<OrderStatus, number>;
  topProducts: {
    id: string;
    name: string;
    image: string;
    status: string;
    rating: number;
    boosted: boolean;
    orders: number;
    units: number;
    revenue: number;
    discounts: number;
  }[];
  variantPerformance: {
    product: string;
    variant: string;
    orders: number;
    units: number;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
  }[];
  couponPerformance: {
    id: string;
    code: string;
    active: boolean;
    discountPercent: number;
    redemptions: number;
    periodOrders: number;
    revenue: number;
    discountGiven: number;
  }[];
  topBuyers: { buyer: string; orders: number; spend: number; units: number }[];
  inventory: {
    id: string;
    name: string;
    image: string;
    status: string;
    quantity: number;
    variantCount: number;
    variantQuantity: number;
    rating: number;
    orders: number;
    boosted: boolean;
  }[];
  recentOrders: {
    id: string;
    food: string;
    image: string;
    buyer: string;
    quantity: number;
    total: number;
    status: OrderStatus;
    couponCode?: string;
    createdAt: string;
  }[];
}

export const sellerAnalyticsService = {
  get: (days: number, sellerId?: string) =>
    apiRequest<SellerAnalyticsData>(
      `/seller/analytics?days=${days}${sellerId ? `&sellerId=${encodeURIComponent(sellerId)}` : ""}`,
    ),
};

export interface AmazonPremiumData {
  rangeDays: number;
  summary: {
    impressions: number;
    views: number;
    cartAdds: number;
    orders: number;
    sales: number;
    repeatCustomers: number;
    uniqueCustomers: number;
  };
  products: {
    id: string;
    name: string;
    image: string;
    status: string;
    rating: number;
    boosted: boolean;
    impressions: number;
    views: number;
    carts: number;
    orders: number;
    units: number;
    sales: number;
    ctr: number;
    cartRate: number;
    conversionRate: number;
    cartToOrderRate: number;
  }[];
  topProducts: AmazonPremiumData["products"];
  lostPotential: {
    productId: string;
    product: string;
    severity: "HIGH" | "MEDIUM";
    issues: string[];
    actions: string[];
    views: number;
    carts: number;
    orders: number;
    conversionRate: number;
  }[];
  keywords: {
    keyword: string;
    searches: number;
    matchedProducts: number;
    views: number;
    carts: number;
    orders: number;
    conversionRate: number;
    suggestion: string;
  }[];
  keywordSuggestions: AmazonPremiumData["keywords"];
  searchOpportunities: AmazonPremiumData["keywords"];
  demand: {
    product: string;
    day: string;
    period: string;
    orders: number;
    units: number;
    sales: number;
  }[];
  customers: {
    repeatRate: number;
    repeat: { buyer: string; orders: number; units: number; spend: number }[];
    top: { buyer: string; orders: number; units: number; spend: number }[];
  };
  inventory: {
    id: string;
    name: string;
    status: string;
    baseQuantity: number;
    variantQuantity: number;
    variantCount: number;
    rating: number;
    boosted: boolean;
  }[];
  ppc: {
    productId: string;
    product: string;
    impressions: number;
    clicks: number;
    ctr: number;
    orders: number;
    sales: number;
    estimatedSpend: number;
    estimatedCpc: number;
    roas: number;
  }[];
}

type AdvancedProduct = AmazonPremiumData["products"][number] & {
  cost: number;
  profit: number;
  margin: number;
  stock: number;
  daysOfCover: number | null;
  reorderQuantity: number;
  forecast7: number;
  forecast30: number;
  listingScore: number;
  competitorAverage: number | null;
  priceGap: number | null;
  deadStock: boolean;
  qualityActions: string[];
};

type AdvancedAmazonPremiumData = Omit<
  AmazonPremiumData,
  "summary" | "products" | "topProducts" | "inventory" | "customers" | "ppc"
> & {
  summary: AmazonPremiumData["summary"] & {
    profit: number;
    margin: number;
    ppcSpend: number;
    acos: number;
    tacos: number;
  };
  products: AdvancedProduct[];
  topProducts: AdvancedProduct[];
  funnel: {
    impressions: number;
    views: number;
    cartAdds: number;
    checkoutStarts: number;
    orders: number;
    viewDrop: number;
    cartAbandonment: number;
  };
  variantEconomics: {
    product: string;
    variant: string;
    sku: string;
    price: number;
    stock: number | null;
    availabilityMode: "PRE_ORDER" | "STOCKED";
    orders: number;
    units: number;
    revenue: number;
    unitCost: number;
    cost: number;
    profit: number;
    margin: number;
  }[];
  competitor: {
    product: string;
    variant: string;
    price: number;
    competitorAverage: number | null;
    priceGap: number | null;
    sampleSize: number;
    position: string;
    listingScore: number;
  }[];
  listingQuality: {
    productId: string;
    product: string;
    score: number;
    actions: string[];
  }[];
  reviews: {
    product: string;
    reviews: number;
    average: number;
    negative: number;
    commonConcern: string[];
  }[];
  cancellations: {
    count: number;
    rate: number;
    reasons: { reason: string; count: number }[];
  };
  cohorts: {
    cohort: string;
    customers: number;
    orders: number;
    revenue: number;
  }[];
  alerts: { level: string; title: string; action: string }[];
  inventory: Array<
    AmazonPremiumData["inventory"][number] & {
      daysOfCover: number | null;
      reorderQuantity: number;
      forecast7: number;
      forecast30: number;
      deadStock: boolean;
    }
  >;
  customers: AmazonPremiumData["customers"] & { averageNetRevenue: number };
  ppc: {
    id: string;
    productId: string;
    name: string;
    product: string;
    status: "ACTIVE" | "PAUSED";
    keywords: string[];
    negativeKeywords: string[];
    dailyBudget: number;
    bid: number;
    impressions: number;
    clicks: number;
    ctr: number;
    orders: number;
    spend: number;
    estimatedSpend: number;
    sales: number;
    acos: number;
    roas: number;
  }[];
};

export interface PremiumDecisionExtras {
  traffic: {
    source: string;
    impressions: number;
    clicks: number;
    ctr: number;
    orders: number;
    conversion: number;
    revenue: number;
  }[];
  attribution: {
    organic: { orders: number; revenue: number };
    ppc: { orders: number; revenue: number };
    boost: { orders: number; revenue: number };
  };
  ranking: {
    productId: string;
    product: string;
    currentRank: number;
    categoryRank: number;
    health: { seo: string; ctr: string; conversion: string; rating: string };
  }[];
  boost: {
    product: string;
    status: string;
    endsAt: string | null;
    impressions: number;
    clicks: number;
    orders: number;
    revenue: number;
  }[];
  sellerPerformance: {
    score: number;
    acceptanceRate: number;
    fulfillmentRate: number;
    cancellationRate: number;
    averageRating: number;
    availableListings: number;
    totalListings: number;
  };
  orderAnalytics: {
    total: number;
    pending: number;
    preparing: number;
    completed: number;
    cancelled: number;
    acceptanceRate: number;
    fulfillmentRate: number;
  };
  funnel: {
    impressions: number;
    views: number;
    cartAdds: number;
    checkoutStarts: number;
    orders: number;
    viewDrop: number;
    cartAbandonment: number;
    stages: { name: string; value: number }[];
    biggestDrop: { from: string; to: string; drop: number } | null;
  };
}

export const amazonPremiumService = {
  get: (days: number, sellerId?: string) =>
    apiRequest<AdvancedAmazonPremiumData & PremiumDecisionExtras>(
      `/seller/analytics/premium?days=${days}${sellerId ? `&sellerId=${encodeURIComponent(sellerId)}` : ""}`,
    ),
};

export interface PpcCampaign {
  id: string;
  productId: string;
  name: string;
  keywords: string[];
  negativeKeywords: string[];
  dailyBudget: number;
  bid: number;
  status: "ACTIVE" | "PAUSED";
  startsAt: string;
  endsAt?: string;
}

export const ppcCampaignService = {
  list: () => apiRequest<PpcCampaign[]>("/seller/ppc-campaigns"),
  create: (input: {
    productId: string;
    name: string;
    keywords: string[];
    negativeKeywords: string[];
    dailyBudget: number;
    bid: number;
  }) =>
    apiRequest<PpcCampaign>("/seller/ppc-campaigns", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  setStatus: (id: string, status: "ACTIVE" | "PAUSED") =>
    apiRequest<PpcCampaign>(`/seller/ppc-campaigns/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

export interface ProductIntelligenceSettings {
  id: string;
  name: string;
  costPrice: number;
  seoTitle: string;
  searchKeywords: string[];
  metaDescription: string;
}

export const productIntelligenceService = {
  list: () =>
    apiRequest<ProductIntelligenceSettings[]>(
      "/seller/analytics/product-intelligence-settings",
    ),
  save: (id: string, input: Omit<ProductIntelligenceSettings, "id" | "name">) =>
    apiRequest<ProductIntelligenceSettings>(
      `/seller/analytics/product-intelligence-settings/${id}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
};

export const analyticsTrackingService = {
  browse: (productIds: string[], type: "LISTING_IMPRESSION" | "PRODUCT_VIEW", query?: string) =>
    apiRequest<null>("/analytics/events/browse", {
      method: "POST",
      body: JSON.stringify({ productIds, type, query: query || undefined, source: query ? "ORGANIC_SEARCH" : "MARKETPLACE" }),
    }),
  addToCart: (productId: string, quantity: number) =>
    apiRequest<null>("/analytics/events/cart", {
      method: "POST",
      body: JSON.stringify({ productId, quantity }),
    }),
  funnel: (
    productIds: string[],
    type: "CHECKOUT_STARTED" | "REMOVE_FROM_CART",
  ) =>
    apiRequest<null>("/analytics/events/funnel", {
      method: "POST",
      body: JSON.stringify({ productIds, type }),
    }),
};
