import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import {
BarChart3,
Check,
ChefHat,
CircleDollarSign,
ClipboardList,
Clock3,
FileWarning,
Heart,
Home,
LayoutDashboard,
LogOut,
Menu,
Plus,
Settings,
ShoppingBag,
Snowflake,
Store,
Users,
X
} from "lucide-react";
import { useEffect,useState } from "react";
import { NavLink,useLocation,useNavigate } from "react-router-dom";
import { NotificationBell } from "../../components/NotificationBell";
import {
Badge,
Button,
Modal,
Spinner
} from "../../components/ui";
import {
reactivationService
} from "../../services";
import { useAuth } from "../../store/auth";
import type { Role } from "../../types";

const menus: Record<Role, { name: string; path: string; icon: typeof Home }[]> =
  {
    BUYER: (
      [
        ["Overview", "dashboard", LayoutDashboard],
        ["Active Orders", "orders?status=active", Clock3],
        ["Order History", "orders?status=history", Check],
        ["Saved Foods", "saved", Heart],
        ["Account Settings", "settings", Settings],
        ["Upgrade to Seller", "/become-seller", Store],
      ] as [string, string, typeof Home][]
    ).map(([name, path, icon]) => ({ name, path, icon })),
    SELLER: (
      [
        ["Overview", "dashboard", LayoutDashboard],
        ["Products", "foods", ChefHat],
        ["Add Product", "foods/new", Plus],
        ["Orders", "orders", ClipboardList],
        ["Coupons", "coupons", CircleDollarSign],
        ["Analytics & SEO", "analytics", BarChart3],
        ["Account Settings", "settings", Settings],
      ] as [string, string, typeof Home][]
    ).map(([name, path, icon]) => ({ name, path, icon })),
    ADMIN: (
      [
        ["Overview", "dashboard", LayoutDashboard],
        ["Users", "users", Users],
        ["Seller Approvals", "approvals", Check],
        ["Reports", "reports", FileWarning],
        ["Food Listings", "foods", ChefHat],
        ["Analytics", "analytics", BarChart3],
        ["System Analytics", "system", BarChart3],
        ["Settings", "settings", Settings],
      ] as [string, string, typeof Home][]
    ).map(([name, path, icon]) => ({ name, path, icon })),
  };

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuth(),
    loc = useLocation(),
    [open, setOpen] = useState(false);
  const nav = useNavigate();
  if (!user) return null;
  const base = `/${user.role.toLowerCase()}`;
  return (
    <div className="min-h-screen bg-stone-50">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r bg-white p-4 transition lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-8 flex items-center justify-between px-2">
          <button
            onClick={() => nav("/")}
            className="flex items-center gap-2 text-left"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
              <ShoppingBag />
            </span>
            <span className="font-extrabold leading-tight">
              <span className="text-brand-600">B</span> Market
            </span>
          </button>
          <button onClick={() => setOpen(false)} className="lg:hidden">
            <X />
          </button>
        </div>
        <div className="mb-5 rounded-2xl bg-stone-50 p-3">
          <div className="flex items-center gap-3">
            <img src={user.avatar} className="h-10 w-10 rounded-xl" />
            <div className="min-w-0">
              <b className="block truncate text-sm">{user.name}</b>
              <span className="text-xs font-bold text-brand-600">
                {user.role} · {user.status}
              </span>
            </div>
          </div>
        </div>
        <nav className="space-y-1">
          {menus[user.role].map((m) => {
            const Icon = m.icon;
            const to = m.path.startsWith("/") ? m.path : `${base}/${m.path}`;
            return (
              <NavLink
                onClick={() => setOpen(false)}
                key={m.name}
                to={to}
                className={() => {
                  const [path, query] = to.split("?");
                  const selected =
                    loc.pathname === path &&
                    (!query || loc.search === `?${query}`);
                  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${selected ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-50"}`;
                }}
              >
                <Icon size={18} />
                {m.name}
              </NavLink>
            );
          })}
        </nav>
        <button
          className="absolute bottom-5 left-5 flex items-center gap-2 text-sm font-bold text-red-600"
          onClick={() => {
            setUser(null);
            nav("/");
          }}
        >
          <LogOut size={17} />
          Log out
        </button>
      </aside>
      <main className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-18 items-center justify-between border-b bg-white/90 px-4 py-3 backdrop-blur sm:px-8">
          <button onClick={() => setOpen(true)} className="lg:hidden">
            <Menu />
          </button>
          <div>
            <p className="text-xs text-stone-500">Welcome back</p>
            <b>{user.name}</b>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Badge
              tone={
                user.status === "ACTIVE"
                  ? "green"
                  : user.status === "FROZEN"
                    ? "purple"
                    : "amber"
              }
            >
              {user.status}
            </Badge>
            <img src={user.avatar} className="h-9 w-9 rounded-xl" />
          </div>
        </header>
        <div className="p-4 sm:p-8">
          {["FROZEN", "SUSPENDED"].includes(user.status) && <RestrictionBanner />}
          {children}
        </div>
      </main>
    </div>
  );
}

function RestrictionBanner() {
  const {user,restore}=useAuth(),qc=useQueryClient();const [reason,setReason]=useState("");const [open,setOpen]=useState(false);
  const {data:request}=useQuery({queryKey:["my-reactivation-request",user?.id],queryFn:reactivationService.mine,enabled:!!user,refetchInterval:60_000});
  const submit=useMutation({meta:{successMessage:"Reactivation request submitted."},mutationFn:()=>reactivationService.request(user!,reason),onSuccess:()=>{qc.invalidateQueries({queryKey:["my-reactivation-request",user?.id]});setOpen(false);setReason("")}});
  useEffect(()=>{if(request?.status==="APPROVED")void restore()},[request?.status,restore]);
  const pending=request?.status==="PENDING";
  return (
    <div className="mb-7 flex flex-col items-start gap-4 rounded-2xl border border-violet-200 bg-violet-50 p-5 sm:flex-row sm:items-center">
      <Snowflake className="text-violet-600" />
      <div className="flex-1">
        <b>
          Your account is {user?.status.toLowerCase()}.
        </b>
        <p className="text-sm text-violet-700">
          Restricted actions are disabled. You may submit an appeal for admin review.
        </p>
      </div>
      <Button disabled={pending} onClick={() => setOpen(true)}>
        {pending ? "Appeal pending" : "Apply for reactivation"}
      </Button>
      <Modal open={open} title="Reactivation application" onClose={()=>setOpen(false)}><p className="mb-4 text-sm text-stone-500">Explain why your account should be reactivated. An admin will approve or reject the request.</p><textarea className="field min-h-28" value={reason} onChange={event=>setReason(event.target.value)} placeholder="Write your appeal..."/><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={reason.trim().length<3||submit.isPending} onClick={()=>submit.mutate()}>{submit.isPending?<Spinner/>:"Submit appeal"}</Button></div>{submit.isError&&<p className="mt-3 text-sm font-bold text-red-600">{submit.error.message}</p>}</Modal>
    </div>
  );
}
