import { useQuery } from "@tanstack/react-query";
import {
Search
} from "lucide-react";
import { useEffect,useMemo,useState } from "react";
import { FoodCard } from "../../components/FoodCard";
import {
Button,
Empty,
Loading
} from "../../components/ui";
import {
analyticsTrackingService,
foodService
} from "../../services";

const cats = [
  ["Food", "🍱"],
  ["Men's Clothing", "👔"],
  ["Men's Accessories", "⌚"],
  ["Women's Clothing", "👗"],
  ["Women's Accessories", "👜"],
  ["Kids Items", "🧸"],
  ["Stationery", "📚"],
];

const foodCategories = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snacks",
  "Desserts",
  "Drinks",
  "Homemade",
  "Healthy",
];

const marketplaceSubcategories: Record<string, string[]> = {
  Food: foodCategories,
  "Men's Clothing": [
    "Shirts",
    "T-Shirts",
    "Pants",
    "Jeans",
    "Jackets",
    "Traditional Wear",
  ],
  "Men's Accessories": ["Watches", "Wallets", "Belts", "Bags", "Sunglasses"],
  "Women's Clothing": [
    "Kurtis",
    "Sarees",
    "Tops",
    "Dresses",
    "Pants",
    "Traditional Wear",
  ],
  "Women's Accessories": [
    "Bags",
    "Jewelry",
    "Scarves",
    "Watches",
    "Hair Accessories",
  ],
  "Kids Items": [
    "Clothing",
    "Toys",
    "School Supplies",
    "Art & Learning",
    "Baby Care",
  ],
  Stationery: [
    "Notebooks",
    "Pens & Pencils",
    "Art Supplies",
    "Study Kits",
    "Office Supplies",
  ],
};

export function Foods() {
  const params = new URLSearchParams(location.search);
  const [q, setQ] = useState(params.get("q") ?? ""),
    [page, setPage] = useState(1),
    [cat, setCat] = useState(params.get("category") ?? "All"),
    [subcat, setSubcat] = useState("All"),
    [sort, setSort] = useState("Recommended"),
    [special, setSpecial] = useState<"all" | "discounted" | "featured">("all"),
    [maxPrice, setMaxPrice] = useState(5000),
    [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 500);
    return () => window.clearTimeout(timer);
  }, [q]);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "product-feed",
      debouncedQ,
      cat,
      subcat,
      special,
      sort,
      maxPrice,
      page,
    ],
    queryFn: () =>
      foodService.getFeed(
        debouncedQ,
        page,
        cat,
        subcat,
        special,
        sort,
        maxPrice,
      ),
    placeholderData: (previous) => previous,
  });
  const shown = useMemo(() => data?.items ?? [], [data]);
  useEffect(() => {
    if (isFetching) return;
    const ids = shown.slice(0, 40).map((item) => item.id);
    if (ids.length) void analyticsTrackingService.browse(ids, "LISTING_IMPRESSION", debouncedQ).catch(() => undefined);
  }, [shown, debouncedQ, isFetching]);
  return (
    <div className="container-x py-12">
      <div className="rounded-[2rem] bg-ink px-6 py-10 text-white sm:px-10">
        <p className="font-bold text-emerald-400">B MARKET</p>
        <h1 className="mt-2 text-4xl font-extrabold">
          What are you looking for?
        </h1>
        <div className="mt-6 flex max-w-xl items-center gap-3 rounded-2xl bg-white px-4 text-ink">
          <Search />
          <input
            className="w-full py-4 outline-none"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search products, sellers, categories..."
          />
        </div>
      </div>
      <div className="mt-8 grid gap-7 lg:grid-cols-[240px,1fr]">
        <aside className="card h-fit p-5">
          <h3 className="font-extrabold">Filters</h3>
          <label className="label mt-5">Category</label>
          <select
            className="field"
            value={cat}
            onChange={(e) => {
              setCat(e.target.value);
              setSubcat("All");
              setPage(1);
            }}
          >
            <option>All</option>
            {cats.map((c) => (
              <option key={c[0]}>{c[0]}</option>
            ))}
          </select>
          {cat !== "All" && (
            <>
              <label className="label mt-5">Subcategory</label>
              <select
                className="field"
                value={subcat}
                onChange={(e) => {
                  setSubcat(e.target.value);
                  setPage(1);
                }}
              >
                <option value="All">All {cat}</option>
                {(marketplaceSubcategories[cat] ?? []).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </>
          )}
          <label className="label mt-5">Price range</label>
          <input
            type="range"
            min={50}
            max={5000}
            step={50}
            value={maxPrice}
            onChange={(e) => {
              setMaxPrice(Number(e.target.value));
              setPage(1);
            }}
            className="w-full accent-emerald-600"
          />
          <div className="flex justify-between text-xs text-stone-500">
            <span>৳50</span>
            <span>Up to ৳{maxPrice.toLocaleString()}</span>
          </div>
          <label className="label mt-5">Listing type</label>
          <div className="mt-2 grid gap-2">
            {(
              [
                { label: "All products", value: "all" },
                { label: "Discounted", value: "discounted" },
                { label: "Featured", value: "featured" },
              ] as const
            ).map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => {
                  setSpecial(option.value);
                  setPage(1);
                }}
                className={`rounded-xl border px-3 py-2 text-left text-sm font-bold transition ${special === option.value ? "border-brand-600 bg-brand-50 text-brand-700" : "border-stone-200 hover:bg-stone-50"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </aside>
        <main>
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm text-stone-500">
              <b className="text-ink">{data?.total ?? shown.length}</b> products
              available
            </p>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="field w-auto"
            >
              <option>Recommended</option>
              <option>Price low to high</option>
              <option>Price high to low</option>
              <option>Newest</option>
            </select>
          </div>
          {isLoading ? (
            <Loading />
          ) : shown.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((f) => (
                <FoodCard key={f.id} food={f} />
              ))}
            </div>
          ) : (
            <Empty />
          )}
          {(data?.totalPages ?? 1) > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <span className="text-sm font-bold">
                Page {data?.page ?? page} of {data?.totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= (data?.totalPages ?? 1) || isFetching}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
