import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
Badge,
Button,
Empty,
Loading,
Spinner
} from "../../components/ui";
import {
couponService
} from "../../services";
import { useAuth } from "../../store/auth";
import { formatDate } from "../../utils/dateTime";

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

export function SellerCoupons() {
  const { user } = useAuth(),
    qc = useQueryClient();
  const [code, setCode] = useState(""),
    [percent, setPercent] = useState(10),
    [error, setError] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["coupons", user?.id],
    queryFn: () => couponService.list(user!.id),
    enabled: !!user,
  });
  const create = useMutation({meta:{successMessage:"Coupon created."},
    mutationFn: () =>
      couponService.create({
        sellerId: user!.id,
        seller: user!.store ?? user!.name,
        code,
        discountPercent: percent,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons"] });
      setCode("");
      setError("");
    },
    onError: (e: Error) => setError(e.message),
  });
  const toggle = useMutation({meta:{successMessage:"Coupon updated."},
    mutationFn: couponService.toggle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });
  return (
    <>
      <PageTitle
        title="Coupons"
        sub="Create store coupons that buyers can redeem during checkout."
      />
      <div className="grid gap-6 lg:grid-cols-[.8fr,1.2fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="card h-fit p-6"
        >
          <h2 className="text-xl font-extrabold">Create coupon</h2>
          <label className="label mt-5">Coupon code</label>
          <input
            className="field uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
            placeholder="SAVE15"
          />
          <label className="label mt-4">Discount percentage</label>
          <div className="relative">
            <input
              type="number"
              min="1"
              max="90"
              className="field pr-10"
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
            />
            <span className="absolute right-4 top-3 font-bold text-stone-400">
              %
            </span>
          </div>
          {error && (
            <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>
          )}
          <Button
            className="mt-5 w-full"
            disabled={!code || percent < 1 || percent > 90 || create.isPending}
          >
            {create.isPending ? <Spinner /> : "Create coupon"}
          </Button>
        </form>
        <div className="card overflow-hidden">
          <div className="border-b p-6">
            <h2 className="text-xl font-extrabold">Your coupons</h2>
            <p className="text-sm text-stone-500">
              Pause a coupon whenever you no longer want buyers to use it.
            </p>
          </div>
          {isLoading ? (
            <Loading />
          ) : data.length ? (
            <div className="divide-y">
              {data.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-4 p-5"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 font-extrabold text-brand-700">
                    {c.discountPercent}%
                  </div>
                  <div className="min-w-40 flex-1">
                    <code className="font-extrabold text-ink">{c.code}</code>
                    <p className="text-xs text-stone-500">
                      {c.redemptions} redemptions · Created {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <Badge tone={c.active ? "green" : "gray"}>
                    {c.active ? "ACTIVE" : "PAUSED"}
                  </Badge>
                  <Button
                    variant="secondary"
                    onClick={() => toggle.mutate(c.id)}
                  >
                    {c.active ? "Pause" : "Activate"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="No coupons yet"
              body="Create your first percentage discount coupon."
            />
          )}
        </div>
      </div>
    </>
  );
}
