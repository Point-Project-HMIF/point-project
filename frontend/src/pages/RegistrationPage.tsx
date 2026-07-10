import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Send, Trash2, UserPlus } from "lucide-react";
import clsx from "clsx";
import { CustomSelect } from "../components/CustomSelect";
import { SectionHeading, StatusPill } from "../components/Layout";
import { api } from "../lib/api";
import { toastError, toastSuccess } from "../lib/toast";
import type { Category, Event, EventRules, RegistrationPayload, Team, TeamMember } from "../lib/types";

const steps = ["Data Tim", "Anggota", "Kategori", "Verifikasi"];

const emptyMember = (): TeamMember => ({ name: "", email: "", role: "" });
const maxAdditionalMembers = (rules: EventRules) => Math.max(rules.maxTeamMembers - 1, 0);
const initialAdditionalMembers = (rules: EventRules) =>
  Math.min(Math.max(rules.minTeamMembers - 1, 0), maxAdditionalMembers(rules));

export function RegistrationPage() {
  const [event, setEvent] = useState<Event | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<EventRules>({ eventId: "", minTeamMembers: 2, maxTeamMembers: 3 });
  const [step, setStep] = useState(0);
  const [members, setMembers] = useState<TeamMember[]>([emptyMember()]);
  const [form, setForm] = useState<RegistrationPayload>({
    eventId: "",
    categoryId: "",
    name: "",
    batch: 1,
    leaderName: "",
    leaderEmail: "",
    leaderPhone: "",
    institution: "",
    members: [],
    otpCode: ""
  });
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
  const [error, setError] = useState("");
  const [createdTeam, setCreatedTeam] = useState<Team | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .activeEvent()
      .then(async (active) => {
        const [nextCategories, nextRules] = await Promise.all([api.categories(active.id), api.rules(active.id)]);
        if (!alive) return;
        setEvent(active);
        setRules(nextRules);
        setCategories(nextCategories);
        setMembers(Array.from({ length: initialAdditionalMembers(nextRules) }, emptyMember));
        setForm((current) => ({
          ...current,
          eventId: active.id,
          categoryId: nextCategories[0]?.id ?? ""
        }));
      })
      .catch((err) => {
        if (!alive) return;
        showError(err instanceof Error ? err.message : "Gagal memuat data event dari server.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === form.categoryId) ?? categories[0],
    [categories, form.categoryId]
  );
  const filledMembers = useMemo(() => members.filter((member) => member.name.trim() !== ""), [members]);
  const totalMembers = 1 + filledMembers.length;
  const additionalMemberLimit = maxAdditionalMembers(rules);
  const canAddMember = members.length < additionalMemberLimit;

  function updateField<K extends keyof RegistrationPayload>(key: K, value: RegistrationPayload[K]) {
    setForm((current) => ({ ...current, [key]: value, ...(key === "leaderEmail" ? { otpCode: "" } : {}) }));
    if (key === "leaderEmail") {
      setOtpMessage("");
    }
  }

  function updateMember(index: number, key: keyof TeamMember, value: string) {
    setMembers((current) =>
      current.map((member, memberIndex) => (memberIndex === index ? { ...member, [key]: value } : member))
    );
  }

  function removeMember(index: number) {
    setMembers((current) => current.filter((_, memberIndex) => memberIndex !== index));
  }

  function addMember() {
    setMembers((current) => (current.length >= additionalMemberLimit ? current : [...current, emptyMember()]));
  }

  function showError(message: string) {
    setError(message);
    toastError(message);
  }

  function goNext() {
    setError("");
    if (step === 0) {
      if (!form.name || !form.leaderName || !form.leaderEmail || !form.leaderPhone || !form.institution) {
        showError("Data tim, ketua, email, WhatsApp, dan asal instansi wajib diisi.");
        return;
      }
      if (!isValidWhatsAppNumber(form.leaderPhone)) {
        showError("Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx atau +628xxxxxxxxxx.");
        return;
      }
    }
    if (step === 1) {
      if (totalMembers < rules.minTeamMembers) {
        showError(`Minimal ${rules.minTeamMembers} peserta termasuk ketua wajib diisi.`);
        return;
      }
      const invalidMember = members.some((member) => member.name.trim() || member.email.trim() || member.role.trim()
        ? !member.name.trim() || !member.email.trim() || !member.role.trim()
        : false);
      if (invalidMember) {
        showError("Setiap slot anggota yang diisi wajib lengkap: nama, email, dan peran.");
        return;
      }
    }
    if (step === 2 && (!form.categoryId || !form.batch)) {
      showError("Batch dan kategori lomba wajib dipilih.");
      return;
    }
    setStep((current) => current + 1);
  }

  async function requestOTP() {
    setError("");
    setOtpMessage("");
    if (!form.leaderName || !form.leaderEmail) {
      showError("Nama dan email ketua wajib diisi sebelum meminta OTP.");
      return;
    }
    setOtpSending(true);
    try {
      const response = await api.requestRegistrationOTP({
        leaderName: form.leaderName,
        leaderEmail: form.leaderEmail
      });
      setOtpMessage(response.message);
      toastSuccess(response.message);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal mengirim OTP.");
    } finally {
      setOtpSending(false);
    }
  }

  async function submit(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    setError("");
    if (!form.eventId || !form.categoryId || !form.name || !form.leaderName || !form.leaderEmail || !form.leaderPhone || !form.institution) {
      showError("Event, kategori, data tim, ketua, email, WhatsApp, dan asal instansi wajib diisi.");
      return;
    }
    const normalizedPhone = normalizeWhatsAppNumber(form.leaderPhone);
    if (!normalizedPhone) {
      showError("Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx atau +628xxxxxxxxxx.");
      return;
    }
    if (!/^\d{6}$/.test(form.otpCode.trim())) {
      showError("Masukkan kode OTP yang dikirim ke email ketua.");
      return;
    }
    if (totalMembers < rules.minTeamMembers || totalMembers > rules.maxTeamMembers) {
      showError(`Jumlah peserta harus ${rules.minTeamMembers}-${rules.maxTeamMembers} orang termasuk ketua.`);
      return;
    }
    setLoading(true);
    try {
      const team = await api.register({
        ...form,
        leaderPhone: normalizedPhone,
        otpCode: form.otpCode.trim(),
        members: filledMembers
      });
      localStorage.setItem("pointproject.teamId", team.id);
      toastSuccess("Pendaftaran berhasil terkirim. Simpan ID tim untuk membuka dashboard peserta.");
      setCreatedTeam(team);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Pendaftaran gagal dikirim.");
    } finally {
      setLoading(false);
    }
  }

  if (createdTeam) {
    return (
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-lagoon/20 bg-white p-8 text-center shadow-soft">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-lagoon text-white">
              <Check size={28} />
            </span>
            <h1 className="mt-6 text-3xl font-black">Pendaftaran terkirim</h1>
            <p className="mt-3 text-ink/65">
              ID tim kamu adalah <span className="font-black text-ink">{createdTeam.id}</span>. Simpan ID ini untuk
              membuka dashboard peserta.
            </p>
            <div className="mt-6 flex justify-center">
              <a href="/dashboard" className="btn-primary">
                Buka Dashboard
                <ChevronRight size={18} />
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Pendaftaran"
          title={`Daftar ${event?.name ?? "Point Project"}`}
          body="Isi data tim, anggota, kategori, dan tautan karya awal. Panitia akan memverifikasi data melalui dashboard admin."
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <aside className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <StatusPill tone="teal">Batch {form.batch}</StatusPill>
            <h2 className="mt-4 text-xl font-black">Progress Form</h2>
            <div className="mt-5 space-y-3">
              {steps.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(index)}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-bold transition",
                    step === index ? "bg-ink text-white" : "bg-cloud text-ink/70 hover:bg-lagoon/10"
                  )}
                >
                  <span
                    className={clsx(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs",
                      step === index ? "bg-mint text-ink" : "bg-white text-ink"
                    )}
                  >
                    {index + 1}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </aside>

          <form onSubmit={submit} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-7">
            {step === 0 ? (
              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="label" htmlFor="team-name">
                    Nama Tim
                  </label>
                  <input
                    id="team-name"
                    className="field"
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    placeholder="Nama tim"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="leader-name">
                    Nama Ketua
                  </label>
                  <input
                    id="leader-name"
                    className="field"
                    value={form.leaderName}
                    onChange={(event) => updateField("leaderName", event.target.value)}
                    placeholder="Nama lengkap ketua"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="leader-email">
                    Email Ketua
                  </label>
                  <input
                    id="leader-email"
                    className="field"
                    type="email"
                    value={form.leaderEmail}
                    onChange={(event) => updateField("leaderEmail", event.target.value)}
                    placeholder="nama@email.com"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="leader-phone">
                    Nomor WhatsApp
                  </label>
                  <input
                    id="leader-phone"
                    className="field"
                    type="tel"
                    value={form.leaderPhone}
                    onChange={(event) => updateField("leaderPhone", event.target.value)}
                    placeholder="08xxxxxxxxxx atau +628xxxxxxxxxx"
                  />
                  {form.leaderPhone && !isValidWhatsAppNumber(form.leaderPhone) ? (
                    <p className="mt-2 text-xs font-bold text-coral">Gunakan nomor Indonesia, contoh 081234567890.</p>
                  ) : null}
                </div>
                <div>
                  <label className="label" htmlFor="institution">
                    Asal Sekolah/Kampus
                  </label>
                  <input
                    id="institution"
                    className="field"
                    value={form.institution}
                    onChange={(event) => updateField("institution", event.target.value)}
                    placeholder="Institut Teknologi Sumatera"
                  />
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <div className="rounded-lg border border-lagoon/20 bg-lagoon/5 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-black">Anggota 1 - Ketua</p>
                    <StatusPill tone="teal">Wajib</StatusPill>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <ReadOnlyField label="Nama Ketua" value={form.leaderName || "-"} />
                    <ReadOnlyField label="Email Ketua" value={form.leaderEmail || "-"} />
                    <ReadOnlyField label="Peran" value="Ketua" />
                  </div>
                </div>
                {members.map((member, index) => (
                  <div key={index} className="rounded-lg border border-ink/10 bg-cloud p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-black">Anggota {index + 2}</p>
                      <button
                        type="button"
                        className="btn-secondary px-3 py-2"
                        onClick={() => removeMember(index)}
                        aria-label={`Hapus anggota ${index + 2}`}
                      >
                        <Trash2 size={16} />
                        Hapus
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="label" htmlFor={`member-name-${index}`}>
                        Nama Anggota {index + 2}
                      </label>
                      <input
                        id={`member-name-${index}`}
                        className="field"
                        value={member.name}
                        onChange={(event) => updateMember(index, "name", event.target.value)}
                        placeholder="Nama lengkap"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor={`member-email-${index}`}>
                        Email
                      </label>
                      <input
                        id={`member-email-${index}`}
                        className="field"
                        type="email"
                        value={member.email}
                        onChange={(event) => updateMember(index, "email", event.target.value)}
                        placeholder="anggota@email.com"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor={`member-role-${index}`}>
                        Peran
                      </label>
                      <input
                        id={`member-role-${index}`}
                        className="field"
                        value={member.role}
                        onChange={(event) => updateMember(index, "role", event.target.value)}
                        placeholder="UI Designer"
                      />
                    </div>
                    </div>
                  </div>
                ))}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-bold text-ink/60">
                    Terisi {totalMembers} dari maksimal {rules.maxTeamMembers} peserta. Slot anggota {members.length}/{additionalMemberLimit}.
                  </p>
                  <button type="button" className="btn-secondary" disabled={!canAddMember} onClick={addMember}>
                    <UserPlus size={18} />
                    Tambah Anggota
                  </button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="batch">
                    Batch Pendaftaran
                  </label>
                  <CustomSelect
                    id="batch"
                    value={String(form.batch)}
                    onChange={(value) => updateField("batch", Number(value))}
                    options={[
                      { value: "1", label: "Batch 1" },
                      { value: "2", label: "Batch 2" }
                    ]}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="category">
                    Kategori Lomba
                  </label>
                  <CustomSelect
                    id="category"
                    value={form.categoryId}
                    onChange={(value) => updateField("categoryId", value)}
                    placeholder="Pilih kategori lomba"
                    options={categories.map((category) => ({
                      value: category.id,
                      label: category.name,
                      description: category.description
                    }))}
                    disabled={!categories.length}
                  />
                </div>
                <div className="rounded-lg border border-ink/10 bg-cloud p-5 md:col-span-2">
                  <h3 className="font-black">{selectedCategory?.name}</h3>
                  <p className="mt-2 text-sm text-ink/65">{selectedCategory?.description}</p>
                  <ul className="mt-4 grid gap-2">
                    {selectedCategory?.requirements.map((item) => (
                      <li key={item} className="flex gap-2 text-sm text-ink/70">
                        <Check className="mt-0.5 text-lagoon" size={16} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-5">
                <div className="rounded-lg border border-lagoon/20 bg-lagoon/5 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-black">Verifikasi Email Ketua</h3>
                      <p className="mt-1 text-sm leading-6 text-ink/65">
                        Kode OTP akan dikirim ke {form.leaderEmail || "email ketua"} dan berlaku 10 menit.
                      </p>
                    </div>
                    <button type="button" className="btn-secondary shrink-0" onClick={requestOTP} disabled={otpSending || loading}>
                      {otpSending ? "Mengirim..." : "Kirim OTP"}
                    </button>
                  </div>
                  <div className="mt-4 max-w-xs">
                    <label className="label" htmlFor="otp-code">
                      Kode OTP
                    </label>
                    <input
                      id="otp-code"
                      className="field text-center text-lg font-black tracking-[0.4em]"
                      inputMode="numeric"
                      maxLength={6}
                      value={form.otpCode}
                      onChange={(event) => updateField("otpCode", event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:justify-between">
              <button type="button" className="btn-secondary" disabled={step === 0} onClick={() => setStep((current) => current - 1)}>
                <ChevronLeft size={18} />
                Kembali
              </button>
              {step < steps.length - 1 ? (
                <button type="button" className="btn-primary" onClick={goNext}>
                  Lanjut
                  <ChevronRight size={18} />
                </button>
              ) : (
                <button type="submit" className="btn-primary" disabled={loading}>
                  <Send size={18} />
                  {loading ? "Mengirim..." : "Kirim Pendaftaran"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function normalizeWhatsAppNumber(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/[^0-9+\s().-]/.test(raw)) return "";
  const digits = raw.replace(/\D/g, "");
  const normalized = digits.startsWith("08")
    ? `+62${digits.slice(1)}`
    : digits.startsWith("628")
      ? `+${digits}`
      : "";
  return /^\+628[0-9]{8,11}$/.test(normalized) ? normalized : "";
}

function isValidWhatsAppNumber(value: string) {
  return Boolean(normalizeWhatsAppNumber(value));
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="rounded-md border border-ink/10 bg-white px-3 py-2.5 text-sm font-bold text-ink/70">{value}</p>
    </div>
  );
}
