import {
ChevronDown,
Menu,
ShoppingBag,
ShoppingCart,
UserCircle,
X,
} from "lucide-react";
import { useState } from "react";
import { Link,NavLink } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useCart } from "../store/cart";
import type { Role } from "../types";
import { NotificationBell } from "./NotificationBell";
const dash: Record<Role, string> = {
  ADMIN: "/admin/dashboard",
  SELLER: "/seller/dashboard",
  BUYER: "/buyer/dashboard",
};
export function Header() {
  const cartCount = useCart((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0),
  );
  const [open, setOpen] = useState(false),
    [marketOpen, setMarketOpen] = useState(false);
  const { user } = useAuth();
  const links = [
    ["Home", "/"],
    ...(user?.role === "SELLER" ? [] : [["Become a Seller", "/become-seller"]]),
  ];
  const marketplaceCategories = [
    "Food",
    "Men's Clothing",
    "Men's Accessories",
    "Women's Clothing",
    "Women's Accessories",
    "Kids Items",
    "Stationery",
  ];
  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-[#fffdf8]/90 backdrop-blur-xl">
        <div className="container-x flex h-18 items-center justify-between py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
              <ShoppingBag />
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              <span className="text-brand-600">B</span> Market
            </span>
          </Link>
          <nav className="hidden items-center gap-7 lg:flex">
            <NavLink
              to="/"
              className="text-sm font-semibold text-stone-600 hover:text-brand-600"
            >
              Home
            </NavLink>
            <div className="relative">
              <button
                onClick={() => setMarketOpen(!marketOpen)}
                className="flex items-center gap-1 text-sm font-semibold text-stone-600 hover:text-brand-600"
              >
                Explore Marketplace <ChevronDown size={15} />
              </button>
              {marketOpen && (
                <div className="absolute left-0 top-8 z-50 w-64 rounded-2xl border bg-white p-2 shadow-xl">
                  <Link
                    onClick={() => setMarketOpen(false)}
                    to="/foods"
                    className="block rounded-xl px-3 py-2 text-sm font-bold hover:bg-brand-50"
                  >
                    All products
                  </Link>
                  {marketplaceCategories.map((category) => (
                    <Link
                      onClick={() => setMarketOpen(false)}
                      key={category}
                      to={`/foods?category=${encodeURIComponent(category)}`}
                      className="block rounded-xl px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-brand-50 hover:text-brand-700"
                    >
                      {category}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {links.slice(1).map(([n, p]) => (
              <NavLink
                key={p}
                to={p}
                className="text-sm font-semibold text-stone-600 hover:text-brand-600"
              >
                {n}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 sm:flex">
            {user && <NotificationBell />}
            <Link to="/cart" className="btn-secondary relative">
              <ShoppingCart size={17} />
              <span>Cart</span>
              {cartCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-xs text-white">
                  {cartCount}
                </span>
              )}
            </Link>
            {user ? (
              <Link to={dash[user.role]} className="btn-primary">
                <UserCircle size={17} />
                <span>{user.role} dashboard</span>
              </Link>
            ) : (
              <Link className="btn-primary" to="/login">
                Login
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 sm:hidden">
            {user && <NotificationBell />}
            <button className="p-2" onClick={() => setOpen(!open)}>
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {open && (
          <div className="container-x border-t py-3 lg:hidden">
            <Link
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 font-semibold hover:bg-stone-100"
              to="/"
            >
              Home
            </Link>
            <button
              onClick={() => setMarketOpen(!marketOpen)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 font-semibold hover:bg-stone-100"
            >
              Explore Marketplace <ChevronDown size={15} />
            </button>
            {marketOpen && (
              <div className="ml-3 border-l pl-2">
                <Link
                  onClick={() => {
                    setOpen(false);
                    setMarketOpen(false);
                  }}
                  to="/foods"
                  className="block rounded-xl px-3 py-2 text-sm font-bold hover:bg-brand-50"
                >
                  All products
                </Link>
                {marketplaceCategories.map((category) => (
                  <Link
                    onClick={() => {
                      setOpen(false);
                      setMarketOpen(false);
                    }}
                    key={category}
                    to={`/foods?category=${encodeURIComponent(category)}`}
                    className="block rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-brand-50"
                  >
                    {category}
                  </Link>
                ))}
              </div>
            )}
            {links.slice(1).map(([n, p]) => (
              <Link
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 font-semibold hover:bg-stone-100"
                key={p}
                to={p}
              >
                {n}
              </Link>
            ))}
          </div>
        )}
      </header>
    </>
  );
}
export function Footer() {
  return (
    <footer className="mt-20 bg-ink text-white">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <h3 className="text-xl font-extrabold">
            <span className="text-emerald-400">B</span> Market
          </h3>
          <p className="mt-3 max-w-md text-sm leading-6 text-stone-300">
            Food, fashion, accessories, kids items, and study essentials—all
            from trusted campus sellers.
          </p>
        </div>
        {[
          ["Discover", "Explore products", "Categories", "Today's picks"],
          ["Community", "Become a seller", "Safety", "Support"],
        ].map((x) => (
          <div key={x[0]}>
            <h4 className="font-bold">{x[0]}</h4>
            {x.slice(1).map((y) => (
              <p className="mt-3 text-sm text-stone-400" key={y}>
                {y}
              </p>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-stone-400">
        © 2026 B Market · Built for the BRACU community
      </div>
    </footer>
  );
}
export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
