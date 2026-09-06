import { useQuery } from "@tanstack/react-query";
import {
ArrowRight,
Check,
ChefHat,
Search
} from "lucide-react";
import { useState } from "react";
import { Link,useNavigate } from "react-router-dom";
import { FoodCard } from "../../components/FoodCard";
import {
Badge,
Button,
Empty,
Loading
} from "../../components/ui";
import {
foodService
} from "../../services";
import { useAuth } from "../../store/auth";

export function Home() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["foods"],
    queryFn: () => foodService.getFoods(),
  });
  const { data: bestSellers = [], isLoading: bestSellersLoading } = useQuery({
    queryKey: ["products", "best-selling"],
    queryFn: foodService.getBestSelling,
  });
  const [q, setQ] = useState("");
  const nav = useNavigate();
  return (
    <>
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_85%_20%,#d4f4df,transparent_35%),linear-gradient(135deg,#fffaf2,#f7fff9)]">
        <div className="container-x grid min-h-[620px] items-center gap-10 py-16 lg:grid-cols-2">
          <div>
            <Badge tone="green">Made for BRACU · Shop around campus</Badge>
            <h1 className="mt-6 max-w-2xl text-5xl font-extrabold leading-[1.05] tracking-[-.04em] sm:text-6xl">
              Everything you need is{" "}
              <span className="text-brand-600">closer than you think.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-stone-600">
              Discover food, fashion, accessories, kids items, and stationery
              from trusted campus sellers.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                nav(`/foods?q=${encodeURIComponent(q)}`);
              }}
              className="card mt-8 flex max-w-xl flex-col gap-2 p-2 sm:flex-row"
            >
              <div className="flex flex-1 items-center gap-2 px-2">
                <Search className="text-stone-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full bg-transparent py-3 outline-none"
                  placeholder="What are you looking for?"
                />
              </div>
              <Button>
                <span>Search products</span>
                <ArrowRight size={17} />
              </Button>
            </form>
            <div className="mt-6 flex flex-wrap gap-5 text-sm text-stone-600">
              <span className="flex gap-2">
                <Check className="text-brand-600" size={18} />
                No waiting in line
              </span>
              <span className="flex gap-2">
                <Check className="text-brand-600" size={18} />
                Student-friendly prices
              </span>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="absolute -left-8 top-12 z-10 card flex items-center gap-3 p-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100">
                🔥
              </span>
              <div>
                <b className="block">Trending now</b>
                <small className="text-stone-500">Campus Kacchi Box</small>
              </div>
            </div>
            <img
              src="https://images.deliveryhero.io/image/fd-bd/LH/dw8z-listing.jpg?height=900&width=900"
              className="ml-auto aspect-square w-[90%] rounded-[3rem] object-cover shadow-2xl"
            />
            <div className="absolute -bottom-5 right-0 card p-4">
              <div className="flex -space-x-2">
                {[12, 32, 44].map((i) => (
                  <img
                    key={i}
                    className="h-9 w-9 rounded-full border-2 border-white"
                    src={`https://i.pravatar.cc/80?img=${i}`}
                  />
                ))}
              </div>
              <b className="mt-2 block">Loved by 1,200+ students</b>
              <span className="text-sm text-amber-500">★★★★★</span>
            </div>
          </div>
        </div>
      </section>
      <section className="container-x py-20">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-bold text-brand-600">THE GOOD STUFF</p>
            <h2 className="section-title mt-2">Featured near campus</h2>
          </div>
          <Link to="/foods" className="font-bold text-brand-600">
            View all →
          </Link>
        </div>
        <div className="mt-8">
          {isLoading ? (
            <Loading />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {data?.slice(0, 4).map((f) => (
                <FoodCard key={f.id} food={f} />
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="bg-brand-50 py-20">
        <div className="container-x">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-bold text-brand-600">PLATFORM FAVORITES</p>
              <h2 className="section-title mt-2">Best-selling products</h2>
              <p className="mt-2 text-stone-500">
                The six most ordered products across the entire marketplace.
              </p>
            </div>
            <Link to="/foods" className="shrink-0 font-bold text-brand-600">
              View all →
            </Link>
          </div>
          <div className="mt-9">
            {bestSellersLoading ? (
              <Loading cards={6} />
            ) : bestSellers.length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {bestSellers.map((product) => (
                  <FoodCard key={product.id} food={product} />
                ))}
              </div>
            ) : (
              <Empty
                title="No best sellers yet"
                body="Completed marketplace orders will determine this list."
              />
            )}
          </div>
        </div>
      </section>
      <section className="container-x py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="font-bold text-brand-600">SIMPLE BY DESIGN</p>
            <h2 className="section-title mt-2">From browsing to delivery</h2>
            <div className="mt-8 space-y-5">
              {[
                [
                  "01",
                  "Browse campus products",
                  "See food, fashion, accessories, kids items, and stationery from trusted sellers.",
                ],
                [
                  "02",
                  "Choose your time",
                  "Reserve a pickup or delivery slot that fits your day.",
                ],
                [
                  "03",
                  "Receive it on time",
                  "Your seller prepares or packs it for your selected delivery time.",
                ],
              ].map((x) => (
                <div key={x[0]} className="flex gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 font-bold text-white">
                    {x[0]}
                  </span>
                  <div>
                    <h3 className="font-bold">{x[1]}</h3>
                    <p className="mt-1 text-sm text-stone-500">{x[2]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {user?.role !== "SELLER" && (
            <div className="rounded-[2.5rem] bg-ink p-8 text-white sm:p-12">
              <ChefHat className="text-emerald-400" size={44} />
              <h2 className="mt-6 text-3xl font-extrabold">
                Have something great to sell?
                <br />
                Build your campus business.
              </h2>
              <p className="mt-4 text-stone-300">
                List products, manage stock and delivery, and grow with tools
                made for campus sellers.
              </p>
              <Link
                to="/become-seller"
                className="btn mt-8 bg-white text-ink hover:bg-stone-100"
              >
                Start selling <ArrowRight size={17} />
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
