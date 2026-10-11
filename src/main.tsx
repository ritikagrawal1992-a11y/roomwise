import React, {
  useState,
  useEffect,
  type ReactNode,
  type FormEvent,
} from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Task = { id: number; title: string; status: string; priority: string };
type Product = {
  id: number;
  sku: string;
  name: string;
  quantity: number;
  threshold: number;
  low_stock: number;
};
type Movement = { id: number; name: string; note: string; delta: number };
type BookingRecord = {
  id: number;
  resource: string;
  guest: string;
  starts_at: string;
  ends_at: string;
};
type Expense = {
  id: number;
  label: string;
  payer: string;
  cents: number;
  participants: string[];
};
type Balance = { person: string; cents: number };
type Settlement = { from: string; to: string; cents: number };
type Inbox = { id: string; name: string; secret: string };
type CapturedEvent = {
  id: number;
  event_key: string;
  body: string;
  received_at: string;
};
type DocumentRecord = { id: number; title: string; body: string };
async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch("/api" + path, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}
function useLoad<T>(path: string, revision: number) {
  const [data, setData] = useState<T>(),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api" + path, { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [path, revision]);
  return { data, error };
}
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="notice" role="alert">
      {children}
    </p>
  );
}
function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = true,
  min,
  step,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  step?: string;
  children?: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children ? (
        <select aria-label={label} name={name} required={required}>
          {children}
        </select>
      ) : type === "textarea" ? (
        <textarea
          aria-label={label}
          name={name}
          placeholder={placeholder}
          required={required}
          rows={5}
        />
      ) : (
        <input
          aria-label={label}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          min={min}
          step={step}
        />
      )}
    </label>
  );
}
function Form({
  title,
  children,
  submit,
  onSubmit,
}: {
  title: string;
  children: ReactNode;
  submit: string;
  onSubmit: (f: FormData) => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState("");
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await onSubmit(new FormData(form));
      form.reset();
      setSuccess("Saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>{title}</h2>
      <form onSubmit={send}>
        {children}
        {error && <Notice>{error}</Notice>}
        <div className="form-footer">
          <button disabled={busy}>{busy ? "Saving…" : submit}</button>
          {success && <span role="status">{success}</span>}
        </div>
      </form>
    </section>
  );
}
type Props = { revision: number; refresh: () => void };
function Booking({ revision, refresh }: Props) {
  const { data, error } = useLoad<BookingRecord[]>("/bookings", revision),
    [actionError, setError] = useState("");
  return (
    <>
      <Form
        title="Reserve a shared space"
        submit="Create booking"
        onSubmit={async (f) => {
          await api("/bookings", "POST", {
            resource: f.get("resource"),
            guest: f.get("guest"),
            starts_at: new Date(String(f.get("start"))).toISOString(),
            ends_at: new Date(String(f.get("end"))).toISOString(),
          });
          refresh();
        }}
      >
        <div className="form-row">
          <Field label="Space" name="resource">
            <option>Meeting room A</option>
            <option>Meeting room B</option>
            <option>Recording studio</option>
          </Field>
          <Field label="Guest" name="guest" placeholder="Guest or team name" />
        </div>
        <div className="form-row">
          <Field
            label="Start (your local time)"
            name="start"
            type="datetime-local"
          />
          <Field
            label="End (your local time)"
            name="end"
            type="datetime-local"
          />
        </div>
        <p className="hint">
          Your time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.
          Adjacent bookings are allowed; overlapping reservations are rejected.
        </p>
      </Form>
      {(error || actionError) && <Notice>{error || actionError}</Notice>}
      <section className="panel">
        <h2>
          Reservations <span className="count">{data?.length ?? 0}</span>
        </h2>
        {!data?.length ? (
          <p className="hint">
            Choose a space and a time to create the first reservation.
          </p>
        ) : (
          data.map((b) => (
            <div className="row" key={b.id}>
              <div>
                <strong>{b.resource}</strong>
                <p>
                  {b.guest} · {new Date(b.starts_at).toLocaleString()} —{" "}
                  {new Date(b.ends_at).toLocaleString()}
                </p>
              </div>
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await api("/bookings/" + b.id, "DELETE");
                    setError("");
                    refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Cancel
              </button>
            </div>
          ))
        )}
      </section>
    </>
  );
}
function App(){
      const [revision,setRevision]=useState(0);
      return <div className="shell"><aside><a className="brand" href="#"><span className="brand-mark">R</span><span>Roomwise<small>OPEN SOURCE APPLICATION</small></span></a><p className="nav-label">SCHEDULING</p><div className="sidebar-note"><b>Built to explore.</b><p>React · TypeScript · Node.js<br/>SQLite · Playwright</p><span>v0.1 · Local demo</span></div></aside><main><div className="topline"><span>ROOMWISE / SCHEDULING</span><span className="local-tag">LOCAL DEMO</span></div><header><p className="eyebrow">OPEN SOURCE / SCHEDULING</p><h1>Roomwise</h1><p className="lead">Resource booking with overlap checks and UTC timestamps.</p></header><Booking revision={revision} refresh={()=>setRevision(v=>v+1)}/><footer>Roomwise · MIT licensed source · AI-assisted local demo</footer></main></div>;
    }
    createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
    