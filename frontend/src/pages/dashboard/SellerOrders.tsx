import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation,useNavigate } from "react-router-dom";
import {
Badge,
Button,
Empty,
Loading,
Modal,
Spinner
} from "../../components/ui";
import {
orderService,
reportService
} from "../../services";
import { useAuth } from "../../store/auth";
import type { Order,OrderStatus } from "../../types";
import { formatDate, formatTime } from "../../utils/dateTime";

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
          {formatDate(order.deliveryDate)} · {formatTime(order.deliveryTime)}
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

export function SellerOrders() {
  const qc = useQueryClient(),
    { user } = useAuth(),
    loc = useLocation(),
    nav = useNavigate();
  const [reportBuyer, setReportBuyer] = useState<{id:string;name:string} | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [extensionOrder, setExtensionOrder] = useState<Order | null>(null);
  const [extensionMinutes, setExtensionMinutes] = useState(30);
  const [extensionReason, setExtensionReason] = useState("");
  const requestedStatus =
    new URLSearchParams(loc.search).get("status") ?? "active";
  const { data = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: orderService.list,
    refetchInterval: 15_000,
  });
  const isFood = (order: Order) =>
    order.itemType ? order.itemType === "FOOD" : order.foodId.startsWith("f");
  const statusOptions = (order: Order): OrderStatus[] =>
    ["COMPLETED", "DELIVERED"].includes(order.status)
      ? [order.status, "RETURNED"]
      : ["CANCELLED", "RETURNED"].includes(order.status)
        ? [order.status]
        : isFood(order)
      ? [
          "PENDING",
          "ACCEPTED",
          "PREPARING",
          "READY",
          "OUT_FOR_DELIVERY",
          "COMPLETED",
          "CANCELLED",
        ]
      : ["PENDING", "ACCEPTED", "PACKED", "DELIVERED", "CANCELLED"];
  const activeStatuses: OrderStatus[] = [
    "PENDING",
    "ACCEPTED",
    "PREPARING",
    "READY",
    "OUT_FOR_DELIVERY",
    "PACKED",
  ];
  const shown = data.filter((order) =>
    requestedStatus === "active"
      ? activeStatuses.includes(order.status)
      : order.status === requestedStatus,
  );
  const mut = useMutation({meta:{successMessage:"Order updated successfully."},
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      orderService.update(id, status),
    onSuccess: (updated) => {
      qc.setQueryData<Order[]>(["orders"], (current) =>
        current?.map((order) => (order.id === updated.id ? updated : order)),
      );
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["real-seller-analytics"] });
      qc.invalidateQueries({ queryKey: ["amazon-premium"] });
    },
  });
  const reportMutation = useMutation({meta:{successMessage:"Report submitted."},
    mutationFn: () =>
      reportService.create({
        targetId: reportBuyer!.id,
        type: "Buyer",
        reason: reportReason,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      setReportBuyer(null);
      setReportReason("");
    },
  });
  const extensionMutation = useMutation({meta:{successMessage:"Order updated successfully."},
    mutationFn: () =>
      orderService.requestExtension(
        extensionOrder!.id,
        extensionMinutes,
        extensionReason,
      ),
    onSuccess: (updated) => {
      qc.setQueryData<Order[]>(["orders"], (current) =>
        current?.map((order) => (order.id === updated.id ? updated : order)),
      );
      qc.invalidateQueries({ queryKey: ["orders"] });
      setExtensionOrder(null);
      setExtensionReason("");
    },
  });
  const title =
    requestedStatus === "active"
      ? "Active orders"
      : `${requestedStatus.replaceAll("_", " ")} orders`;
  return (
    <>
      <PageTitle
        title={title}
        sub={
          requestedStatus === "active"
            ? "Manage orders that still require action."
            : `Showing only ${requestedStatus.toLowerCase()} orders.`
        }
      />
      <div className="mb-5 flex gap-2 overflow-auto">
        {[
          { label: "Active", value: "active" },
          { label: "Pending", value: "PENDING" },
          { label: "Accepted", value: "ACCEPTED" },
          { label: "Preparing", value: "PREPARING" },
          { label: "Ready", value: "READY" },
          { label: "Out for delivery", value: "OUT_FOR_DELIVERY" },
          { label: "Packed", value: "PACKED" },
          { label: "Delivered", value: "DELIVERED" },
          { label: "Completed", value: "COMPLETED" },
          { label: "Cancelled", value: "CANCELLED" },
          { label: "Returned", value: "RETURNED" },
        ].map((tab) => (
          <button
            onClick={() => nav(`/seller/orders?status=${tab.value}`)}
            className={`${requestedStatus === tab.value ? "btn-primary" : "btn-secondary"} whitespace-nowrap`}
            key={tab.value}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Loading />
      ) : shown.length ? (
        <div className="space-y-3">
          {shown.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              onOpen={() => setSelectedOrder(o)}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`Status for ${o.food}`}
                    className="field w-auto min-w-44 py-2"
                    value={o.status}
                    disabled={
                      user?.status === "FROZEN" ||
                      ["CANCELLED", "RETURNED"].includes(
                        o.status,
                      ) ||
                      (mut.isPending && mut.variables?.id === o.id)
                    }
                    onChange={(event) =>
                      mut.mutate({
                        id: o.id,
                        status: event.target.value as OrderStatus,
                      })
                    }
                  >
                    {statusOptions(o).map((status) => (
                      <option key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  {isFood(o) &&
                    ["ACCEPTED", "PREPARING"].includes(o.status) &&
                    !o.extension && (
                      <Button
                        variant="secondary"
                        onClick={() => setExtensionOrder(o)}
                      >
                        Request time
                      </Button>
                    )}
                  <Button
                    variant="secondary"
                    disabled={!o.buyerId}
                    onClick={() => o.buyerId&&setReportBuyer({id:o.buyerId,name:o.buyer})}
                  >
                    Report buyer
                  </Button>
                </div>
              }
            />
          ))}
        </div>
      ) : (
        <Empty
          title={`No ${title.toLowerCase()}`}
          body="Orders will appear here when their status matches this section."
        />
      )}
      <Modal
        open={!!extensionOrder}
        title="Request delivery time extension"
        onClose={() => setExtensionOrder(null)}
      >
        <p className="mb-4 text-sm text-stone-500">
          The buyer must approve this request. If rejected, the original
          deadline remains active.
        </p>
        <label className="label">Extra time needed</label>
        <select
          className="field"
          value={extensionMinutes}
          onChange={(e) => setExtensionMinutes(Number(e.target.value))}
        >
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={45}>45 minutes</option>
          <option value={60}>1 hour</option>
          <option value={120}>2 hours</option>
        </select>
        <label className="label mt-4">Reason</label>
        <textarea
          className="field min-h-24"
          value={extensionReason}
          onChange={(e) => setExtensionReason(e.target.value)}
          placeholder="Explain why more preparation or delivery time is needed..."
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setExtensionOrder(null)}>
            Cancel
          </Button>
          <Button
            disabled={!extensionReason.trim() || extensionMutation.isPending}
            onClick={() => extensionMutation.mutate()}
          >
            {extensionMutation.isPending ? <Spinner /> : "Send to buyer"}
          </Button>
        </div>
      </Modal>
      <Modal
        open={!!selectedOrder}
        title="Customer delivery details"
        onClose={() => setSelectedOrder(null)}
      >
        {selectedOrder && (
          <div>
            <div className="flex items-center gap-4 rounded-2xl bg-stone-50 p-4">
              <img
                src={selectedOrder.image}
                className="h-16 w-20 rounded-xl object-cover"
              />
              <div className="flex-1">
                <h3 className="font-extrabold">{selectedOrder.food}</h3>
                <p className="text-sm text-stone-500">
                  {selectedOrder.id} · Qty {selectedOrder.quantity}
                </p>
              </div>
              <Badge tone={tone(selectedOrder.status)}>
                {selectedOrder.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase text-stone-400">
                  Buyer
                </dt>
                <dd className="mt-1 font-semibold">{selectedOrder.buyer}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-stone-400">
                  Phone
                </dt>
                <dd className="mt-1 font-semibold">
                  {selectedOrder.phone ?? "Not provided"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-stone-400">
                  Delivery date
                </dt>
                <dd className="mt-1 font-semibold">
                  {formatDate(selectedOrder.deliveryDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-stone-400">
                  Custom time
                </dt>
                <dd className="mt-1 font-semibold">
                  {formatTime(selectedOrder.deliveryTime)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase text-stone-400">
                  Delivery address
                </dt>
                <dd className="mt-1 rounded-xl bg-brand-50 p-3 font-semibold">
                  {selectedOrder.deliveryAddress ??
                    "Not provided for this older order"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase text-stone-400">
                  Delivery instructions
                </dt>
                <dd className="mt-1 text-sm text-stone-600">
                  {selectedOrder.instructions ?? "No special instructions"}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex items-center justify-between border-t pt-5">
              <span className="font-bold">Order total</span>
              <span className="text-xl font-extrabold">
                ৳{selectedOrder.total}
              </span>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={!!reportBuyer}
        title={`Report ${reportBuyer?.name ?? "buyer"}`}
        onClose={() => setReportBuyer(null)}
      >
        <p className="mb-4 text-sm text-stone-500">
          This report will be sent to marketplace admins.
        </p>
        <label className="label">Reason</label>
        <select
          className="field"
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
        >
          <option value="">Select a reason</option>
          {[
            "Scam",
            "Bad behavior",
            "Incorrect information",
            "Spam",
            "Other",
          ].map((reason) => (
            <option key={reason}>{reason}</option>
          ))}
        </select>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setReportBuyer(null)}>
            Cancel
          </Button>
          <Button
            disabled={!reportReason || reportMutation.isPending}
            onClick={() => reportMutation.mutate()}
          >
            {reportMutation.isPending ? <Spinner /> : "Submit report"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
