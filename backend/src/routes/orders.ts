import {createHash} from 'node:crypto';
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { UserModel } from "../models/User.js";
import { CouponModel } from "../models/Coupon.js";
import { AnalyticsEventModel } from "../models/AnalyticsEvent.js";
import { NotificationModel } from "../models/Notification.js";


export const orderRouter = Router();
const foodCategories = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snacks",
  "Desserts",
  "Drinks",
  "Homemade",
  "Healthy",
  "Food",
];
const statuses = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "PACKED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "RETURNED",
] as const;
const createSchema = z.object({
  idempotencyKey: z.string().uuid(),
  foodId: z.string().regex(/^[a-f\d]{24}$/i),
  variantId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  couponCode: z.string().trim().toUpperCase().optional(),
  quantity: z.coerce.number().int().min(1).max(10000),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deliveryTime: z.string().regex(/^\d{2}:\d{2}$/),
  deliveryAddress: z.string().trim().min(10).max(500),
  phone: z.string().trim().min(10).max(30),
  instructions: z.string().trim().max(250).optional(),
});
const deadline = (date: string, time: string) =>
  new Date(`${date}T${time}:00+06:00`);
const restoreInventory=async(productId:unknown,variantId:unknown,quantity:number)=>{
  if(variantId)await ProductModel.updateOne({_id:productId},{$inc:{'variants.$[variant].quantity':quantity}},{arrayFilters:[{'variant._id':variantId}]});
  else await ProductModel.updateOne({_id:productId},{$inc:{quantity}});
};
const view = (order: any) => ({
  id: String(order._id),
  buyerId: String(order.buyerId),
  sellerId: String(order.sellerId),
  foodId: String(order.productId),
  variantId: order.variantId ? String(order.variantId) : undefined,
  variantLabel: order.variantLabel,
  food: order.food,
  itemType: order.itemType,
  image: order.image,
  buyer: order.buyer,
  seller: order.seller,
  quantity: order.quantity,
  total: order.total,
  couponCode: order.couponCode,
  discountPercent: order.discountPercent,
  discountAmount: order.discountAmount,
  deliveryDate: order.deliveryDate,
  deliveryTime: order.deliveryTime,
  allocatedDeliveryAt: order.allocatedDeliveryAt.toISOString(),
  deliveryAddress: order.deliveryAddress,
  phone: order.phone,
  instructions: order.instructions,
  status: order.status,
  createdAt: order.createdAt.toISOString(),
  extension: order.extension
    ? {
        minutes: order.extension.minutes,
        reason: order.extension.reason,
        status: order.extension.status,
        requestedAt: order.extension.requestedAt.toISOString(),
        decidedAt: order.extension.decidedAt?.toISOString(),
      }
    : undefined,
});

orderRouter.use(requireAuth);
orderRouter.get("/", async (req, res, next) => {
  try {
    const filter =
      req.authUser!.role === "SELLER"
        ? { sellerId: req.authUser!.id }
        : { buyerId: req.authUser!.id };
    const orders = await OrderModel.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json({
      success: true,
      message: "Orders loaded",
      data: orders.map(view),
    });
  } catch (error) {
    next(error);
  }
});

