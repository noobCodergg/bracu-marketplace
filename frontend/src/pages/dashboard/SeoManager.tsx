import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
Button,
Empty,
Loading,
Spinner
} from "../../components/ui";
import { productService,seoService } from '../../services';
import { useAuth } from "../../store/auth";
import type { FoodItem } from "../../types";

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

export function SeoManager() {
  const qc = useQueryClient();
  const { data: foods = [], isLoading } = useQuery({
    queryKey: ["seo-products", useAuth.getState().user?.id],
    queryFn: () => productService.mine(),
  });
  const [selectedId, setSelectedId] = useState(""),
    [title, setTitle] = useState(""),
    [keywords, setKeywords] = useState(""),
    [description, setDescription] = useState("");
  const selected = foods.find((food) => food.id === selectedId);
  const input = {
    title,
    keywords: keywords
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    metaDescription: description,
  };
  const analysis = seoService.analyze(input);
  const choose = (food: FoodItem) => {
    setSelectedId(food.id);
    setTitle(food.seo?.title ?? food.name);
    setKeywords(food.seo?.keywords.join(", ") ?? "");
    setDescription(food.seo?.metaDescription ?? food.description);
  };
  const save = useMutation({
    mutationFn: () => seoService.save(selectedId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seo-products"] }),
  });
  return (
    <>
      <PageTitle
        title="Product SEO Manager"
        sub="Optimize listings to rank higher in marketplace search."
      />
      {isLoading ? (
        <Loading />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[.8fr,1.2fr]">
          <div className="card h-fit overflow-hidden">
            <div className="border-b p-5">
              <h2 className="font-extrabold">Your listings</h2>
            </div>
            {foods.map((food) => (
              <button
                onClick={() => choose(food)}
                className={`flex w-full items-center gap-3 border-b p-4 text-left ${selectedId === food.id ? "bg-brand-50" : "hover:bg-stone-50"}`}
                key={food.id}
              >
                <img
                  src={food.image}
                  className="h-12 w-14 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{food.name}</b>
                  <small className="text-stone-500">SEO score</small>
                </div>
                <span
                  className={`grid h-11 w-11 place-items-center rounded-full font-extrabold ${(food.seo?.score ?? 0) >= 80 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                >
                  {food.seo?.score ?? 0}
                </span>
              </button>
            ))}
          </div>
          {selected ? (
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold">
                    Optimize {selected.name}
                  </h2>
                  <p className="text-sm text-stone-500">
                    SEO quality influences non-boosted marketplace ranking.
                  </p>
                </div>
                <span
                  className={`grid h-16 w-16 place-items-center rounded-full text-xl font-extrabold ${analysis.score >= 80 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                >
                  {analysis.score}
                </span>
              </div>
              <label className="label mt-6">SEO title</label>
              <input
                className="field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Product name, benefit, and location"
              />
              <p className="mt-1 text-right text-xs text-stone-400">
                {title.length}/60
              </p>
              <label className="label mt-4">Search keywords</label>
              <input
                className="field"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="product type, benefit, b market"
              />
              <p className="mt-1 text-xs text-stone-400">
                Separate keywords with commas.
              </p>
              <label className="label mt-4">Meta description</label>
              <textarea
                className="field min-h-28"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="mt-1 text-right text-xs text-stone-400">
                {description.length}/160
              </p>
              <div className="mt-5 rounded-2xl bg-stone-50 p-4">
                <h3 className="font-extrabold">Optimization checklist</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {analysis.checks.map((check) => (
                    <p
                      className={`text-sm ${check.pass ? "text-emerald-700" : "text-stone-500"}`}
                      key={check.label}
                    >
                      {check.pass ? "✓" : "○"} {check.label}
                    </p>
                  ))}
                </div>
              </div>
              <div className="mt-5 rounded-2xl border p-4">
                <p className="text-xs font-bold uppercase text-stone-400">
                  Search preview
                </p>
                <h3 className="mt-2 text-lg font-extrabold text-brand-700">
                  {title}
                </h3>
                <p className="mt-1 text-sm text-stone-500">{description}</p>
              </div>
              <Button
                className="mt-5 w-full"
                disabled={save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? <Spinner /> : "Save SEO & update ranking"}
              </Button>
              {save.isSuccess && (
                <p className="mt-2 text-center text-sm font-bold text-emerald-700">
                  SEO saved. Marketplace rank updated.
                </p>
              )}
            </div>
          ) : (
            <Empty
              title="Choose a product"
              body="Select a listing to optimize its search ranking."
            />
          )}
        </div>
      )}
    </>
  );
}
