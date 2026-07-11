import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, LogIn, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { toastError, toastSuccess } from "../lib/toast";
import type { ClaimAdminRedeemResponse } from "../lib/types";

const ADMIN_PATH = "/X7pQm2Kf9vLzR4tN8wYbC1hJ6sD3aG5e";

export function ClaimRedeemPage() {
  const { code = "" } = useParams();
  const [form, setForm] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClaimAdminRedeemResponse | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await api.claimAdminRedeem(code, form);
      setResult(response);
      toastSuccess(response.message);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Gagal claim kode redeem.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="experience-page grid min-h-[72vh] place-items-center px-4 py-16">
      <div className="w-full max-w-2xl">
        {result ? (
          <article className="card bg-white p-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center bg-primary text-white">
              <CheckCircle2 size={28} />
            </span>
            <h1 className="mt-5 text-3xl font-black">Akun Panitia Aktif</h1>
            <p className="mt-3 text-sm leading-6 text-dark/65">
              Login memakai email <span className="font-black text-dark">{result.user.email}</span>.
            </p>
            <div className="mx-auto mt-5 max-w-sm rounded-md border border-dark/10 bg-light px-4 py-3 text-left text-sm">
              <p className="font-bold text-dark/50">Password awal</p>
              <p className="mt-1 text-2xl font-black">{result.initialPassword}</p>
            </div>
            <p className="mt-4 text-xs font-bold text-dark/50">
              Simpan password awal ini, lalu minta Kadiv menggantinya jika diperlukan.
            </p>
            <Link className="btn-primary mx-auto mt-6" to={ADMIN_PATH}>
              <LogIn size={18} />
              Login Admin Panel
            </Link>
          </article>
        ) : (
          <form onSubmit={submit} className="card bg-white p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center bg-primary text-white">
                <ShieldCheck size={22} />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Claim Redeem</p>
                <h1 className="mt-2 text-3xl font-black">Aktivasi Akun Panitia</h1>
                <p className="mt-2 text-sm leading-6 text-dark/65">
                  Masukkan nama dan email ITERA. Format email wajib menggunakan domain
                  <span className="font-black text-dark"> @student.itera.ac.id</span>.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-4">
              <div className="rounded-md bg-light px-4 py-3 text-sm">
                <span className="font-bold text-dark/55">Kode:</span>{" "}
                <span className="font-black">{code || "-"}</span>
              </div>
              <div>
                <label className="label" htmlFor="claim-name">
                  Nama Lengkap
                </label>
                <input
                  id="claim-name"
                  className="field"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Nama panitia"
                />
              </div>
              <div>
                <label className="label" htmlFor="claim-email">
                  Email ITERA
                </label>
                <input
                  id="claim-email"
                  className="field"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="nama.nim@student.itera.ac.id"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button className="btn-primary" disabled={loading}>
                <ShieldCheck size={18} />
                {loading ? "Memproses..." : "Claim Akun"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
