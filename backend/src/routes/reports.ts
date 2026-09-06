import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ReportModel } from "../models/Report.js";
import { UserModel } from "../models/User.js";
import { ProductModel } from "../models/Product.js";
import { Types } from "mongoose";
import { notifyUser } from "../services/notifications.js";
import {invalidateAuthCache} from '../middleware/auth.js';
export const reportRouter = Router();
const view = (item: any) => ({
  id: String(item._id),
  reporterId: String(item.reporterId),
  reporter: item.reporter,
  targetId: String(item.targetId),
  target: item.target,
  type: item.type,
  reason: item.reason,
  date: item.createdAt.toISOString().slice(0, 10),
  status: item.status,
  action: item.action,
  moderatorNote: item.moderatorNote,
  restrictionEnds: item.restrictionEnds?.toISOString(),
});
reportRouter.post(
  "/",
  requireAuth,
  async (req, res, next) => {
    try {
      const input = z
        .object({
          targetId: z.string().regex(/^[a-f\d]{24}$/i),
          type: z.enum(["Seller", "Buyer", "Food"]),
          reason: z.string().trim().min(3).max(1000),
        })
        .parse(req.body);
      const reporter = await UserModel.findById(req.authUser!.id);
      if (!reporter) {
        res.status(404).json({ success: false, message: "Reporter not found" });
        return;
      }
      const target =
        input.type === "Food"
          ? await ProductModel.findById(input.targetId).select("name sellerId status")
          : await UserModel.findById(input.targetId).select("name role");
      if (!target) {
        res
          .status(404)
          .json({ success: false, message: "Reported target not found" });
        return;
      }
      if (
        input.type !== "Food" &&
        String((target as any).role).toLowerCase() !== input.type.toLowerCase()
      ) {
        res
          .status(400)
          .json({
            success: false,
            message: "Reported target type does not match",
          });
        return;
      }
      if (String(target._id) === req.authUser!.id) {
        res
          .status(400)
          .json({ success: false, message: "You cannot report yourself" });
        return;
      }
      if (
        input.type === "Food" &&
        String((target as any).sellerId) === req.authUser!.id
      ) {
        res.status(400).json({ success: false, message: "You cannot report your own product" });
        return;
      }
      const duplicate = await ReportModel.findOne({
        reporterId: reporter._id,
        targetId: target._id,
        type: input.type,
        status: { $in: ["OPEN", "UNDER_REVIEW"] },
      });
      if (duplicate) {
        res
          .status(409)
          .json({
            success: false,
            message: "You already have an active report for this target",
          });
        return;
      }
      const report = await ReportModel.create({
        reporterId: reporter._id,
        reporter: reporter.name,
        targetId: target._id,
        target: (target as any).name,
        type: input.type,
        reason: input.reason,
      });
      res
        .status(201)
        .json({
          success: true,
          message: "Report submitted",
          data: view(report),
        });
    } catch (error) {
      next(error);
    }
  },
);
reportRouter.get(
  "/mine/product/:id/active",
  requireAuth,
  async (req, res, next) => {
    try {
      const productId = z.string().regex(/^[a-f\d]{24}$/i).parse(req.params.id);
      const report = await ReportModel.findOne({
        reporterId: req.authUser!.id,
        targetId: productId,
        type: "Food",
        status: { $in: ["OPEN", "UNDER_REVIEW"] },
      }).select("status createdAt").lean();
      res.json({
        success: true,
        data: report ? { active: true, status: report.status, reportedAt: report.createdAt } : { active: false },
      });
    } catch (error) {
      next(error);
    }
  },
);
reportRouter.get(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res, next) => {
    try {
      const reports = await ReportModel.find()
        .sort({ createdAt: -1 })
        .limit(500);
      res.json({
        success: true,
        message: "Reports loaded",
        data: reports.map(view),
      });
    } catch (error) {
      next(error);
    }
  },
);
reportRouter.patch(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const input = z
        .object({
          action: z.enum([
            "UNDER_REVIEW",
            "RESOLVE",
            "DISMISS",
            "WARN",
            "SUSPEND",
            "BAN",
          ]),
          note: z.string().trim().max(2000).optional(),
          durationDays: z
            .number()
            .int()
            .positive()
            .max(3650)
            .nullable()
            .optional(),
        })
        .parse(req.body);
      const report = await ReportModel.findById(req.params.id);
      if (!report) {
        res.status(404).json({ success: false, message: "Report not found" });
        return;
      }
      if (["RESOLVED", "DISMISSED"].includes(report.status)) {
        res
          .status(409)
          .json({
            success: false,
            message: "This report has already been closed",
          });
        return;
      }
      if (
        ["SUSPEND", "BAN", "WARN"].includes(input.action) &&
        !input.note
      ) {
        res
          .status(400)
          .json({
            success: false,
            message: "A moderator note is required for this action",
          });
        return;
      }
      let moderationUserId = report.targetId;
      if (["SUSPEND", "BAN", "WARN"].includes(input.action) && report.type === "Food") {
        const product = await ProductModel.findById(report.targetId).select("sellerId");
        if (!product) {
          res.status(404).json({ success: false, message: "Reported product not found" });
          return;
        }
        moderationUserId = product.sellerId;
      }
      let restrictionEnds: Date | undefined;
      if (input.action === "SUSPEND") {
        restrictionEnds =
          input.durationDays == null
            ? undefined
            : new Date(Date.now() + input.durationDays * 86400000);
        const user = await UserModel.findById(moderationUserId).select(
          "+tokenVersion",
        );
        if (!user) {
          res
            .status(404)
            .json({ success: false, message: "Reported user not found" });
          return;
        }
        user.status = "SUSPENDED";
        user.restrictionReason = input.note;
        user.restrictionEnds = restrictionEnds;
        user.tokenVersion += 1;
        await user.save();
        invalidateAuthCache(String(user._id));
      }
      if (input.action === "BAN") {
        const user = await UserModel.findById(moderationUserId).select(
          "+tokenVersion",
        );
        if (!user) {
          res
            .status(404)
            .json({ success: false, message: "Reported user not found" });
          return;
        }
        user.status = "BANNED";
        user.restrictionReason = input.note;
        user.restrictionEnds = undefined;
        user.tokenVersion += 1;
        await user.save();
        invalidateAuthCache(String(user._id));
      }
      if (input.action === "WARN") {
        await notifyUser(moderationUserId, {
          type: "ACCOUNT_WARNING",
          title: "Account warning from marketplace admin",
          message: input.note!,
          link: report.type === "Seller" || report.type === "Food" ? "/seller/dashboard" : "/buyer/dashboard",
        });
      }
      report.action = input.action;
      report.moderatorId = new Types.ObjectId(req.authUser!.id);
      report.moderatorNote = input.note;
      report.restrictionEnds = restrictionEnds;
      report.status =
        input.action === "UNDER_REVIEW"
          ? "UNDER_REVIEW"
          : input.action === "DISMISS"
            ? "DISMISSED"
            : "RESOLVED";
      report.active = report.status === "UNDER_REVIEW";
      await report.save();
      res.json({
        success: true,
        message: "Report action applied",
        data: view(report),
      });
    } catch (error) {
      next(error);
    }
  },
);
