import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, FileWarning, Minus, Plus, ShieldCheck, ShoppingCart, Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Empty, Loading, Modal, Spinner } from '../components/ui';
import { analyticsTrackingService, couponService, foodService, orderService, reportService, reviewService } from '../services';
import { sellingPrice } from '../services/pricing';
import { useAuth } from '../store/auth';
import { useCart } from '../store/cart';
import type { Coupon } from '../types';
const itemKey = (productId: string, variantId?: string) => `${productId}:${variantId ?? ''}`;
export function RealProductDetails() {
    const { id = '' } = useParams();
    const nav = useNavigate();
    const qc = useQueryClient();
    const user = useAuth(state => state.user);
    const add = useCart(state => state.add);
    const [imageIndex, setImageIndex] = useState(0), [variantIndex, setVariantIndex] = useState(0), [quantity, setQuantity] = useState(1), [note, setNote] = useState(''), [added, setAdded] = useState(false), [rating, setRating] = useState(5), [comment, setComment] = useState(''), [reportOpen, setReportOpen] = useState(false), [reportReason, setReportReason] = useState('');
    const { data: product, isLoading, isError } = useQuery({ queryKey: ['product', id], queryFn: () => foodService.getById(id) });
    useEffect(() => { if (product?.id) void analyticsTrackingService.browse([product.id], 'PRODUCT_VIEW').catch(() => undefined); }, [product?.id]);
    const { data: reviews = [] } = useQuery({ queryKey: ['reviews', id], queryFn: () => reviewService.forFood(id), enabled: !!id });
    const activeReport = useQuery({ queryKey: ['active-product-report', user?.id, id], queryFn: () => reportService.activeProduct(id), enabled: !!user && !!id });
    const review = useMutation({ meta: { successMessage: "Review submitted." }, mutationFn: () => reviewService.submit(id, { rating, comment }), onSuccess: () => { setComment(''); qc.invalidateQueries({ queryKey: ['reviews', id] }); qc.invalidateQueries({ queryKey: ['product', id] }); } });
    const report = useMutation({ meta: { successMessage: 'Product report submitted.' }, mutationFn: () => reportService.create({ targetId: id, type: 'Food', reason: reportReason }), onSuccess: () => { setReportOpen(false); setReportReason(''); void qc.invalidateQueries({ queryKey: ['active-product-report', user?.id, id] }); } });
    if (isLoading)
        return <div className="container-x py-16"><Loading cards={2}/></div>;
    if (isError || !product)
        return <div className="container-x py-16"><Empty title="Product not found" body="This listing is unavailable or has been removed."/></div>;
    const images = product.images.length ? product.images : [product.image];
    const variant = product.variants?.[variantIndex];
    const price = sellingPrice(product, variant);
    const own = user?.role === 'SELLER' && user.id === product.sellerId;
    const addSelected = () => { add({ food: product, variant, quantity, note }); void analyticsTrackingService.addToCart(product.id, quantity).catch(() => undefined); setAdded(true); };
    return <div className="container-x py-12">
    <div className="mb-6 text-sm text-stone-500"><Link to="/foods">Marketplace</Link> / {product.name}</div>
    <div className="grid gap-10 lg:grid-cols-[1.2fr,.8fr]">
      <section><div className="relative"><img src={images[imageIndex]} alt={product.name} className="h-[430px] w-full rounded-[2rem] object-cover"/>{images.length > 1 && <><button className="absolute left-4 top-1/2 rounded-full bg-white/90 p-2 shadow" onClick={() => setImageIndex((imageIndex - 1 + images.length) % images.length)}><ChevronLeft /></button><button className="absolute right-4 top-1/2 rounded-full bg-white/90 p-2 shadow" onClick={() => setImageIndex((imageIndex + 1) % images.length)}><ChevronRight /></button></>}</div>
        {images.length > 1 && <div className="mt-3 flex gap-3 overflow-x-auto">{images.map((image, index) => <button key={`${image}-${index}`} onClick={() => setImageIndex(index)} className={`shrink-0 rounded-xl border-2 ${index === imageIndex ? 'border-brand-600' : 'border-transparent'}`}><img src={image} alt={`${product.name} ${index + 1}`} className="h-20 w-24 rounded-lg object-cover"/></button>)}</div>}
        <div className="mt-8"><div className="flex gap-2">{product.boosted && <Badge tone="amber">Featured</Badge>}<Badge>{product.category}</Badge></div><h1 className="mt-4 text-4xl font-extrabold">{product.name}</h1><p className="mt-5 leading-7 text-stone-600">{product.description}</p><div className="mt-7 flex flex-wrap gap-2">{product.ingredients.map(item => <Badge key={item} tone="gray">{item}</Badge>)}</div><div className="card mt-7 flex items-center gap-4 p-5"><ShieldCheck className="text-brand-600"/><div><small className="text-stone-500">Sold by</small><h3 className="font-extrabold">{product.seller}</h3></div></div></div>
      </section>
      <aside className="card h-fit p-6 lg:sticky lg:top-24"><div className="flex items-baseline justify-between"><b className="text-3xl">৳{price}</b><span className="text-sm font-semibold text-emerald-700">Order any quantity</span></div>
        {!!product.variants?.length && <div className="mt-6"><label className="label">Choose a variant</label><div className="mt-2 grid gap-2">{product.variants.map((item, index) => <button type="button" key={item.id} onClick={() => { setVariantIndex(index); setQuantity(1); }} className={`flex items-center justify-between rounded-xl border p-3 text-left ${index === variantIndex ? 'border-brand-600 bg-brand-50' : 'border-stone-200'}`}><span><b>{[item.color, item.size].filter(Boolean).join(' · ')}</b>{item.sku && <small className="ml-2 text-stone-400">{item.sku}</small>}</span><span><b>৳{sellingPrice(product, item)}</b><small className="ml-2 text-emerald-700">Available</small></span></button>)}</div></div>}
        <label className="label mt-6">Quantity</label><div className="flex w-fit items-center rounded-xl border"><button className="p-3" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16}/></button><b className="w-10 text-center">{quantity}</b><button className="p-3" onClick={() => setQuantity(quantity + 1)}><Plus size={16}/></button></div>
        <label className="label mt-5">Order note</label><textarea value={note} onChange={event => setNote(event.target.value)} className="field min-h-20" maxLength={180}/><div className="mt-5 flex justify-between font-bold"><span>Total</span><span>৳{price * quantity}</span></div><Button className="mt-4 w-full" disabled={own || product.sellerAcceptingOrders === false || !['ACTIVE', 'PRE_ORDER_AVAILABLE'].includes(product.status)} onClick={addSelected}><ShoppingCart size={17}/>{added ? 'Add this variant again' : 'Add selected variant'}</Button>{added && <><p className="mt-2 text-center text-sm font-semibold text-emerald-700">Added. Select another variant to add it separately.</p><Button variant="secondary" className="mt-2 w-full" onClick={() => nav('/cart')}>View cart</Button></>}{own && <p className="mt-3 text-center text-sm text-amber-700">You cannot order your own product.</p>}
      </aside>
    </div>
    {!own && <div className="mt-7 flex justify-end"><Button variant="secondary" disabled={activeReport.data?.active || activeReport.isLoading} onClick={() => user ? setReportOpen(true) : nav('/login', { state: { from: { pathname: `/foods/${id}` } } })}><FileWarning size={17}/>{activeReport.data?.active ? 'Report under review' : user ? 'Report this product' : 'Sign in to report'}</Button></div>}
    <Modal open={reportOpen} title={`Report ${product.name}`} onClose={() => { if (!report.isPending) setReportOpen(false); }}>
      <p className="text-sm text-stone-600">Tell the moderation team what is wrong with this listing. You cannot submit another report for it until this one is resolved.</p>
      <label className="mt-5 block"><span className="label">Reason</span><textarea autoFocus className="field min-h-32" maxLength={1000} value={reportReason} onChange={event => setReportReason(event.target.value)} placeholder="Describe the issue clearly..."/></label>
      {report.isError && <p className="mt-3 text-sm font-semibold text-red-600">{report.error.message}</p>}
      <div className="mt-5 flex justify-end gap-3"><Button variant="secondary" disabled={report.isPending} onClick={() => setReportOpen(false)}>Cancel</Button><Button variant="danger" disabled={reportReason.trim().length < 3 || report.isPending} onClick={() => report.mutate()}>{report.isPending ? <Spinner/> : 'Submit report'}</Button></div>
    </Modal>
    <section className="mt-14"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-bold text-brand-600">VERIFIED FEEDBACK</p><h2 className="mt-1 text-3xl font-extrabold">Ratings & reviews</h2><p className="text-sm text-stone-500">Each buyer can review this product once after a completed order.</p></div><div className="flex items-center gap-2 text-xl font-bold text-amber-500"><Star fill="currentColor"/> {product.rating || 'New'}</div></div>
      {user?.role === 'BUYER' && <div className="card mt-6 p-5"><h3 className="font-extrabold">Write your one-time review</h3><div className="mt-3 flex gap-1">{[1, 2, 3, 4, 5].map(value => <button key={value} onClick={() => setRating(value)}><Star className={value <= rating ? 'text-amber-500' : 'text-stone-300'} fill={value <= rating ? 'currentColor' : 'none'}/></button>)}</div><textarea className="field mt-4 min-h-24" value={comment} onChange={event => setComment(event.target.value)} placeholder="Share your experience..."/><Button className="mt-3" disabled={comment.trim().length < 3 || review.isPending} onClick={() => review.mutate()}>{review.isPending ? <Spinner /> : 'Submit review'}</Button>{review.isError && <p className="mt-3 text-sm font-semibold text-red-600">{(review.error as Error).message}</p>}{review.isSuccess && <p className="mt-3 font-semibold text-emerald-700">Review submitted.</p>}</div>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">{reviews.length ? reviews.map(item => <article className="card p-5" key={item.id}><div className="flex items-center gap-3"><img src={item.avatar} className="h-11 w-11 rounded-xl"/><div><b>{item.buyer}</b><p className="text-xs text-stone-500">Verified order · {item.date}</p></div><span className="ml-auto font-bold text-amber-500">{'★'.repeat(item.rating)}</span></div><p className="mt-4 text-sm text-stone-600">{item.comment}</p></article>) : <Empty title="No reviews yet" body="Completed buyers can leave the first verified review."/>}</div>
    </section>
  </div>;
}
export function RealCart() {
    const { items, remove, setQuantity } = useCart();
    const user = useAuth(state => state.user);
    const nav = useNavigate();
    const [complete, setComplete] = useState(false), [address, setAddress] = useState(''), [phone, setPhone] = useState(''), [date, setDate] = useState(''), [time, setTime] = useState(''), [instructions, setInstructions] = useState(''), [couponCode, setCouponCode] = useState(''), [coupon, setCoupon] = useState<Coupon | null>(null);
    const checkoutTracked = useRef(false);
    useEffect(() => { if (items.length && !checkoutTracked.current) {
        checkoutTracked.current = true;
        void analyticsTrackingService.funnel([...new Set(items.map(item => item.food.id))], 'CHECKOUT_STARTED').catch(() => undefined);
    } }, [items]);
    const redeem = useMutation({ meta: { successMessage: "Coupon applied." }, mutationFn: () => couponService.redeem(couponCode, Array.from(new Set(items.map(item => item.food.sellerId)))), onSuccess: setCoupon });
    const subtotal = items.reduce((sum, item) => sum + (item.variant?.discountPrice ?? sellingPrice(item.food, item.variant)) * item.quantity, 0);
    const couponBase = coupon ? items.filter(item => item.food.sellerId === coupon.sellerId).reduce((sum, item) => sum + (item.variant?.discountPrice ?? sellingPrice(item.food, item.variant)) * item.quantity, 0) : 0;
    const discount = coupon ? Math.round(couponBase * coupon.discountPercent) / 100 : 0;
    const checkout = useMutation({ meta: { successMessage: 'Order placed successfully.' }, mutationFn: async () => {
            const pending = [...items];
            let succeeded = 0;
            const errors: string[] = [];
            for (const [index, item] of pending.entries()) {
                if (index > 0 && index % 5 === 0)
                    await new Promise(resolve => setTimeout(resolve, 1050));
                try {
                    await orderService.place({ idempotencyKey: item.checkoutKey ?? crypto.randomUUID(), foodId: item.food.id, variantId: item.variant?.id, variantLabel: [item.variant?.color, item.variant?.size].filter(Boolean).join(' · ') || undefined, couponCode: coupon?.sellerId === item.food.sellerId ? coupon.code : undefined, food: item.food.name, itemType: item.food.category === 'Food' ? 'FOOD' : 'PRODUCT', image: item.food.image, buyer: user?.name ?? '', seller: item.food.seller, quantity: item.quantity, total: (sellingPrice(item.food, item.variant)) * item.quantity, deliveryDate: date, deliveryTime: time, deliveryAddress: address, phone, instructions: item.note || instructions });
                    remove(itemKey(item.food.id, item.variant?.id), true);
                    succeeded++;
                }
                catch (error) {
                    errors.push(error instanceof Error ? error.message : 'Order failed');
                }
            }
            if (errors.length)
                throw Error(`${succeeded} item(s) ordered; ${errors.length} remain in your cart. ${errors[0]}`);
        }, onSuccess: () => { setComplete(true); } });
    if (complete)
        return <div className="container-x py-20"><div className="card mx-auto max-w-xl p-10 text-center"><Check className="mx-auto text-brand-600" size={52}/><h1 className="mt-4 text-3xl font-extrabold">Order placed successfully</h1><Link className="btn-primary mt-6" to={user?.role === 'SELLER' ? '/seller/dashboard' : '/buyer/orders'}>View orders</Link></div></div>;
    return <div className="container-x py-12"><h1 className="text-4xl font-extrabold">Your cart</h1>{items.length ? <div className="mt-8 grid gap-7 lg:grid-cols-[1.1fr,.9fr]"><section className="space-y-3">{items.map(item => { const key = itemKey(item.food.id, item.variant?.id); const price = sellingPrice(item.food, item.variant); return <div className="card flex gap-4 p-4" key={key}><img src={item.food.image} className="h-24 w-28 rounded-xl object-cover"/><div className="flex-1"><h2 className="font-extrabold">{item.food.name}</h2>{item.variant && <p className="text-sm text-brand-700">{[item.variant.color, item.variant.size].filter(Boolean).join(' · ')}</p>}<p className="text-sm text-stone-500">৳{price} each</p><div className="mt-3 flex items-center gap-3"><button onClick={() => setQuantity(key, item.quantity - 1)}><Minus size={16}/></button><b>{item.quantity}</b><button onClick={() => setQuantity(key, item.quantity + 1)}><Plus size={16}/></button><button className="ml-3 text-sm font-bold text-red-600" onClick={() => remove(key)}>Remove</button></div></div><b>৳{price * item.quantity}</b></div>; })}</section><aside className="card h-fit p-6"><h2 className="text-xl font-extrabold">Delivery details</h2><label className="label mt-4">Address</label><textarea className="field min-h-20" value={address} onChange={e => setAddress(e.target.value)}/><label className="label mt-4">Phone</label><input className="field" value={phone} onChange={e => setPhone(e.target.value)}/><div className="mt-4 grid grid-cols-2 gap-3"><label><span className="label">Date</span><input type="date" min={new Date().toISOString().slice(0, 10)} className="field" value={date} onChange={e => setDate(e.target.value)}/></label><label><span className="label">Time</span><input type="time" className="field" value={time} onChange={e => setTime(e.target.value)}/></label></div><label className="label mt-4">Instructions</label><textarea className="field min-h-20" value={instructions} onChange={e => setInstructions(e.target.value)}/><div className="mt-5 border-t pt-5"><label className="label">Seller coupon</label><div className="flex gap-2"><input className="field uppercase" value={couponCode} onChange={e => { setCouponCode(e.target.value.replace(/\s/g, '')); setCoupon(null); redeem.reset(); }} placeholder="Enter coupon code"/><Button variant="secondary" disabled={!couponCode || redeem.isPending} onClick={() => redeem.mutate()}>{redeem.isPending ? 'Checking...' : 'Apply'}</Button></div>{redeem.isError && <p className="mt-2 text-sm font-semibold text-red-600">{(redeem.error as Error).message}</p>}{coupon && <p className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{coupon.code}: {coupon.discountPercent}% off {coupon.seller}</p>}</div><div className="mt-5 space-y-2 border-t pt-5 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>৳{subtotal}</span></div>{coupon && <div className="flex justify-between text-emerald-700"><span>Coupon discount</span><span>-৳{discount}</span></div>}<div className="flex justify-between border-t pt-3 text-lg font-extrabold"><span>Total</span><span>৳{subtotal - discount}</span></div></div><Button className="mt-5 w-full" disabled={!!user && (address.trim().length < 10 || phone.trim().length < 10 || !date || !time || checkout.isPending)} onClick={() => user ? checkout.mutate() : nav('/login', { state: { from: { pathname: '/cart' } } })}>{user ? (checkout.isPending ? <Spinner /> : 'Place order') : 'Sign in to checkout'}</Button>{checkout.isError && <p className="mt-3 text-sm font-semibold text-red-600">{(checkout.error as Error).message}</p>}</aside></div> : <div className="mt-8"><Empty title="Your cart is empty" body="Choose a product and variant from the marketplace."/></div>}</div>;
}
