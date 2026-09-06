import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import {
Store
} from "lucide-react";
import { useState } from "react";
import {
Badge,
Button,
Empty,
Loading,
Modal,
Spinner
} from "../../components/ui";
import {
adminService,
reactivationService
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

function tone(status: string) {
  return status === "COMPLETED" ||
    status === "DELIVERED" ||
    status === "ACTIVE" ||
    status === "APPROVED"
    ? "green"
    : status === "CANCELLED" || status === "BANNED" || status === "REJECTED"
      ? "red"
      : status === "FROZEN"
        ? "purple"
        : "amber";
}

export function Approvals() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: adminService.applications,
  });
  const { data: requests = [] } = useQuery({
    queryKey: ["reactivation-requests"],
    queryFn: reactivationService.list,
  });
  const [selected, setSelected] = useState<(typeof data)[number] | null>(null);
  const mut = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "APPROVED" | "REJECTED";
    }) => adminService.decide(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      setSelected(null);
    },
  });
  const decide = (id: string, status: "APPROVED" | "REJECTED") =>
    mut.mutate({ id, status });
  const requestMutation = useMutation({meta:{successMessage:"Reactivation request updated."},
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "APPROVED" | "REJECTED";
    }) => reactivationService.decide(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reactivation-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-sellers"] });
    },
  });
  return (
    <>
      <PageTitle
        title="Seller approvals"
        sub="Review the people and ideas joining the marketplace."
      />
      {isLoading ? (
        <Loading />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.map((a) => (
            <div className="card p-6" key={a.id}>
              <div className="flex justify-between">
                <div>
                  <Badge tone={tone(a.status)}>{a.status}</Badge>
                  <h2 className="mt-3 text-xl font-extrabold">{a.store}</h2>
                  <p className="text-sm text-stone-500">
                    by {a.user} · BRACU ID {a.bracuId}
                  </p>
                </div>
                <Store className="text-brand-600" size={34} />
              </div>
              <p className="mt-5 rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">
                {a.description}
              </p>
              <div className="mt-5">
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => setSelected(a)}
                >
                  View application
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <section className="mt-10">
        <h2 className="text-2xl font-extrabold">
          Account reactivation requests
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Frozen or suspended sellers must receive admin approval before selling
          again.
        </p>
        <div className="mt-5 space-y-3">
          {requests.length ? (
            requests.map((request) => (
              <div
                className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
                key={request.id}
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-extrabold">{request.user}</h3>
                    <Badge tone={tone(request.status)}>{request.status}</Badge>
                    <Badge tone="purple">{request.accountStatus}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-stone-500">
                    {request.role} · Requested {request.date}
                  </p>
                  <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm">
                    {request.reason}
                  </p>
                </div>
                {request.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        requestMutation.mutate({
                          id: request.id,
                          status: "REJECTED",
                        })
                      }
                    >
                      Reject
                    </Button>
                    <Button
                      onClick={() =>
                        requestMutation.mutate({
                          id: request.id,
                          status: "APPROVED",
                        })
                      }
                    >
                      Approve & reactivate
                    </Button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <Empty
              title="No reactivation requests"
              body="New requests from restricted sellers will appear here."
            />
          )}
        </div>
      </section>
      <Modal
        open={!!selected}
        title="Seller application"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div>
            <div className="flex items-start gap-4 rounded-2xl bg-brand-50 p-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
                <Store />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-extrabold">{selected.store}</h3>
                  <Badge tone={tone(selected.status)}>{selected.status}</Badge>
                </div>
                <p className="text-sm text-stone-500">
                  Application by {selected.user}
                </p>
              </div>
            </div>
            <dl className="mt-5 grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-stone-400">
                  Applicant
                </dt>
                <dd className="mt-1 font-semibold">{selected.user}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-stone-400">
                  BRACU ID
                </dt>
                <dd className="mt-1 font-semibold">{selected.bracuId}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-stone-400">
                  Phone
                </dt>
                <dd className="mt-1 font-semibold">{selected.phone}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-stone-400">
                  Submitted
                </dt>
                <dd className="mt-1 font-semibold">{selected.date}</dd>
              </div>
            </dl>
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
                About the seller
              </p>
              <p className="mt-2 rounded-2xl bg-stone-50 p-4 text-sm leading-6 text-stone-600">
                {selected.description}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Close
              </Button>
              {selected.status === "PENDING" && (
                <>
                  <Button
                    variant="secondary"
                    disabled={mut.isPending}
                    onClick={() => decide(selected.id, "REJECTED")}
                  >
                    Reject
                  </Button>
                  <Button
                    disabled={mut.isPending}
                    onClick={() => decide(selected.id, "APPROVED")}
                  >
                    {mut.isPending ? <Spinner /> : "Approve seller"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
