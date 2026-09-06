import { useQuery } from "@tanstack/react-query";
import {
Check,
Clock3,
Home,
ShoppingBag,
TrendingUp,
X
} from "lucide-react";
import {
Badge,
Empty,
Loading
} from "../../components/ui";
import {
orderService
} from "../../services";
import { useAuth } from "../../store/auth";
import type { Order } from "../../types";

function Stat({
  name,
  value,
  Icon,
  color,
}: {
  name: string;
  value: string;
  Icon: typeof Home;
  color: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span
          className={`grid h-11 w-11 place-items-center rounded-2xl ${color}`}
        >
          <Icon size={21} />
        </span>
        <TrendingUp size={17} className="text-emerald-500" />
      </div>
      <p className="mt-5 text-sm text-stone-500">{name}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}

export function BuyerDashboard() {
  const { user } = useAuth();
  const { data = [], isLoading } = useQuery({
    queryKey: ["orders", "buyer", user?.id],
    queryFn: orderService.list,
    enabled: !!user,
  });
  const active = data.filter(
    (order) => !["COMPLETED", "DELIVERED", "CANCELLED", "RETURNED"].includes(order.status),
  ).length;
  const completed = data.filter((order) =>
    ["COMPLETED", "DELIVERED"].includes(order.status),
  ).length;
  const cancelled = data.filter((order) => order.status === "CANCELLED").length;
  const stats: [string, string, typeof Home, string][] = [
    ["Active orders", String(active), Clock3, "bg-amber-100 text-amber-700"],
    ["Completed", String(completed), Check, "bg-emerald-100 text-emerald-700"],
    ["Cancelled", String(cancelled), X, "bg-red-100 text-red-700"],
    [
      "Total orders",
      String(data.length),
      ShoppingBag,
      "bg-violet-100 text-violet-700",
    ],
  ];
  return (
    <div>
      <PageTitle
        title={`Good afternoon, ${user?.name ?? "Buyer"}`}
        sub="Here’s what’s happening with your orders."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Stat key={s[0]} name={s[0]} value={s[1]} Icon={s[2]} color={s[3]} />
        ))}
      </div>
      <section className="card mt-7 p-6">
        <h2 className="text-xl font-extrabold">Recent orders</h2>
        {isLoading ? (
          <Loading cards={2} />
        ) : data.length ? (
          <div className="mt-4 space-y-3">
            {data.slice(0, 3).map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        ) : (
          <Empty
            title="No orders yet"
            body="Your real orders will appear here after checkout."
          />
        )}
      </section>
    </div>
  );
}

function PageTitle({
  title,
  sub,
  action,
}: {
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-stone-500">{sub}</p>
      </div>
      {action}
    </div>
  );
}

function tone(status: string) {
  return status === "COMPLETED" ||
    status === "DELIVERED" ||
    status === "ACTIVE" ||
    status === "APPROVED"
    ? "green"
    : status === "CANCELLED" || status === "RETURNED" || status === "BANNED" || status === "REJECTED"
      ? "red"
      : status === "FROZEN"
        ? "purple"
        : "amber";
}

function OrderRow({
  order,
  action,
  onOpen,
}: {
  order: Order;
  action?: React.ReactNode;
  onOpen?: () => void;
}) {
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (onOpen && (event.key === "Enter" || event.key === " ")) onOpen();
      }}
      className={`flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center ${onOpen ? "cursor-pointer transition hover:border-brand-300 hover:bg-brand-50/40" : ""}`}
    >
      <img src={order.image} className="h-14 w-16 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <b>{order.food}</b>
        {order.variantLabel && (
          <p className="mt-0.5 text-xs font-bold text-brand-700">
            Variant: {order.variantLabel}
          </p>
        )}
        <p className="text-xs text-stone-500">
          {order.id} · {order.seller} · Qty {order.quantity}
        </p>
        {order.extension && (
          <p
            className={`mt-1 text-xs font-bold ${order.extension.status === "APPROVED" ? "text-emerald-700" : order.extension.status === "REJECTED" ? "text-red-600" : "text-amber-700"}`}
          >
            Time extension: {order.extension.minutes} min ·{" "}
            {order.extension.status.replaceAll("_", " ")}
          </p>
        )}
      </div>
      <div className="text-sm">
        <b>৳{order.total}</b>
        <p className="text-xs text-stone-500">
          {order.deliveryDate} · {order.deliveryTime}
        </p>
      </div>
      <Badge tone={tone(order.status)}>
        {order.status.replaceAll("_", " ")}
      </Badge>
      {action && (
        <div onClick={(event) => event.stopPropagation()}>{action}</div>
      )}
    </div>
  );
}
