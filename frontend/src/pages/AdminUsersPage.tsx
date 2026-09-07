import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Empty,
  Loading,
  Modal,
  Spinner,
} from "../components/ui";
import { adminUserService } from "../services";
import type { User } from "../types";
import { formatDate, formatDateTime } from "../utils/dateTime";

type Action = "ACTIVE" | "SUSPENDED" | "BANNED";
export function RealAdminUsers() {
  const nav = useNavigate(),
    qc = useQueryClient();
  const [search, setSearch] = useState(""),
    [role, setRole] = useState("ALL"),
    [target, setTarget] = useState<{ user: User; action: Action } | null>(null),
    [reason, setReason] = useState(""),
    [duration, setDuration] = useState("7");
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: adminUserService.list,
  });
  const shown = useMemo(
    () =>
      data.filter(
        (user) =>
          (role === "ALL" || user.role === role) &&
          (user.name + " " + user.email)
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [data, role, search],
  );
  const mutation = useMutation({
    meta: { successMessage: "Account status updated." },
    mutationFn: () =>
      adminUserService.setStatus(target!.user.id, {
        status: target!.action,
        reason: target!.action === "ACTIVE" ? undefined : reason,
        durationDays:
          target!.action === "ACTIVE"
            ? undefined
            : duration === "permanent"
              ? null
              : Number(duration),
      }),
    onSuccess: (updated) => {
      qc.setQueryData<User[]>(["admin-users"], (current) =>
        current?.map((user) => (user.id === updated.id ? updated : user)),
      );
      setTarget(null);
      setReason("");
    },
  });
  return (
    <>
      <div className="mb-7">
        <h1 className="text-3xl font-extrabold">User management</h1>
        <p className="text-stone-500">
          Manage buyers and sellers, account access, and seller analytics.
        </p>
      </div>
      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-[1fr,180px]">
        <input
          className="field"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email..."
        />
        <select
          className="field"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="ALL">All roles</option>
          <option>BUYER</option>
          <option>SELLER</option>
          <option>ADMIN</option>
        </select>
      </div>
      {isLoading ? (
        <Loading />
      ) : shown.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-stone-50">
              <tr>
                {[
                  "User",
                  "Role",
                  "Status",
                  "Joined",
                  "Restriction",
                  "Actions",
                ].map((x) => (
                  <th className="px-5 py-4" key={x}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((user) => (
                <tr className="border-b last:border-0" key={user.id}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <img src={user.avatar} className="h-10 w-10 rounded-xl" />
                      <div>
                        <b className="block">{user.name}</b>
                        <small className="text-stone-500">{user.email}</small>
                      </div>
                    </div>
                  </td>
                  <td className="px-5">
                    <Badge tone={user.role === "SELLER" ? "purple" : "gray"}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-5">
                    <Badge
                      tone={
                        user.status === "ACTIVE"
                          ? "green"
                          : user.status === "BANNED"
                            ? "red"
                            : "amber"
                      }
                    >
                      {user.status}
                    </Badge>
                  </td>
                    <td className="px-5">{formatDate(user.joined)}</td>
                  <td className="max-w-52 px-5 text-xs text-stone-500">
                    {user.reason ?? "—"}
                    {user.restrictionEnds && (
                      <span className="block">
                          Until {formatDateTime(user.restrictionEnds)}
                      </span>
                    )}
                  </td>
                  <td className="px-5">
                    <div className="flex flex-wrap gap-3">
                      {user.role === "SELLER" && (
                        <button
                          className="font-bold text-violet-700"
                          onClick={() =>
                            nav(`/admin/users/${user.id}/analytics`)
                          }
                        >
                          Analytics
                        </button>
                      )}
                      {user.role !== "ADMIN" && (
                        <>
                          {user.status !== "ACTIVE" && (
                            <button
                              className="font-bold text-brand-700"
                              onClick={() =>
                                setTarget({ user, action: "ACTIVE" })
                              }
                            >
                              Reactivate
                            </button>
                          )}
                          <button
                            className="font-bold text-amber-700"
                            onClick={() =>
                              setTarget({ user, action: "SUSPENDED" })
                            }
                          >
                            Suspend
                          </button>
                          <button
                            className="font-bold text-red-600"
                            onClick={() =>
                              setTarget({ user, action: "BANNED" })
                            }
                          >
                            Ban
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No users found" />
      )}
      <Modal
        open={!!target}
        title={`${target?.action === "ACTIVE" ? "Reactivate" : target?.action === "BANNED" ? "Ban" : "Suspend"} ${target?.user.name ?? ""}`}
        onClose={() => setTarget(null)}
      >
        {target?.action !== "ACTIVE" && (
          <>
            <label className="label">Reason</label>
            <textarea
              className="field min-h-24"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required moderation reason"
            />
            <label className="label mt-4">Duration</label>
            <select
              className="field"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="permanent">Permanent</option>
            </select>
          </>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setTarget(null)}>
            Cancel
          </Button>
          <Button
            variant={target?.action === "BANNED" ? "danger" : "primary"}
            disabled={
              mutation.isPending ||
              (target?.action !== "ACTIVE" && !reason.trim())
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner /> : "Confirm"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
