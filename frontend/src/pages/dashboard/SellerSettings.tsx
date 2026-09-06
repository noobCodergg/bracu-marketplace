import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import {
Store
} from "lucide-react";
import {
sellerAvailabilityService
} from "../../services";
import { useAuth } from "../../store/auth";

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

export function SellerSettings() {
  const { user } = useAuth(),
    qc = useQueryClient();
  const { data: accepting = true, isLoading } = useQuery({
    queryKey: ["seller-availability", user?.id],
    queryFn: () => sellerAvailabilityService.get(user!.id),
    enabled: !!user,
  });
  const mutation = useMutation({
    mutationFn: (value: boolean) =>
      sellerAvailabilityService.set(user!.id, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seller-availability"] });
      qc.invalidateQueries({ queryKey: ["cart-seller-availability"] });
    },
  });
  return (
    <>
      <PageTitle
        title="Seller settings"
        sub="Control whether buyers can place new orders with your store."
      />
      <div className="card max-w-2xl p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span
            className={`grid h-14 w-14 place-items-center rounded-2xl ${accepting ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
          >
            <Store />
          </span>
          <div className="flex-1">
            <h2 className="text-xl font-extrabold">Taking new orders</h2>
            <p className="mt-1 text-sm text-stone-500">
              When off, buyers cannot add your items to cart or complete
              checkout.
            </p>
          </div>
          <button
            disabled={isLoading || mutation.isPending}
            onClick={() => mutation.mutate(!accepting)}
            className={`relative h-8 w-14 rounded-full transition ${accepting ? "bg-brand-600" : "bg-stone-300"}`}
            aria-label="Toggle order availability"
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${accepting ? "left-7" : "left-1"}`}
            />
          </button>
        </div>
        <div
          className={`mt-6 rounded-2xl p-4 text-sm font-semibold ${accepting ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
        >
          {accepting
            ? "Your store is open. Buyers can order your available listings."
            : "Your store is closed. Existing orders remain visible, but no new orders can be placed."}
        </div>
      </div>
    </>
  );
}
