import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import {
BarChart3,
CircleDollarSign,
Crown,
Lock,
Package,
ShoppingBag,
TrendingUp,
Users,
} from "lucide-react";
import { useState } from "react";
import { Link,useParams } from "react-router-dom";
import {
Area,
AreaChart,
Bar,
BarChart,
CartesianGrid,
ResponsiveContainer,
Tooltip,
XAxis,
YAxis,
} from "recharts";
import { Badge,Button,Empty,Loading } from "../components/ui";
import {
amazonPremiumService,
analyticsPlan,
boostPlans,
ppcCampaignService,
productIntelligenceService,
productService,
sellerAnalyticsService,
} from "../services";
import { toast } from '../store/toast';

const money = (value: number) => `৳${value.toLocaleString()}`;
const statusTone = (
  status: string,
): "green" | "amber" | "red" | "gray" | "purple" =>
  ["COMPLETED", "DELIVERED", "ACTIVE"].includes(status)
    ? "green"
    : status === "CANCELLED" || status === "RETURNED" || status === "OUT_OF_STOCK"
      ? "red"
      : status === "PAUSED"
        ? "gray"
        : "amber";
function Metric({
  label,
  value,
  Icon,
  color,
  detail,
}: {
  label: string;
  value: string;
  Icon: typeof ShoppingBag;
  color: string;
  detail?: string;
}) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span
        className={`grid h-12 w-12 place-items-center rounded-2xl ${color}`}
      >
        <Icon size={22} />
      </span>
      <div>
        <p className="text-sm text-stone-500">{label}</p>
        <b className="text-2xl">{value}</b>
        {detail && <p className="text-xs text-stone-500">{detail}</p>}
      </div>
    </div>
  );
}
function Table({
  title,
  headers,
  rows,
  empty,
}: {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  empty: string;
}) {
  const pageSize = 15,
    [requestedPage, setPage] = useState(1),
    pages = Math.max(1, Math.ceil(rows.length / pageSize)),
    page = Math.min(requestedPage, pages),
    shown = rows.slice((page - 1) * pageSize, page * pageSize);
  return (
    <div className="card min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b p-5">
        <h3 className="font-extrabold">{title}</h3>
        {rows.length > pageSize && (
          <span className="shrink-0 text-xs text-stone-500">
            {rows.length} rows
          </span>
        )}
      </div>
      {rows.length ? (
        <>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="sticky top-0 z-10 bg-stone-50 shadow-sm">
                <tr>
                  {headers.map((h) => (
                    <th className="whitespace-nowrap px-4 py-3" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((row, i) => (
                  <tr className="border-t" key={`${page}-${i}`}>
                    {row.map((cell, j) => (
                      <td
                        className={`whitespace-nowrap px-4 py-3 ${j === 0 ? "font-bold" : ""}`}
                        key={j}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t bg-white p-3 text-sm">
              <span>
                Page {page} of {pages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage(Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={page === pages}
                  onClick={() => setPage(Math.min(pages, page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="p-8 text-center text-sm text-stone-500">{empty}</div>
      )}
    </div>
  );
}

function CoreAnalytics({
  dashboard,
  days,
  setDays,
  summaryOnly = false,
  sellerId,
}: {
  dashboard: boolean;
  days: number;
  setDays: (days: number) => void;
  summaryOnly?: boolean;
  sellerId?: string;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["real-seller-analytics", sellerId ?? "self", days],
    queryFn: () => sellerAnalyticsService.get(days, sellerId),
    staleTime: 300_000,
  });
  if (isLoading) return <Loading />;
  if (isError || !data)
    return (
      <Empty
        title="Analytics unavailable"
        body="Could not load analytics from the server."
      />
    );
  const s = data.summary;
  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">
            {dashboard ? "Seller overview" : "Business reports"}
          </h1>
          <p className="text-stone-500">
            Real performance from your orders, products, customers and
            promotions.
          </p>
        </div>
        {!dashboard && (
          <select
            className="field w-auto"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>Today</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Net revenue"
          value={money(s.netSales)}
          Icon={CircleDollarSign}
          color="bg-emerald-100 text-emerald-700"
          detail={`${data.comparison.revenue >= 0 ? "+" : ""}${data.comparison.revenue}% vs previous`}
        />
        <Metric
          label="Orders"
          value={String(s.completedOrders)}
          Icon={ShoppingBag}
          color="bg-blue-100 text-blue-700"
          detail={`${data.comparison.orders >= 0 ? "+" : ""}${data.comparison.orders}% vs previous`}
        />
        <Metric
          label="Units sold"
          value={String(s.unitsSold)}
          Icon={Package}
          color="bg-violet-100 text-violet-700"
          detail={`${data.comparison.units >= 0 ? "+" : ""}${data.comparison.units}% vs previous`}
        />
        <Metric
          label="Average net revenue"
          value={money(s.averageOrderValue)}
          Icon={TrendingUp}
          color="bg-amber-100 text-amber-700"
          detail={`${data.comparison.averageOrderValue >= 0 ? "+" : ""}${data.comparison.averageOrderValue}% vs previous`}
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Chart title="Revenue trend" data={data.trend} field="revenue" />
        <Chart title="Order trend" data={data.trend} field="orders" />
      </div>
      {!summaryOnly && !dashboard && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Metric
              label="Gross sales"
              value={money(s.grossSales)}
              Icon={CircleDollarSign}
              color="bg-blue-100 text-blue-700"
            />
            <Metric
              label="Discounts"
              value={money(s.totalDiscounts)}
              Icon={TrendingUp}
              color="bg-red-100 text-red-700"
            />
            <Metric
              label="Total product costs"
              value={money(s.totalCost)}
              Icon={Package}
              color="bg-orange-100 text-orange-700"
            />
            <Metric
              label="Repeat buyers"
              value={`${s.repeatBuyerRate}%`}
              Icon={Users}
              color="bg-violet-100 text-violet-700"
            />
            <Metric
              label="Cancellation"
              value={`${s.cancellationRate}%`}
              Icon={BarChart3}
              color="bg-amber-100 text-amber-700"
            />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Table
              title="Product revenue"
              headers={["Product", "Orders", "Units", "Discounts", "Net revenue"]}
              rows={data.topProducts.map((x) => [
                x.name,
                x.orders,
                x.units,
                money(x.discounts),
                money(x.revenue),
              ])}
              empty="No product sales"
            />
            <Table
              title="Variant / SKU performance"
              headers={[
                "Product",
                "Variant",
                "Orders",
                "Units",
                "Revenue",
                "Cost",
                "Profit",
                "Margin",
              ]}
              rows={data.variantPerformance.map((x) => [
                x.product,
                x.variant,
                x.orders,
                x.units,
                money(x.revenue),
                money(x.cost),
                money(x.profit),
                `${x.margin}%`,
              ])}
              empty="No variant sales"
            />
            <Table
              title="Coupon performance"
              headers={["Code", "Rate", "Orders", "Discount", "Revenue"]}
              rows={data.couponPerformance.map((x) => [
                x.code,
                `${x.discountPercent}%`,
                x.periodOrders,
                money(x.discountGiven),
                money(x.revenue),
              ])}
              empty="No coupon usage"
            />
            <Table
              title="Top customers"
              headers={["Buyer", "Orders", "Units", "Spend"]}
              rows={data.topBuyers.map((x) => [
                x.buyer,
                x.orders,
                x.units,
                money(x.spend),
              ])}
              empty="No completed buyers"
            />
          </div>
        </>
      )}
      {!summaryOnly && (
        <div className="card mt-6 p-6">
          <h3 className="font-extrabold">Recent orders</h3>
          <div className="mt-4 space-y-3">
            {data.recentOrders.length ? (
              data.recentOrders.map((order) => (
                <div
                  className="flex flex-wrap items-center gap-3 border-b pb-3 last:border-0"
                  key={order.id}
                >
                  <img
                    src={order.image}
                    className="h-11 w-12 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <b>{order.food}</b>
                    <p className="text-xs text-stone-500">
                      {order.buyer} · Qty {order.quantity}
                    </p>
                  </div>
                  <b>{money(order.total)}</b>
                  <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-stone-500">
                No orders in this period.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Chart({
  title,
  data,
  field,
}: {
  title: string;
  data: { label: string; revenue: number; orders: number }[];
  field: "revenue" | "orders";
}) {
  return (
    <div className="card p-6">
      <h2 className="font-extrabold">{title}</h2>
      <div className="mt-5 h-72">
        <ResponsiveContainer>
          {field === "revenue" ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" minTickGap={24} />
              <YAxis />
              <Tooltip />
              <Area
                dataKey="revenue"
                stroke="#16894a"
                fill="#d9f5e2"
                strokeWidth={3}
              />
            </AreaChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" minTickGap={24} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="orders" fill="#20a45b" radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PremiumGate({ onUnlock }: { onUnlock: () => void }) {
  return (
    <section className="rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-violet-50 p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge tone="amber">
            <Crown size={13} /> PREMIUM ANALYTICS
          </Badge>
          <h1 className="mt-3 text-3xl font-extrabold">
            Seller decision intelligence
          </h1>
          <p className="mt-2 max-w-2xl text-stone-500">
            Sales, products, conversion, traffic, ranking, PPC, Boost,
            customers, inventory, benchmarks and recommendations are included in
            one premium workspace.
          </p>
          <p className="mt-4 text-2xl font-extrabold text-amber-800">
            {money(analyticsPlan.price)} <span className="text-sm font-semibold text-stone-500">/ month</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-700">
            {money(boostPlans.find((plan) => plan.days === 30)!.price - analyticsPlan.price)} less than a 30-day product boost
                   </p>
        </div>
        <Button onClick={onUnlock}>
          <Lock size={16} />
          Start monthly plan
        </Button>
      </div>
      <div className="mt-7 grid gap-4 md:grid-cols-3">
        {[
          "Business & product performance",
          "Traffic, funnel & ranking",
          "PPC, Boost & growth actions",
        ].map((x) => (
          <div className="card p-5" key={x}>
            <Lock className="text-amber-600" />
            <h3 className="mt-4 font-extrabold">{x}</h3>
            <p className="mt-2 text-sm text-stone-500">
              Available with Seller Premium.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PremiumData({
  data,
}: {
  data: Awaited<ReturnType<typeof amazonPremiumService.get>>;
}) {
  const ctr = data.summary.impressions
    ? Math.round((data.summary.views / data.summary.impressions) * 10000) / 100
    : 0;
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Impressions"
          value={String(data.summary.impressions)}
          Icon={BarChart3}
          color="bg-blue-100 text-blue-700"
        />
        <Metric
          label="Product views"
          value={String(data.summary.views)}
          Icon={TrendingUp}
          color="bg-violet-100 text-violet-700"
        />
        <Metric
          label="Add to cart"
          value={String(data.summary.cartAdds)}
          Icon={ShoppingBag}
          color="bg-amber-100 text-amber-700"
        />
        <Metric
          label="Overall CTR"
          value={`${ctr}%`}
          Icon={TrendingUp}
          color="bg-emerald-100 text-emerald-700"
        />
      </div>
      <div>
        <h3 className="text-xl font-extrabold">Top 3 products</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {data.topProducts.map((x, i) => (
            <div className="card p-5" key={x.id}>
              <span className="badge bg-amber-100 text-amber-700">
                #{i + 1}
              </span>
              <div className="mt-3 flex gap-3">
                <img
                  src={x.image}
                  className="h-16 w-20 rounded-xl object-cover"
                />
                <div>
                  <b>{x.name}</b>
                  <p className="text-xs text-stone-500">
                    {x.views} views · {x.orders} orders
                  </p>
                  <p className="font-bold text-emerald-700">
                    {x.conversionRate}% view-to-buy
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ProductPerformance products={data.products} />
      <Losses items={data.lostPotential} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Table
          title="Demand by product, day & time"
          headers={["Product", "Day", "Time", "Orders", "Units", "Net revenue"]}
          rows={data.demand.map((x) => [
            x.product,
            x.day,
            x.period,
            x.orders,
            x.units,
            money(x.sales),
          ])}
          empty="Demand appears after completed orders"
        />
        <Table
          title="Related search keywords"
          headers={[
            "Keyword",
            "Searches",
            "Matches",
            "Views",
            "Orders",
            "Conversion",
          ]}
          rows={data.keywords.map((x) => [
            x.keyword,
            x.searches,
            x.matchedProducts,
            x.views,
            x.orders,
            `${x.conversionRate}%`,
          ])}
          empty="Search data appears after buyer searches"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Advice title="Keyword suggestions" items={data.keywordSuggestions} />
        <Advice title="Search opportunities" items={data.searchOpportunities} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Table
          title={`Top customers · ${data.customers.repeatRate}% repeat`}
          headers={["Buyer", "Orders", "Units", "Spend"]}
          rows={data.customers.top.map((x) => [
            x.buyer,
            x.orders,
            x.units,
            money(x.spend),
          ])}
          empty="No completed customers"
        />
        <Table
          title="Repeat customers"
          headers={["Buyer", "Orders", "Units", "Lifetime spend"]}
          rows={data.customers.repeat.map((x) => [
            x.buyer,
            x.orders,
            x.units,
            money(x.spend),
          ])}
          empty="No repeat customers"
        />
      </div>
    </div>
  );
}
function Advice({
  title,
  items,
}: {
  title: string;
  items: Awaited<ReturnType<typeof amazonPremiumService.get>>["keywords"];
}) {
  const pageSize = 6,
    [requestedPage, setPage] = useState(1),
    pages = Math.max(1, Math.ceil(items.length / pageSize)),
    page = Math.min(requestedPage, pages),
    shown = items.slice((page - 1) * pageSize, page * pageSize);
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-extrabold">{title}</h3>
        {items.length > 0 && (
          <span className="text-xs text-stone-500">{items.length} items</span>
        )}
      </div>
      <div className="mt-4 space-y-3">
        {shown.length ? (
          shown.map((x) => (
            <div className="rounded-xl border p-3" key={x.keyword}>
              <div className="flex justify-between">
                <b>“{x.keyword}”</b>
                <span className="text-sm">{x.searches} searches</span>
              </div>
              <p className="mt-1 text-sm text-brand-700">{x.suggestion}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-stone-500">Not enough search data yet.</p>
        )}
      </div>
      {pages > 1 && <Pager page={page} pages={pages} onChange={setPage} />}
    </div>
  );
}

function ProductPerformance({
  products,
}: {
  products: Awaited<ReturnType<typeof amazonPremiumService.get>>["products"];
}) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("ALL"),
    [sort, setSort] = useState("revenue"),
    [page, setPage] = useState(1);
  const filtered = products
    .filter(
      (x) =>
        x.name.toLowerCase().includes(search.toLowerCase()) &&
        (status === "ALL" || x.status === status),
    )
    .sort((a, b) =>
      sort === "conversion"
        ? b.conversionRate - a.conversionRate
        : sort === "views"
          ? b.views - a.views
          : b.sales - a.sales,
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const shown = filtered.slice((page - 1) * 10, page * 10);
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-end gap-3 border-b p-5">
        <div className="mr-auto">
          <h3 className="font-extrabold">Product performance</h3>
          <p className="text-xs text-stone-500">
            Search, filter and sort the complete product funnel.
          </p>
        </div>
        <input
          className="field w-52"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search product"
        />
        <select
          className="field w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All statuses</option>
          <option>ACTIVE</option>
          <option>PRE_ORDER_AVAILABLE</option>
          <option>OUT_OF_STOCK</option>
          <option>PAUSED</option>
        </select>
        <select
          className="field w-auto"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="revenue">Revenue</option>
          <option value="conversion">Conversion</option>
          <option value="views">Views</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-stone-50">
            <tr>
              {[
                "Product",
                "Status",
                "Impressions",
                "Views / CTR",
                "Cart",
                "Orders / Units",
                "Revenue",
                "Conversion",
                "Rating",
                "Health",
              ].map((x) => (
                <th className="px-4 py-3" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => (
              <tr className="border-t" key={x.id}>
                <td className="px-4 py-3 font-bold">{x.name}</td>
                <td className="px-4 py-3">{x.status.replaceAll("_", " ")}</td>
                <td className="px-4 py-3">{x.impressions}</td>
                <td className="px-4 py-3">
                  {x.views} / {x.ctr}%
                </td>
                <td className="px-4 py-3">{x.carts}</td>
                <td className="px-4 py-3">
                  {x.orders} / {x.units}
                </td>
                <td className="px-4 py-3">{money(x.sales)}</td>
                <td className="px-4 py-3">{x.conversionRate}%</td>
                <td className="px-4 py-3">{x.rating}</td>
                <td className="px-4 py-3">{x.listingScore}/100</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t p-4 text-sm">
        <span>{filtered.length} products</span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="px-2 py-2">
            {page}/{pages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function AdvancedPremium({
  data,
}: {
  data: Awaited<ReturnType<typeof amazonPremiumService.get>>;
}) {
  return (
    <section className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Net revenue"
          value={money(data.summary.sales)}
          Icon={CircleDollarSign}
          color="bg-emerald-100 text-emerald-700"
          detail={`${data.summary.margin}% margin`}
        />
        <Metric
          label="Cart abandonment"
          value={`${data.funnel.cartAbandonment}%`}
          Icon={ShoppingBag}
          color="bg-red-100 text-red-700"
        />
        <Metric
          label="Avg. net revenue / customer"
          value={money(data.customers.averageNetRevenue)}
          Icon={Users}
          color="bg-violet-100 text-violet-700"
        />
        <Metric
          label="TACOS"
          value={`${data.summary.tacos}%`}
          Icon={BarChart3}
          color="bg-amber-100 text-amber-700"
        />
      </div>
      <div className="card p-6">
        <h3 className="font-extrabold">Conversion funnel</h3>
        <div className="mt-5 grid gap-3 sm:grid-cols-5">
          {data.funnel.stages.map((stage, index) => (
            <div
              className="rounded-2xl bg-stone-50 p-4 text-center"
              key={stage.name}
            >
              <p className="text-xs font-bold uppercase text-stone-500">
                {stage.name}
              </p>
              <b className="mt-1 block text-2xl">{stage.value}</b>
              {index > 0 && (
                <small className="text-stone-400">
                  {data.funnel.stages[index - 1]!.value
                    ? Math.round(
                        (stage.value / data.funnel.stages[index - 1]!.value) *
                          100,
                      )
                    : 0}
                  % retained
                </small>
              )}
            </div>
          ))}
        </div>
        {data.funnel.biggestDrop && (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            Biggest drop-off: {data.funnel.biggestDrop.from} →{" "}
            {data.funnel.biggestDrop.to} ({data.funnel.biggestDrop.drop}%).
            Focus improvements on this transition first.
          </p>
        )}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Table
          title="Traffic source performance"
          headers={[
            "Source",
            "Impressions",
            "Clicks",
            "CTR",
            "Orders",
            "Conversion",
            "Revenue",
          ]}
          rows={data.traffic.map((x) => [
            x.source.replaceAll("_", " "),
            x.impressions,
            x.clicks,
            `${x.ctr}%`,
            x.orders,
            `${x.conversion}%`,
            money(x.revenue),
          ])}
          empty="Traffic attribution starts as buyers discover products"
        />
        <Table
          title="Organic vs PPC vs Boost"
          headers={["Channel", "Orders", "Revenue", "Revenue share"]}
          rows={(
            [
              ["Organic", data.attribution.organic],
              ["PPC", data.attribution.ppc],
              ["Boost", data.attribution.boost],
            ] as const
          ).map(([name, x]) => [
            name,
            x.orders,
            money(x.revenue),
            `${data.summary.sales ? Math.round((x.revenue / data.summary.sales) * 100) : 0}%`,
          ])}
          empty="No attributed sales"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Table
          title="Listing health order"
          headers={[
            "Product",
            "Health position",
            "Category position",
            "SEO",
            "CTR",
            "Conversion",
            "Rating",
          ]}
          rows={data.ranking.map((x) => [
            x.product,
            `#${x.currentRank}`,
            `#${x.categoryRank}`,
            x.health.seo,
            x.health.ctr,
            x.health.conversion,
            x.health.rating,
          ])}
          empty="No products to rank"
        />
        <Table
          title="Boost performance"
          headers={[
            "Product",
            "Status",
            "Impressions",
            "Clicks",
            "Orders",
            "Revenue",
          ]}
          rows={data.boost.map((x) => [
            x.product,
            x.status,
            x.impressions,
            x.clicks,
            x.orders,
            money(x.revenue),
          ])}
          empty="No boosted products in this period"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Seller performance"
          value={`${data.sellerPerformance.score}/100`}
          Icon={TrendingUp}
          color="bg-emerald-100 text-emerald-700"
        />
        <Metric
          label="Acceptance rate"
          value={`${data.sellerPerformance.acceptanceRate}%`}
          Icon={ShoppingBag}
          color="bg-blue-100 text-blue-700"
        />
        <Metric
          label="Fulfillment rate"
          value={`${data.sellerPerformance.fulfillmentRate}%`}
          Icon={Package}
          color="bg-violet-100 text-violet-700"
        />
        <Metric
          label="Average rating"
          value={String(data.sellerPerformance.averageRating)}
          Icon={Users}
          color="bg-amber-100 text-amber-700"
        />
      </div>
      <Table
        title="Order operations"
        headers={[
          "Total",
          "Pending",
          "In fulfillment",
          "Completed",
          "Cancelled",
          "Acceptance",
          "Fulfillment",
        ]}
        rows={[
          [
            data.orderAnalytics.total,
            data.orderAnalytics.pending,
            data.orderAnalytics.preparing,
            data.orderAnalytics.completed,
            data.orderAnalytics.cancelled,
            `${data.orderAnalytics.acceptanceRate}%`,
            `${data.orderAnalytics.fulfillmentRate}%`,
          ],
        ]}
        empty="No orders"
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Table
          title="Variant profit & inventory"
          headers={[
            "Product",
            "Variant / SKU",
            "Price",
            "Stock",
            "Units",
            "Revenue",
            "Unit cost",
            "Profit",
            "Margin",
          ]}
          rows={data.variantEconomics.map((x) => [
            x.product,
            `${x.variant}${x.sku ? ` · ${x.sku}` : ""}`,
            money(x.price),
            x.availabilityMode === "PRE_ORDER" ? "Pre-order" : (x.stock ?? 0),
            x.units,
            money(x.revenue),
            money(x.unitCost),
            money(x.profit),
            `${x.margin}%`,
          ])}
          empty="Add variants to calculate economics"
        />
        <Table
          title="Competitor prices ? sample of up to 1,000 active listings"
          headers={[
            "Product",
            "Variant",
            "Your price",
            "Market average",
            "Gap",
            "Samples",
            "Position",
          ]}
          rows={data.competitor.map((x) => [
            x.product,
            x.variant,
            money(x.price),
            x.competitorAverage == null
              ? "No exact match"
              : money(x.competitorAverage),
            x.priceGap == null ? "—" : money(x.priceGap),
            x.sampleSize,
            x.position,
          ])}
          empty="No products to compare"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Table
          title="Availability and demand planning"
          headers={[
            "Product",
            "Mode",
            "Stock",
            "7-day demand",
            "30-day demand",
            "Cover / action",
          ]}
          rows={data.inventory.map((x) => [
            x.name,
            x.status === "PRE_ORDER_AVAILABLE"
              ? "Pre-order"
              : x.status === "OUT_OF_STOCK"
                ? "Out of stock"
                : "Stocked",
            x.status === "PRE_ORDER_AVAILABLE"
              ? "Not stock-limited"
              : x.baseQuantity,
            x.forecast7,
            x.forecast30,
            x.status === "PRE_ORDER_AVAILABLE"
              ? "Accepting advance orders"
              : x.daysOfCover == null
                ? "No sales velocity"
                : `${x.daysOfCover} days · reorder ${x.reorderQuantity}`,
          ])}
          empty="No inventory"
        />
        <Table
          title="PPC campaigns · ACOS / ROAS"
          headers={[
            "Campaign",
            "Status",
            "Clicks",
            "Orders",
            "Spend",
            "Net revenue",
            "ACOS",
            "ROAS",
          ]}
          rows={data.ppc.map((x) => [
            x.name,
            x.status,
            x.clicks,
            x.orders,
            money(x.spend),
            money(x.sales),
            `${x.acos}%`,
            `${x.roas}x`,
          ])}
          empty="No PPC campaign"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Table
          title="Customer cohorts"
          headers={["Cohort", "Customers", "Orders", "Revenue"]}
          rows={data.cohorts.map((x) => [
            x.cohort,
            x.customers,
            x.orders,
            money(x.revenue),
          ])}
          empty="No cohort data"
        />
        <Table
          title="Review intelligence"
          headers={["Product", "Reviews", "Average", "Negative", "Concerns"]}
          rows={data.reviews.map((x) => [
            x.product,
            x.reviews,
            x.average,
            x.negative,
            x.commonConcern.join(" | ") || "None",
          ])}
          empty="No review signals"
        />
      </div>
      <Alerts alerts={data.alerts} />
    </section>
  );
}

function PpcCampaignManager() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({
    queryKey: ["database-products"],
    queryFn: () => productService.list(),
  });
  const { data: campaigns = [] } = useQuery({
    queryKey: ["ppc-campaigns"],
    queryFn: ppcCampaignService.list,
  });
  const [productId, setProductId] = useState(""),
    [name, setName] = useState(""),
    [keywords, setKeywords] = useState(""),
    [budget, setBudget] = useState(100),
    [bid, setBid] = useState(2),
    [campaignPage, setCampaignPage] = useState(1);
  const campaignPages = Math.max(1, Math.ceil(campaigns.length / 10));
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["ppc-campaigns"] });
    void qc.invalidateQueries({ queryKey: ["amazon-premium"] });
    void qc.invalidateQueries({ queryKey: ["amazon-premium-advanced"] });
  };
  const create = useMutation({meta:{successMessage:"Campaign created."},
    mutationFn: () =>
      ppcCampaignService.create({
        productId,
        name,
        keywords: keywords
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        negativeKeywords: [],
        dailyBudget: budget,
        bid,
      }),
    onSuccess: () => {
      setName("");
      setKeywords("");
      refresh();
    },
  });
  const toggle = useMutation({meta:{successMessage:"Campaign updated."},
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "PAUSED" }) =>
      ppcCampaignService.setStatus(id, status),
    onSuccess: refresh,
  });
  return (
    <section className="card mt-6 p-6">
      <h2 className="text-xl font-extrabold">PPC campaign manager</h2>
      <p className="mt-1 text-sm text-stone-500">
        Campaign configuration only. Ad serving is not connected yet. Reports use campaign-attributed events only; spend is an estimate, not a charge.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <select
          className="field"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="">Choose product</option>
          {products.map((x) => (
            <option value={x.id} key={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Campaign name"
        />
        <input
          className="field"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="keywords, comma separated"
        />
        <input
          className="field"
          type="number"
          min="1"
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          placeholder="Daily budget"
        />
        <input
          className="field"
          type="number"
          min="0.1"
          step="0.1"
          value={bid}
          onChange={(e) => setBid(Number(e.target.value))}
          placeholder="Bid"
        />
      </div>
      <Button
        className="mt-3"
        disabled={!productId || name.trim().length < 3 || create.isPending}
        onClick={() => create.mutate()}
      >
        Create campaign
      </Button>
      {create.isError && (
        <p className="mt-2 text-sm text-red-600">
          {(create.error as Error).message}
        </p>
      )}
      <div className="mt-5 space-y-2">
        {campaigns
          .slice((campaignPage - 1) * 10, campaignPage * 10)
          .map((x) => (
            <div
              className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
              key={x.id}
            >
              <b className="flex-1">{x.name}</b>
              <span className="text-sm">
                ৳{x.dailyBudget}/day · ৳{x.bid} bid
              </span>
              <Badge tone={x.status === "ACTIVE" ? "green" : "gray"}>
                {x.status}
              </Badge>
              <Button
                variant="secondary"
                onClick={() =>
                  toggle.mutate({
                    id: x.id,
                    status: x.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
                  })
                }
              >
                {x.status === "ACTIVE" ? "Pause" : "Activate"}
              </Button>
            </div>
          ))}
      </div>
      {campaignPages > 1 && (
        <Pager
          page={campaignPage}
          pages={campaignPages}
          onChange={setCampaignPage}
        />
      )}
    </section>
  );
}

function SeoAnalyticsWorkspace() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({
    queryKey: ["product-intelligence-settings"],
    queryFn: productIntelligenceService.list,
  });
  const [selected, setSelected] = useState(""),
    [title, setTitle] = useState(""),
    [keywords, setKeywords] = useState(""),
    [description, setDescription] = useState("");
  const current = products.find((x) => x.id === selected);
  const choose = (id: string) => {
    setSelected(id);
    const item = products.find((x) => x.id === id);
    setTitle(item?.seoTitle ?? "");
    setKeywords(item?.searchKeywords.join(", ") ?? "");
    setDescription(item?.metaDescription ?? "");
  };
  const checks = [
    title.length >= 30 && title.length <= 60,
    keywords.split(",").filter((x) => x.trim()).length >= 3,
    description.length >= 80 && description.length <= 160,
    !!current &&
      title.toLowerCase().includes(current.name.split(" ")[0]!.toLowerCase()),
  ];
  const score = checks.filter(Boolean).length * 25;
  const save = useMutation({
    mutationFn: () =>
      productIntelligenceService.save(selected, {
        costPrice: current?.costPrice ?? 0,
        seoTitle: title,
        searchKeywords: keywords
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        metaDescription: description,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["product-intelligence-settings"],
      });
      void qc.invalidateQueries({ queryKey: ["amazon-premium"] });
      void qc.invalidateQueries({ queryKey: ["amazon-premium-advanced"] });
    },
  });
  return (
    <section className="card mt-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge tone="green">FREE SEO TOOL</Badge>
          <h2 className="text-xl font-extrabold">SEO intelligence workspace</h2>
          <p className="text-sm text-stone-500">
            Optimize listing discoverability and feed the keyword, ranking and
            opportunity reports above.
          </p>
        </div>
        <span
          className={`grid h-14 w-14 place-items-center rounded-full font-extrabold ${score >= 75 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
        >
          {score}
        </span>
      </div>
      <select
        className="field mt-5"
        value={selected}
        onChange={(e) => choose(e.target.value)}
      >
        <option value="">Choose your product</option>
        {products.map((x) => (
          <option value={x.id} key={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      {selected && (
        <div className="mt-4 grid gap-4">
          <label>
            <span className="label">SEO title</span>
            <input
              className="field"
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <small className="text-stone-400">
              Recommended 30–60 characters · {title.length}
            </small>
          </label>
          <label>
            <span className="label">Search keywords</span>
            <input
              className="field"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="keyword one, keyword two, keyword three"
            />
          </label>
          <label>
            <span className="label">Meta description</span>
            <textarea
              className="field min-h-24"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <small className="text-stone-400">
              Recommended 80–160 characters · {description.length}
            </small>
          </label>
          <div className="grid gap-2 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
            {[
              "Title length is optimized",
              "At least 3 keywords",
              "Description length is optimized",
              "Product name appears in title",
            ].map((label, i) => (
              <span
                className={checks[i] ? "text-emerald-700" : "text-stone-500"}
                key={label}
              >
                {checks[i] ? "✓" : "○"} {label}
              </span>
            ))}
          </div>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving..." : "Save SEO data"}
          </Button>
          {save.isSuccess && (
            <p className="font-bold text-emerald-700">
              Saved. Search and analytics now use this metadata.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export function RealSellerDashboard() {
  const [days, setDays] = useState(30);
  return <CoreAnalytics dashboard days={days} setDays={setDays} />;
}
function PremiumSuite({sellerId,adminView=false}:{sellerId?:string;adminView?:boolean}) {
  const [days, setDays] = useState(30);
  const [active, setActive] = useState(
    () => adminView,
  );
  const unlock = () => {
    setActive(true);toast.info('Checking your verified subscription...');
  };
  const lock = () => {
    setActive(false);toast.info('Analytics plan preview closed.');
  };
  const { data, isLoading, isError } = useQuery({
    queryKey: ["amazon-premium", sellerId ?? "self", days],
    queryFn: () => amazonPremiumService.get(days, sellerId),
    enabled: active,
    staleTime: 300_000,
  });
  const business = (
    <CoreAnalytics
      dashboard={false}
      summaryOnly
      days={days}
      setDays={setDays}
      sellerId={sellerId}
    />
  );
  const freeSeo = !adminView ? <SeoAnalyticsWorkspace /> : null;
  if (!active)
    return (
      <>
        {business}
        {freeSeo}
        <div className="mt-8">
          <PremiumGate onUnlock={unlock} />
        </div>
      </>
    );
  return (
    <>
      {business}
      {freeSeo}
      <section className="mt-8 rounded-[2rem] border border-amber-300 bg-gradient-to-br from-amber-50 via-white to-violet-50 p-4 shadow-sm sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 pb-5">
          <div>
            <Badge tone={adminView ? "purple" : "amber"}>
              {adminView ? <BarChart3 size={13} /> : <Crown size={13} />}{" "}
              {adminView
                ? "FULL SELLER ANALYTICS · ADMIN ACCESS"
                : "PREMIUM ANALYTICS · UNLOCKED"}
            </Badge>
            <h2 className="mt-3 text-2xl font-extrabold">
              Marketplace Intelligence Suite
            </h2>
            <p className="text-sm text-stone-500">
              Traffic, conversion, products, ranking, PPC, Boost and growth
              recommendations.
            </p>
          </div>
          {!adminView && (
            <Button variant="secondary" onClick={lock}>
              <Lock size={16} /> Lock preview
            </Button>
          )}
        </div>
        {isLoading ? (
          <Loading cards={4} />
        ) : isError || !data ? (
          <Empty
            title={
              adminView
                ? "Seller analytics unavailable"
                : "Premium analytics unavailable"
            }
            body="Could not load seller intelligence for this period."
          />
        ) : (
          <>
            <PremiumData data={data} />
            <AdvancedPremium data={data} />
            {!adminView && <PpcCampaignManager />}
          </>
        )}
      </section>
    </>
  );
}
export function RealSellerAnalytics() {
  return <PremiumSuite />;
}
export function AdminSellerAnalytics(){const {id}=useParams();if(!id)return <Empty title="Seller not found"/>;return <><Link to="/admin/users" className="mb-5 inline-block text-sm font-bold text-brand-700">← Back to users</Link><div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50 p-4"><b className="text-violet-900">Admin seller analytics</b><p className="text-sm text-violet-700">Read-only performance and premium intelligence for seller ID {id}.</p></div><PremiumSuite sellerId={id} adminView/></>}

function Alerts({
  alerts,
}: {
  alerts: { level: string; title: string; action: string }[];
}) {
  const pageSize = 6,
    [requestedPage, setPage] = useState(1),
    pages = Math.max(1, Math.ceil(alerts.length / pageSize)),
    page = Math.min(requestedPage, pages),
    shown = alerts.slice((page - 1) * pageSize, page * pageSize);
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold">Automated business alerts</h3>
        {alerts.length > 0 && (
          <span className="text-xs text-stone-500">{alerts.length} alerts</span>
        )}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {shown.length ? (
          shown.map((item, index) => (
            <div
              className="rounded-xl border border-amber-200 bg-amber-50 p-4"
              key={`${item.title}-${page}-${index}`}
            >
              <div className="flex items-start justify-between gap-2">
                <b>{item.title}</b>
                <Badge tone={item.level === "HIGH" ? "red" : "amber"}>
                  {item.level}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-brand-700">{item.action}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-stone-500">No urgent alerts.</p>
        )}
      </div>
      {pages > 1 && (
        <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={page === 1}
              onClick={() => setPage(Math.max(1, page - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={page === pages}
              onClick={() => setPage(Math.min(pages, page + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Pager({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={page === pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
function Losses({
  items,
}: {
  items: Awaited<ReturnType<typeof amazonPremiumService.get>>["lostPotential"];
}) {
  const pageSize = 6,
    [requestedPage, setPage] = useState(1),
    pages = Math.max(1, Math.ceil(items.length / pageSize)),
    page = Math.min(requestedPage, pages),
    shown = items.slice((page - 1) * pageSize, page * pageSize);
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-extrabold">
          Listings losing sales potential
        </h3>
        {items.length > 0 && (
          <span className="text-sm text-stone-500">
            {items.length} listings
          </span>
        )}
      </div>
      {shown.length ? (
        <>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {shown.map((item) => (
              <div
                className="rounded-2xl border border-red-100 bg-red-50 p-5"
                key={item.productId}
              >
                <div className="flex justify-between">
                  <b>{item.product}</b>
                  <Badge tone={item.severity === "HIGH" ? "red" : "amber"}>
                    {item.severity}
                  </Badge>
                </div>
                <p className="mt-2 text-sm">
                  {item.views} views → {item.carts} carts → {item.orders} orders
                </p>
                {item.issues.map((issue) => (
                  <p
                    className="mt-2 text-sm font-semibold text-red-700"
                    key={issue}
                  >
                    • {issue}
                  </p>
                ))}
                <div className="mt-3 rounded-xl bg-white p-3">
                  {item.actions.map((action) => (
                    <p className="text-sm text-brand-700" key={action}>
                      Recommendation: {action}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {pages > 1 && <Pager page={page} pages={pages} onChange={setPage} />}
        </>
      ) : (
        <p className="mt-3 rounded-xl bg-emerald-50 p-4 text-emerald-700">
          No major conversion leak detected yet.
        </p>
      )}
    </div>
  );
}
