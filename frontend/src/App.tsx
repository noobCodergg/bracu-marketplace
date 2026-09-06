import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { lazy,Suspense,useEffect,useState } from 'react';
import { Navigate,Outlet,Route,Routes,useLocation } from "react-router-dom";
import { PublicLayout } from "./components/Layout";
import { PlatformNotice } from './components/PlatformNotice';
import { DashboardLayout } from './pages/dashboard/DashboardLayout';
import { reactivationService } from "./services";
import { useAuth } from "./store/auth";
import type { Role } from "./types";
const AccountSettings=lazy(()=>import('./pages/AccountPages').then(module=>({default:module.AccountSettings})));
const PlatformSettings=lazy(()=>import('./pages/AccountPages').then(module=>({default:module.PlatformSettings})));
const SavedProducts=lazy(()=>import('./pages/AccountPages').then(module=>({default:module.SavedProducts})));
const AdminAnalytics=lazy(()=>import('./pages/AdminAnalytics').then(module=>({default:module.AdminAnalytics})));
const MarketplaceInventory=lazy(()=>import('./pages/AdminMarketplace').then(module=>({default:module.MarketplaceInventory})));
const MarketplaceOverview=lazy(()=>import('./pages/AdminMarketplace').then(module=>({default:module.MarketplaceOverview})));
const AdminSystemAnalytics=lazy(()=>import('./pages/AdminSystemAnalytics').then(module=>({default:module.AdminSystemAnalytics})));
const RealAdminUsers=lazy(()=>import('./pages/AdminUsersPage').then(module=>({default:module.RealAdminUsers})));
const RealBecomeSeller=lazy(()=>import('./pages/AuthPages').then(module=>({default:module.RealBecomeSeller})));
const RealLogin=lazy(()=>import('./pages/AuthPages').then(module=>({default:module.RealLogin})));
const Approvals=lazy(()=>import('./pages/dashboard/Approvals').then(module=>({default:module.Approvals})));
const BuyerDashboard=lazy(()=>import('./pages/dashboard/BuyerDashboard').then(module=>({default:module.BuyerDashboard})));
const BuyerOrders=lazy(()=>import('./pages/dashboard/BuyerOrders').then(module=>({default:module.BuyerOrders})));
const Reports=lazy(()=>import('./pages/dashboard/Reports').then(module=>({default:module.Reports})));
const SellerCoupons=lazy(()=>import('./pages/dashboard/SellerCoupons').then(module=>({default:module.SellerCoupons})));
const SellerOrders=lazy(()=>import('./pages/dashboard/SellerOrders').then(module=>({default:module.SellerOrders})));
const SellerSettings=lazy(()=>import('./pages/dashboard/SellerSettings').then(module=>({default:module.SellerSettings})));
const SeoManager=lazy(()=>import('./pages/dashboard/SeoManager').then(module=>({default:module.SeoManager})));
const RealCart=lazy(()=>import('./pages/MarketplaceProductPages').then(module=>({default:module.RealCart})));
const RealProductDetails=lazy(()=>import('./pages/MarketplaceProductPages').then(module=>({default:module.RealProductDetails})));
const Foods=lazy(()=>import('./pages/marketplace/Foods').then(module=>({default:module.Foods})));
const Home=lazy(()=>import('./pages/marketplace/Home').then(module=>({default:module.Home})));
const AdminSellerAnalytics=lazy(()=>import('./pages/SellerAnalyticsPages').then(module=>({default:module.AdminSellerAnalytics})));
const RealSellerAnalytics=lazy(()=>import('./pages/SellerAnalyticsPages').then(module=>({default:module.RealSellerAnalytics})));
const RealSellerDashboard=lazy(()=>import('./pages/SellerAnalyticsPages').then(module=>({default:module.RealSellerDashboard})));
const RealFoodForm=lazy(()=>import('./pages/SellerProductForm').then(module=>({default:module.RealFoodForm})));
const RealSellerProducts=lazy(()=>import('./pages/SellerProducts').then(module=>({default:module.RealSellerProducts})));
function Protected({ role }: { role: Role }) {
  const { user, ready } = useAuth(),
    loc = useLocation();
  if (!ready)
    return (
      <div className="grid min-h-screen place-items-center font-bold text-stone-500">
        Restoring your session...
      </div>
    );
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (user.role !== role)
    return <Navigate to={`/${user.role.toLowerCase()}/dashboard`} replace />;
  if (["BANNED", "REJECTED", "PENDING"].includes(user.status))
    return <StatusBlock />;
  if (
    user.status === "SUSPENDED" ||
    (user.role === "SELLER" && user.status === "FROZEN")
  )
    return <RestrictedAccount />;
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
function RestrictedAccount() {
  const { user, setUser, restore } = useAuth();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const {data:appeal,isLoading}=useQuery({queryKey:["my-reactivation-request",user?.id],queryFn:reactivationService.mine,enabled:!!user,refetchInterval:60_000});
  const request = useMutation({meta:{successMessage:"Reactivation request submitted."},
    mutationFn: () => reactivationService.request(user!, reason),
    onSuccess: () => {setReason("");qc.invalidateQueries({queryKey:["my-reactivation-request",user?.id]});qc.invalidateQueries({queryKey:["reactivation-requests"]})},
  });
  useEffect(()=>{if(appeal?.status==="APPROVED")void restore()},[appeal?.status,restore]);
  if (!user) return null;
  const pending=appeal?.status==="PENDING";
  return (
    <div className="grid min-h-screen place-items-center bg-stone-50 p-4">
      <div className="card w-full max-w-xl p-8 text-center">
        <div className="text-5xl">
          {user.status === "FROZEN" ? "FROZEN" : "SUSPENDED"}
        </div>
        <h1 className="mt-5 text-3xl font-extrabold">
          Account {user.status.toLowerCase()}
        </h1>
        <p className="mt-3 text-stone-500">
          {user.role === "SELLER"
            ? "You cannot create listings, manage orders, or perform delivery actions until an admin approves reactivation."
            : "You cannot place orders or use buyer actions while this suspension is active."}
        </p>
        {isLoading ? <p className="mt-6 text-sm font-bold text-stone-500">Checking your application...</p> : !pending && (
          <>
            {appeal?.status==="REJECTED"&&<div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700"><b>Previous application rejected.</b><p className="mt-1">You may submit a new application with more information.</p></div>}
            <textarea
              className="field mt-6 min-h-24 text-left"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell the admin why your account should be reactivated..."
            />
            <button
              className="btn-primary mt-3 w-full"
              disabled={reason.trim().length < 3 || request.isPending}
              onClick={() => request.mutate()}
            >
              {request.isPending ? "Sending..." : "Request reactivation"}
            </button>
          </>
        )}
        {pending && (
          <div className="mt-6 rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">
            Your application is pending and waiting for admin review.
          </div>
        )}
        {request.isError&&<div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{request.error.message}</div>}
        <button
          className="btn-secondary mt-3 w-full"
          onClick={() => setUser(null)}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
function StatusBlock() {
  const { user, setUser } = useAuth();
  return (
    <div className="grid min-h-screen place-items-center bg-stone-50 p-4">
      <div className="card max-w-lg p-10 text-center">
        <div className="text-5xl">
          {user?.status === "BANNED" ? "BLOCKED" : "PENDING"}
        </div>
        <h1 className="mt-5 text-3xl font-extrabold">
          {user?.status === "PENDING"
            ? "Waiting for admin approval."
            : user?.status === "REJECTED"
              ? "Application rejected"
              : "Account access restricted"}
        </h1>
        <p className="mt-3 text-stone-500">
          {user?.reason ??
            "Your account status currently prevents access to marketplace actions. Contact support if you believe this is a mistake."}
        </p>
        <button className="btn-primary mt-6" onClick={() => setUser(null)}>
          Return to sign in
        </button>
      </div>
    </div>
  );
}
const Public = ({ children }: { children: React.ReactNode }) => (
  <PublicLayout><PlatformNotice/>{children}</PublicLayout>
);
function MarketplaceRoute() {
  const location = useLocation();
  return <Foods key={location.search} />;
}
function SellerApplicationRoute() {
  const { user } = useAuth();
  return user?.role === "SELLER" ? (
    <Navigate to="/seller/dashboard" replace />
  ) : (
    <RealBecomeSeller />
  );
}
export default function App() {
  return (
    <Suspense fallback={<div className="grid min-h-64 place-items-center">Loading...</div>}><Routes>
      <Route
        path="/"
        element={
          <Public>
            <Home />
          </Public>
        }
      />
      <Route
        path="/cart"
        element={
          <Public>
            <RealCart />
          </Public>
        }
      />
      <Route path="/categories" element={<Navigate to="/foods" replace />} />
      <Route
        path="/foods"
        element={
          <Public>
            <MarketplaceRoute />
          </Public>
        }
      />
      <Route
        path="/foods/:id"
        element={
          <Public>
            <RealProductDetails />
          </Public>
        }
      />
      <Route
        path="/become-seller"
        element={
          <Public>
            <SellerApplicationRoute />
          </Public>
        }
      />
      <Route
        path="/login"
        element={
          <Public>
            <RealLogin />
          </Public>
        }
      />
      <Route path="/register" element={<Navigate to="/login" />} />
      <Route element={<Protected role="BUYER" />}>
        <Route path="/buyer/dashboard" element={<BuyerDashboard />} />
        <Route path="/buyer/orders" element={<BuyerOrders />} />
        <Route path="/buyer/saved" element={<SavedProducts />} />
        <Route
          path="/buyer/settings"
          element={<AccountSettings />}
        />
      </Route>
      <Route element={<Protected role="SELLER" />}>
        <Route path="/seller/dashboard" element={<RealSellerDashboard />} />
        <Route path="/seller/foods" element={<RealSellerProducts />} />
        <Route path="/seller/foods/new" element={<RealFoodForm />} />
        <Route path="/seller/foods/:id/edit" element={<RealFoodForm />} />
        <Route path="/seller/orders" element={<SellerOrders />} />
        <Route path="/seller/coupons" element={<SellerCoupons />} />
        <Route path="/seller/seo" element={<SeoManager />} />
        <Route path="/seller/analytics" element={<RealSellerAnalytics />} />
        <Route path="/seller/settings" element={<SellerSettings />} />
      </Route>
      <Route element={<Protected role="ADMIN" />}>
        <Route path="/admin/dashboard" element={<MarketplaceOverview />} />
        <Route path="/admin/users" element={<RealAdminUsers />} />
        <Route path="/admin/approvals" element={<Approvals />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/foods" element={<MarketplaceInventory />} />
        <Route
          path="/admin/users/:id/analytics"
          element={<AdminSellerAnalytics />}
        />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin/system" element={<AdminSystemAnalytics />} />
        <Route
          path="/admin/settings"
          element={<PlatformSettings />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes></Suspense>
  );
}