orderRouter.post(
  "/",
  requireRole("BUYER", "SELLER"),
  async (req, res, next) => {
    try {
      if (req.authUser!.status !== "ACTIVE") {
        res
          .status(403)
          .json({
            success: false,
            message: "Only active accounts can place orders",
          });
        return;
      }
      const input = createSchema.parse(req.body);
      const requestHash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
      const existing=await OrderModel.findOne({buyerId:req.authUser!.id,idempotencyKey:input.idempotencyKey});
      if(existing){if(existing.requestHash!==requestHash){res.status(409).json({success:false,message:'This checkout item changed after submission. Check your orders before placing it again.'});return}res.json({success:true,message:'Order already placed',data:view(existing)});return}
      const buyer = await UserModel.findById(req.authUser!.id);
      const product = await ProductModel.findById(input.foodId);
      if (!buyer || !product) {
        res
          .status(404)
          .json({ success: false, message: "Product or buyer not found" });
        return;
      }
      const seller = await UserModel.findById(product.sellerId).select(
        "acceptingOrders status role",
      );
      if (!seller || seller.acceptingOrders === false || seller.status !== 'ACTIVE' || seller.role !== 'SELLER') {
        res
          .status(409)
          .json({
            success: false,
            message: "This seller is not taking orders right now",
          });
        return;
      }
      if (String(product.sellerId) === req.authUser!.id) {
        res
          .status(400)
          .json({
            success: false,
            message: "You cannot order your own listing",
          });
        return;
      }
      if (!["ACTIVE", "PRE_ORDER_AVAILABLE"].includes(product.status)) {
        res
          .status(409)
          .json({
            success: false,
            message: "This product is not available to order",
          });
        return;
      }
      const selectedVariant = input.variantId
        ? product.variants.id(input.variantId)
        : product.variants.length === 1
          ? product.variants[0]
          : null;
      if (product.variants.length && !selectedVariant) {
        res
          .status(400)
          .json({ success: false, message: "Choose a valid product variant" });
        return;
      }
      const unitPrice =
        selectedVariant?.discountPrice ??
        selectedVariant?.price ??
        product.discountPrice ??
        product.price;
      const subtotal = Math.round(unitPrice * input.quantity * 100) / 100;
      const coupon = input.couponCode
        ? await CouponModel.findOne({
            code: input.couponCode,
            active: true,
            sellerId: product.sellerId,
          })
        : null;
      if (input.couponCode && !coupon) {
        res
          .status(400)
          .json({
            success: false,
            message:
              "Coupon is invalid, inactive, or does not apply to this seller",
          });
        return;
      }
      const discountAmount = coupon
        ? Math.round(subtotal * coupon.discountPercent) / 100
        : 0;
      const allocatedDeliveryAt = deadline(
        input.deliveryDate,
        input.deliveryTime,
      );
      if (
        Number.isNaN(allocatedDeliveryAt.getTime()) ||
        allocatedDeliveryAt.getTime() <= Date.now()
      ) {
        res
          .status(400)
          .json({
            success: false,
            message: "Delivery date and time must be in the future",
          });
        return;
      }
      const visitorId =
        String(req.header("X-Visitor-Id") ?? "").slice(0, 100) || undefined;
      const attribution = visitorId
        ? await AnalyticsEventModel.findOne({
            visitorId,
            productId: product._id,
            type: { $in: ["ADD_TO_CART", "PRODUCT_VIEW"] },
          })
            .sort({ createdAt: -1 })
            .select("source campaignId")
            .lean()
        : null;
      const reservesInventory=product.status!=='PRE_ORDER_AVAILABLE';
      if(reservesInventory){
        const reserved=selectedVariant
          ? await ProductModel.updateOne({_id:product._id,status:'ACTIVE',variants:{$elemMatch:{_id:selectedVariant._id,quantity:{$gte:input.quantity}}}},{$inc:{'variants.$.quantity':-input.quantity}})
          : await ProductModel.updateOne({_id:product._id,status:'ACTIVE',quantity:{$gte:input.quantity}},{$inc:{quantity:-input.quantity}});
        if(reserved.modifiedCount!==1){res.status(409).json({success:false,message:'The requested quantity is no longer available'});return}
      }
      let order;
      try{order = await OrderModel.create({
        idempotencyKey:input.idempotencyKey,requestHash,
        notificationEvents:[{userId:product.sellerId,type:'NEW_ORDER',title:'New order received',message:buyer.name+' ordered '+input.quantity+' x '+product.name,link:'/seller/orders?status=PENDING'}],
        buyerId: buyer._id,
        sellerId: product.sellerId,
        productId: product._id,
        variantId: selectedVariant?._id,
        variantLabel: selectedVariant
          ? [selectedVariant.color, selectedVariant.size]
              .filter(Boolean)
              .join(" · ") || "Default"
          : undefined,
        food: product.name,
        itemType: foodCategories.includes(product.category)
          ? "FOOD"
          : "PRODUCT",
        image: product.images[0],
        buyer: buyer.name,
        seller: product.seller,
        quantity: input.quantity,
        unitPrice,
        unitCost: selectedVariant
          ? (selectedVariant.costPrice ?? 0) +
            (selectedVariant.packagingCost ?? 0) +
            (selectedVariant.otherCost ?? 0)
          : (product.costPrice ?? 0) +
            (product.packagingCost ?? 0) +
            (product.otherCost ?? 0),
        inventoryReserved:reservesInventory,
        total: Math.round((subtotal - discountAmount) * 100) / 100,
        couponId: coupon?._id,
        couponCode: coupon?.code,
        discountPercent: coupon?.discountPercent,
        discountAmount,
        attributionSource: attribution?.source ?? "DIRECT",
        attributionCampaignId: attribution?.campaignId,
        deliveryDate: input.deliveryDate,
        deliveryTime: input.deliveryTime,
        allocatedDeliveryAt,
        deliveryAddress: input.deliveryAddress,
        phone: input.phone,
        instructions: input.instructions,
        status: "PENDING",
      })}catch(error){
        if(reservesInventory)await restoreInventory(product._id,selectedVariant?._id,input.quantity).catch(()=>undefined)
        throw error;
      }
      if (coupon)
        await CouponModel.updateOne(
          { _id: coupon._id },
          { $inc: { redemptions: 1 } },
        ).catch(error=>console.error("Coupon counter update failed",error));
      await UserModel.updateOne({_id:product.sellerId,role:'SELLER'},{$set:{sellerActivityAt:new Date()}});

      res
        .status(201)
        .json({ success: true, message: "Order placed", data: view(order) });
    } catch (error) {
      if((error as {code?:number}).code===11000){const existing=await OrderModel.findOne({buyerId:req.authUser!.id,idempotencyKey:req.body.idempotencyKey});if(existing){const parsed=createSchema.parse(req.body);const hash=createHash('sha256').update(JSON.stringify(parsed)).digest('hex');if(existing.requestHash!==hash){res.status(409).json({success:false,message:'Checkout request changed. Check your orders.'});return}res.json({success:true,message:'Order already placed',data:view(existing)});return}}
      next(error);
    }
  },
);

