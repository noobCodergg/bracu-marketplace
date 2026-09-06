import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
Badge,
Button,
Loading,
Modal,
Spinner
} from "../../components/ui";
import {
adminService
} from "../../services";

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

export function Reports() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: adminService.reports,
  });
  const [selected, setSelected] = useState<(typeof data)[number] | null>(null);
  const [action, setAction] = useState("UNDER_REVIEW");
  const [note, setNote] = useState("");
  const [duration, setDuration] = useState("7 days");
  const mut = useMutation({
    mutationFn: ({
      id,
      action,
      note,
      durationDays,
    }: {
      id: string;
      action: "UNDER_REVIEW" | "RESOLVE" | "DISMISS" | "WARN" | "SUSPEND" | "BAN";
      note?: string;
      durationDays?: number | null;
    }) => adminService.updateReport(id, {action,note,durationDays}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      setSelected(null);
      setNote("");
    },
  });
  const applyAction = () => {
    if (!selected) return;
    const reportAction=action as "UNDER_REVIEW" | "RESOLVE" | "DISMISS" | "WARN" | "SUSPEND" | "BAN";
    const durationDays=reportAction==="SUSPEND"?(duration==="permanent"?null:Number.parseInt(duration)):undefined;
    mut.mutate({ id: selected.id, action:reportAction, note:note.trim()||undefined, durationDays });
  };
  return (
    <>
      <PageTitle
        title="Reports & moderation"
        sub="Resolve safety issues fairly and consistently."
      />
      {isLoading ? (
        <Loading />
      ) : (
        <div className="card overflow-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b bg-stone-50">
              <tr>
                {[
                  "Reporter",
                  "Reported target",
                  "Type",
                  "Reason",
                  "Date",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th className="px-5 py-4" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr className="border-b last:border-0" key={r.id}>
                  <td className="px-5 py-4">{r.reporter}</td>
                  <td className="px-5 font-bold">{r.target}</td>
                  <td className="px-5">{r.type}</td>
                  <td className="px-5">{r.reason}</td>
                  <td className="px-5">{r.date}</td>
                  <td className="px-5">
                    <Badge
                      tone={
                        r.status === "RESOLVED"
                          ? "green"
                          : r.status === "DISMISSED"
                            ? "gray"
                            : "amber"
                      }
                    >
                      {r.status.replaceAll("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-5">
                    <Button
                      variant="secondary"
                      disabled={["RESOLVED", "DISMISSED"].includes(r.status)}
                      onClick={() => {
                        setSelected(r);
                        setAction(
                          r.status === "OPEN" ? "UNDER_REVIEW" : "RESOLVE",
                        );
                      }}
                    >
                      {["RESOLVED", "DISMISSED"].includes(r.status)
                        ? "Closed"
                        : "Review"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        open={!!selected}
        title="Review report"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div>
            <div className="rounded-2xl bg-stone-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
                    Reported target
                  </p>
                  <h3 className="mt-1 text-lg font-extrabold">
                    {selected.target}
                  </h3>
                  <p className="text-sm text-stone-500">
                    {selected.type} · reported by {selected.reporter}
                  </p>
                </div>
                <Badge
                  tone={
                    selected.status === "RESOLVED"
                      ? "green"
                      : selected.status === "DISMISSED"
                        ? "gray"
                        : "amber"
                  }
                >
                  {selected.status.replaceAll("_", " ")}
                </Badge>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 rounded-2xl border p-4">
              <div>
                <dt className="text-xs font-bold uppercase text-stone-400">
                  Reason
                </dt>
                <dd className="mt-1 font-semibold">{selected.reason}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-stone-400">
                  Reported on
                </dt>
                <dd className="mt-1 font-semibold">{selected.date}</dd>
              </div>
            </dl>
            <label className="label mt-5">Moderation action</label>
            <select
              className="field"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="UNDER_REVIEW">Mark under review</option>
              <option value="RESOLVE">Resolve without penalty</option>
              <option value="DISMISS">Dismiss report</option>
              <option value="WARN">Warn reported user</option>
              <option value="SUSPEND">Suspend reported user</option>
              <option value="BAN">Ban reported user</option>
            </select>
            {action === "SUSPEND" && (
              <>
                <label className="label mt-5">
                  Suspension duration
                </label>
                <select
                  className="field"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  <option value="1 day">1 day</option>
                  <option value="3 days">3 days</option>
                  <option value="7 days">7 days</option>
                  <option value="30 days">30 days</option>
                  <option value="permanent">Permanent / lifetime</option>
                </select>
                <p className="mt-2 text-xs text-stone-500">
                  {duration === "permanent"
                    ? "This restriction will remain until an admin manually reactivates the account."
                    : `The account restriction will last for ${duration}.`}
                </p>
              </>
            )}
            <label className="label mt-5">Moderator note</label>
            <textarea
              className="field min-h-24"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Document the review outcome..."
            />
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button
                disabled={
                  mut.isPending ||
                  (["WARN", "SUSPEND", "BAN"].includes(action) &&
                    !note.trim())
                }
                onClick={applyAction}
              >
                {mut.isPending ? <Spinner /> : "Apply action"}
              </Button>
            </div>
            {mut.isError && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
                {mut.error.message}
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
