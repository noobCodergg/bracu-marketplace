import type {
FoodItem
} from "../types";
import { apiRequest } from './http';

export type ProductSaveInput = {
  id?: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  prepMinutes: number;
  status: Exclude<FoodItem["status"], "REMOVED">;
  images: string[];
  variants: NonNullable<FoodItem["variants"]>;
  ingredients: string[];
  dietary: string[];
  spicy: number;
  deliverySlots: string[];
  seoTitle: string;
  searchKeywords: string[];
  metaDescription: string;
};

export interface ProductFeedPage {
  items: FoodItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const productService = {
  list: (q = "") =>
    apiRequest<FoodItem[]>(
      `/products${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
  mine: () => apiRequest<FoodItem[]>("/products/mine"),
  getById: (id: string) => apiRequest<FoodItem>(`/products/${id}`),
  getOwned: (id:string)=>apiRequest<FoodItem>(`/products/mine/${id}`),
  save: (input: ProductSaveInput) =>
    apiRequest<FoodItem>(input.id ? `/products/${input.id}` : "/products", {
      method: input.id ? "PATCH" : "POST",
      body: JSON.stringify(input),
    }),
  setStatus: (id: string, status: Exclude<FoodItem["status"], "REMOVED">) =>
    apiRequest<FoodItem>(`/products/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  boost: (id: string, days: number) =>
    apiRequest<FoodItem>(`/products/${id}/boost`, {
      method: "POST",
      body: JSON.stringify({ days }),
    }),
  remove: (id: string) =>
    apiRequest<{ id: string }>(`/products/${id}`, { method: "DELETE" }),
};

export const foodService = {
  getFoods: (q = "") => productService.list(q),
  getBestSelling: () => apiRequest<FoodItem[]>("/products/best-selling"),
  getFeed: (
    q = "",
    page = 1,
    category = "All",
    subcategory = "All",
    special = "all",
    sort = "Recommended",
    maxPrice = 5000,
  ) => {
    const params = new URLSearchParams({
      paginated: "true",
      page: String(page),
      special,
      sort,
      maxPrice: String(maxPrice),
    });
    if (q) params.set("q", q);
    if (category !== "All") params.set("category", category);
    if (subcategory !== "All") params.set("subcategory", subcategory);
    return apiRequest<ProductFeedPage>(`/products?${params}`);
  },
  getById: (id: string) => productService.getById(id),

};