orderRouter.patch(
  "/:id/status",
  requireRole("SELLER"),
  async (req, res, next) => {
    try {
      if (req.authUser!.status !== "ACTIVE") {
        res
          .status(403)
          .json({
            success: false,
            message: "Only active sellers can manage orders",
          });
        return;
      }
      const { status } = z.object({ status: z.enum(statuses) }).parse(req.body);
      const order = await OrderModel.findOne({
        _id: req.params.id,
        sellerId: req.authUser!.id,
      });
      if (!order) {
        res.status(404).json({ success: false, message: "Order not found" });
        return;
      }
      if(status==='RETURNED'&&!['COMPLETED','DELIVERED'].includes(order.status)){
        res.status(409).json({success:false,message:'Only a completed or delivered order can be marked returned'});return;
      }
      if (["CANCELLED","RETURNED"].includes(order.status) && status !== order.status) {
        res
          .status(409)
          .json({
            success: false,
            message:
              "A cancelled or returned order status cannot be changed",
          });
        return;
      }
      const allowed: (typeof statuses)[number][] =
        order.itemType === "FOOD"
          ? [
              "PENDING",
              "ACCEPTED",
              "PREPARING",
              "READY",
              "OUT_FOR_DELIVERY",
              "COMPLETED",
              "CANCELLED",
              "RETURNED",
            ]
          : ["PENDING", "ACCEPTED", "PACKED", "DELIVERED", "CANCELLED", "RETURNED"];
      if (!allowed.includes(status)) {
        res
          .status(400)
          .json({
            success: false,
            message: `${status.replaceAll("_", " ")} is not valid for this ${order.itemType.toLowerCase()} order`,
          });
        return;
      }
      if (status === order.status) {
        res.json({
          success: true,
          message: "Order status unchanged",
          data: view(order),
        });
        return;
      }
      const releaseInventory=['CANCELLED','RETURNED'].includes(status)&&order.inventoryReserved;
      const updated=await OrderModel.findOneAndUpdate({_id:order._id,status:order.status},{$set:{status,...(releaseInventory?{inventoryReserved:false}:{})},$push:{notificationEvents:{userId:order.buyerId,type:'ORDER_STATUS',title:'Order status updated',message:order.food+' is now '+status.toLowerCase(),link:'/buyer/orders'}}},{new:true,runValidators:true});
      if(!updated){res.status(409).json({success:false,message:'Order changed. Refresh before trying again.'});return}
      if(releaseInventory)await restoreInventory(order.productId,order.variantId,order.quantity)
      await UserModel.updateOne({_id:req.authUser!.id,role:'SELLER'},{$set:{sellerActivityAt:new Date()}});
      order.status=updated.status;

      res.json({
        success: true,
        message: "Order status updated",
        data: view(order),
      });
    } catch (error) {
      next(error);
    }
  },
);

orderRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    const order = await OrderModel.findOne({
      _id: req.params.id,
      buyerId: req.authUser!.id,
    });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }
    if (!["PENDING", "ACCEPTED"].includes(order.status)) {
      res
        .status(409)
        .json({
          success: false,
          message: "This order can no longer be cancelled",
        });
      return;
    }
    const releaseInventory=order.inventoryReserved;
    const updated=await OrderModel.findOneAndUpdate({_id:order._id,status:{$in:['PENDING','ACCEPTED']}},{$set:{status:'CANCELLED',...(releaseInventory?{inventoryReserved:false}:{})},$push:{notificationEvents:{userId:order.sellerId,type:'ORDER_STATUS',title:'Order cancelled',message:order.food+' was cancelled by the buyer',link:'/seller/orders'}}},{new:true});
    if(!updated){res.status(409).json({success:false,message:'Order changed and can no longer be cancelled'});return}
    if(releaseInventory)await restoreInventory(order.productId,order.variantId,order.quantity)
    order.status=updated.status;
    res.json({ success: true, message: "Order cancelled", data: view(order) });
  } catch (error) {
    next(error);
  }
});

