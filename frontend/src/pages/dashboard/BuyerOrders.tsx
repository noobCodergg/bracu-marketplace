import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import {
Badge,
Button,
Confirm,
Empty,
Loading,
Modal
} from "../../components/ui";
import {
orderService
} from "../../services";
import type { Order } from "../../types";

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

export function BuyerOrders() {
  const qc = useQueryClient(),
    loc = useLocation(),
    filter = new URLSearchParams(loc.search).get("status");
  const { data = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: orderService.list,
    refetchInterval: 60_000,
  });
  const [cancel, setCancel] = useState<string | null>(null),
    [selected, setSelected] = useState<Order | null>(null);
  const mut = useMutation({meta:{successMessage:"Order cancelled."},
    mutationFn: orderService.cancel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      setCancel(null);
    },
  });
  const extensionDecision = useMutation({meta:{successMessage:"Order updated successfully."},
    mutationFn: (decision: "APPROVED" | "REJECTED") =>
      orderService.decideExtension(selected!.id, decision),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      setSelected({ ...order });
    },
  });
  const shown = data.filter(
    (o) =>
      !filter ||
      (filter === "active"
        ? !["COMPLETED", "DELIVERED", "CANCELLED", "RETURNED"].includes(o.status)
        : filter === "history"
          ? ["COMPLETED", "DELIVERED", "CANCELLED", "RETURNED"].includes(o.status)
          : o.status === filter),
  );
  const pageTitle = filter === "history" ? "Order history" : "Active orders";
  return (
    <>
      <PageTitle
        title={pageTitle}
        sub={
          filter === "history"
            ? "Your completed, delivered, cancelled, and returned previous orders."
            : "Orders currently waiting, accepted, preparing, ready, or out for delivery."
        }
      />
      {isLoading ? (
        <Loading />
      ) : shown.length ? (
        <div className="space-y-3">
          {shown.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              onOpen={() => setSelected(o)}
              action={
                ["PENDING", "ACCEPTED"].includes(o.status) ? (
                  <Button variant="secondary" onClick={() => setCancel(o.id)}>
                    Cancel
                  </Button>
                ) : undefined
              }
            />
          ))}
        </div>
      ) : (
        <Empty />
      )}
      <Confirm
        open={!!cancel}
        title="Cancel this order?"
        body="Cancellation is available only before the seller starts preparing the food."
        onClose={() => setCancel(null)}
        onConfirm={() => cancel && mut.mutate(cancel)}
      />
      <Modal
        open={!!selected}
        title="Order delivery details"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div>
            <div className="flex items-center gap-4 rounded-2xl bg-stone-50 p-4">
              <img
                src={selected.image}
                className="h-16 w-20 rounded-xl object-cover"
              />
              <div className="flex-1">
                <h3 className="font-extrabold">{selected.food}</h3>
                <p className="text-sm text-stone-500">
                  {selected.id} · Qty {selected.quantity}
                </p>
              </div>
              <Badge tone={tone(selected.status)}>
                {selected.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase text-stone-400">
                  Delivery date
                </dt>
                <dd className="mt-1 font-semibold">{selected.deliveryDate}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-stone-400">
                  Delivery time
                </dt>
                <dd className="mt-1 font-semibold">{selected.deliveryTime}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase text-stone-400">
                  Address
                </dt>
                <dd className="mt-1 font-semibold">
                  {selected.deliveryAddress ??
                    "Not provided for this older order"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-stone-400">
                  Phone
                </dt>
                <dd className="mt-1 font-semibold">
                  {selected.phone ?? "Not provided"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-stone-400">
                  Seller
                </dt>
                <dd className="mt-1 font-semibold">{selected.seller}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase text-stone-400">
                  Instructions
                </dt>
                <dd className="mt-1 text-sm text-stone-600">
                  {selected.instructions ?? "No special instructions"}
                </dd>
              </div>
            </dl>
            {selected.extension && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-amber-950">
                      Delivery time extension
                    </p>
                    <p className="mt-1 text-sm text-amber-800">
                      Seller requested {selected.extension.minutes} extra
                      minutes.
                    </p>
                  </div>
                  <Badge
                    tone={
                      selected.extension.status === "APPROVED"
                        ? "green"
                        : selected.extension.status === "REJECTED"
                          ? "red"
                          : "amber"
                    }
                  >
                    {selected.extension.status}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-stone-600">
                  {selected.extension.reason}
                </p>
                {selected.extension.status === "PENDING" && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      disabled={extensionDecision.isPending}
                      onClick={() => extensionDecision.mutate("APPROVED")}
                    >
                      Approve new time
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={extensionDecision.isPending}
                      onClick={() => extensionDecision.mutate("REJECTED")}
                    >
                      Reject
                    </Button>
                  </div>
                )}
                {selected.extension.status === "APPROVED" && (
                  <p className="mt-3 text-sm font-semibold text-green-700">
                    New deadline: {selected.deliveryDate} at{" "}
                    {selected.deliveryTime}
                  </p>
                )}
                {selected.extension.status === "REJECTED" && (
                  <p className="mt-3 text-sm font-semibold text-red-700">
                    The original delivery deadline remains unchanged.
                  </p>
                )}
              </div>
            )}
            <div className="mt-6 flex justify-between border-t pt-5">
              <b>Order total</b>
              <span className="text-xl font-extrabold">৳{selected.total}</span>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