orderRouter.post(
  "/:id/extension",
  requireRole("SELLER"),
  async (req, res, next) => {
    try {
      if (req.authUser!.status !== "ACTIVE") {
        res
          .status(403)
          .json({
            success: false,
            message: "Only active sellers can request extensions",
          });
        return;
      }
      const input = z
        .object({
          minutes: z.coerce.number().int().min(15).max(120),
          reason: z.string().trim().min(3).max(500),
        })
        .parse(req.body);
      const order = await OrderModel.findOne({
        _id: req.params.id,
        sellerId: req.authUser!.id,
      });
      if (!order) {
        res.status(404).json({ success: false, message: "Order not found" });
        return;
      }
      if (
        order.itemType !== "FOOD" ||
        !["ACCEPTED", "PREPARING"].includes(order.status)
      ) {
        res
          .status(409)
          .json({
            success: false,
            message:
              "Extension is available only for accepted or preparing food orders",
          });
        return;
      }
      if (order.extension) {
        res
          .status(409)
          .json({
            success: false,
            message: "A time extension has already been requested for this order",
          });
        return;
      }
      order.extension = {
        ...input,
        status: "PENDING",
        requestedAt: new Date(),
      };
      const updated=await OrderModel.findOneAndUpdate({_id:order._id,status:order.status,extension:{$exists:false}},{$set:{extension:order.extension},$push:{notificationEvents:{userId:order.buyerId,resourceId:order._id,type:'EXTENSION_REQUEST',title:'Delivery extension requested',message:order.seller+' requested '+input.minutes+' extra minutes for '+order.food}}},{new:true});
      if(!updated){res.status(409).json({success:false,message:'Order changed. Refresh before requesting an extension.'});return}

      res.json({
        success: true,
        message: "Extension requested",
        data: view(order),
      });
    } catch (error) {
      next(error);
    }
  },
);

orderRouter.patch("/:id/extension", async (req, res, next) => {
  try {
    const { decision } = z
      .object({ decision: z.enum(["APPROVED", "REJECTED"]) })
      .parse(req.body);
    const order = await OrderModel.findOne({
      _id: req.params.id,
      buyerId: req.authUser!.id,
    });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }
    if (!order.extension || order.extension.status !== "PENDING" || !["ACCEPTED","PREPARING"].includes(order.status)) {
      res
        .status(409)
        .json({ success: false, message: "No pending extension request" });
      return;
    }
    order.extension.status = decision;
    order.extension.decidedAt = new Date();
    if (decision === "APPROVED") {
      order.allocatedDeliveryAt = new Date(
        order.allocatedDeliveryAt.getTime() + order.extension.minutes * 60000,
      );
      order.deliveryDate = order.allocatedDeliveryAt.toLocaleDateString(
        "en-CA",
        { timeZone: "Asia/Dhaka" },
      );
      order.deliveryTime = order.allocatedDeliveryAt.toLocaleTimeString(
        "en-GB",
        { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" },
      );
    }
    const updated=await OrderModel.findOneAndUpdate({_id:order._id,status:order.status,'extension.status':'PENDING','extension.requestedAt':order.extension.requestedAt},{$set:{extension:order.extension,allocatedDeliveryAt:order.allocatedDeliveryAt,deliveryDate:order.deliveryDate,deliveryTime:order.deliveryTime},$push:{notificationEvents:{userId:order.sellerId,type:'EXTENSION_DECISION',title:'Extension '+decision.toLowerCase(),message:order.food+': extension '+decision.toLowerCase(),link:'/seller/orders'}}},{new:true});
    if(!updated){res.status(409).json({success:false,message:'This extension was already handled or the order changed.'});return}
    await NotificationModel.updateMany({userId:order.buyerId,resourceId:order._id,type:'EXTENSION_REQUEST',resolvedAt:null},{$set:{resolvedAt:new Date(),readAt:new Date()}});

    res.json({
      success: true,
      message: `Extension ${decision.toLowerCase()}`,
      data: view(order),
    });
  } catch (error) {
    next(error);
  }
});
