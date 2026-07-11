import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Lock,
  QrCode,
  RefreshCw,
  Send,
  Trash2,
  UserPlus
} from "lucide-react";
import clsx from "clsx";
import { CustomSelect } from "../components/CustomSelect";
import { SectionHeading, StatusPill } from "../components/Layout";
import { api } from "../lib/api";
import { toastError, toastSuccess } from "../lib/toast";
import type { Category, Event, EventRules, RegistrationPayload, RegistrationPayment, Team, TeamMember } from "../lib/types";

const steps = ["Data Tim", "Anggota", "Kategori", "Pembayaran", "Verifikasi"];

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
    paymentOrderId: "",
    otpCode: ""
  });
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState<RegistrationPayment | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentChecking, setPaymentChecking] = useState(false);
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
    const resetsPayment = key === "name" || key === "leaderEmail" || key === "leaderName";
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "leaderEmail" ? { otpCode: "" } : {}),
      ...(resetsPayment ? { paymentOrderId: "" } : {})
    }));
    if (resetsPayment) {
      setPayment(null);
    }
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

  function getStepError(stepIndex: number) {
    if (stepIndex === 0) {
      if (!form.name || !form.leaderName || !form.leaderEmail || !form.leaderPhone || !form.institution) {
        return "Data tim, ketua, email, WhatsApp, dan asal instansi wajib diisi.";
      }
      if (!isValidWhatsAppNumber(form.leaderPhone)) {
        return "Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx atau +628xxxxxxxxxx.";
      }
    }
    if (stepIndex === 1) {
      if (totalMembers < rules.minTeamMembers) {
        return `Minimal ${rules.minTeamMembers} peserta termasuk ketua wajib diisi.`;
      }
      const invalidMember = members.some((member) => member.name.trim() || member.email.trim() || member.role.trim()
        ? !member.name.trim() || !member.email.trim() || !member.role.trim()
        : false);
      if (invalidMember) {
        return "Setiap slot anggota yang diisi wajib lengkap: nama, email, dan peran.";
      }
      const duplicateEmail = findDuplicateParticipantEmail();
      if (duplicateEmail) {
        return `Email peserta tidak boleh duplikat: ${duplicateEmail}.`;
      }
    }
    if (stepIndex === 2 && (!form.categoryId || !form.batch)) {
      return "Batch dan kategori lomba wajib dipilih.";
    }
    if (stepIndex === 3 && (payment?.status !== "completed" || !form.paymentOrderId)) {
      return "Selesaikan pembayaran QRIS sebelum masuk ke tahap verifikasi.";
    }
    return "";
  }

  function canOpenStep(stepIndex: number) {
    if (stepIndex <= step) return true;
    for (let index = 0; index < stepIndex; index += 1) {
      if (getStepError(index)) return false;
    }
    return true;
  }

  function openStep(stepIndex: number) {
    if (stepIndex <= step) {
      setStep(stepIndex);
      return;
    }
    for (let index = 0; index < stepIndex; index += 1) {
      const message = getStepError(index);
      if (message) {
        showError(message);
        setStep(index);
        return;
      }
    }
    setStep(stepIndex);
  }

  function goNext() {
    setError("");
    const message = getStepError(step);
    if (message) {
      showError(message);
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function requestOTP() {
    setError("");
    setOtpMessage("");
    if (!form.leaderName || !form.leaderEmail) {
      showError("Nama dan email ketua wajib diisi sebelum meminta OTP.");
      return;
    }
    if (payment?.status !== "completed" || !form.paymentOrderId) {
      showError("Selesaikan pembayaran QRIS sebelum meminta OTP.");
      setStep(3);
      return;
    }
    setOtpSending(true);
    try {
      const response = await api.requestRegistrationOTP({
        eventId: form.eventId,
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

  async function createPayment() {
    setError("");
    for (let index = 0; index <= 2; index += 1) {
      const message = getStepError(index);
      if (message) {
        showError(message);
        setStep(index);
        return;
      }
    }
    setPaymentLoading(true);
    try {
      const response = await api.createRegistrationPayment({
        eventId: form.eventId,
        teamName: form.name,
        leaderName: form.leaderName,
        leaderEmail: form.leaderEmail
      });
      setPayment(response);
      setForm((current) => ({ ...current, paymentOrderId: response.orderId }));
      toastSuccess(response.status === "completed" ? "Pembayaran sudah terkonfirmasi." : "QRIS pembayaran berhasil dibuat.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal membuat QRIS pembayaran.");
    } finally {
      setPaymentLoading(false);
    }
  }

  async function checkPayment() {
    setError("");
    if (!payment?.orderId) {
      showError("Buat QRIS pembayaran terlebih dahulu.");
      return;
    }
    setPaymentChecking(true);
    try {
      const response = await api.checkRegistrationPayment({
        eventId: form.eventId,
        leaderEmail: form.leaderEmail,
        orderId: payment.orderId
      });
      setPayment(response);
      setForm((current) => ({ ...current, paymentOrderId: response.status === "completed" ? response.orderId : "" }));
      if (response.status === "completed") {
        toastSuccess("Pembayaran terkonfirmasi. Kamu bisa lanjut ke verifikasi OTP.");
      } else {
        toastError(`Pembayaran masih ${paymentStatusLabel(response.status).toLowerCase()}.`);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal mengecek status pembayaran.");
    } finally {
      setPaymentChecking(false);
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
    if (payment?.status !== "completed" || !form.paymentOrderId) {
      showError("Pembayaran QRIS wajib selesai sebelum pendaftaran dikirim.");
      setStep(3);
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
    const duplicateEmail = findDuplicateParticipantEmail();
    if (duplicateEmail) {
      showError(`Email peserta tidak boleh duplikat: ${duplicateEmail}.`);
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

  function findDuplicateParticipantEmail() {
    const emails = [form.leaderEmail, ...members.map((member) => member.email)]
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const seen = new Set<string>();
    for (const email of emails) {
      if (seen.has(email)) return email;
      seen.add(email);
    }
    return "";
  }

  if (createdTeam) {
    return (
      <section className="experience-page py-16 scroll-pop" data-scroll-pop>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-primary/20 bg-white p-8 text-center shadow-soft scroll-pop" data-scroll-pop>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-primary text-white">
              <Check size={28} />
            </span>
            <h1 className="mt-6 text-3xl font-black">Pendaftaran terkirim</h1>
            <p className="mt-3 text-dark/65">
              ID tim kamu adalah <span className="font-black text-dark">{createdTeam.id}</span>. Simpan ID ini untuk
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
    <section className="experience-page py-14 scroll-pop" data-scroll-pop>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Pendaftaran"
          title={`Daftar ${event?.name ?? "Point Project"}`}
          body="Isi data tim, anggota, kategori, pembayaran, lalu verifikasi email ketua sebelum data masuk ke dashboard panitia."
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <aside className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft scroll-pop" data-scroll-pop>
            <StatusPill tone="teal">Batch {form.batch}</StatusPill>
            <h2 className="mt-4 text-xl font-black">Progress Form</h2>
            <div className="mt-5 space-y-3">
              {steps.map((label, index) => {
                const accessible = canOpenStep(index);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => openStep(index)}
                    disabled={!accessible}
                    aria-disabled={!accessible}
                    className={clsx(
                      "flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-bold transition",
                      step === index && "bg-dark text-white",
                      step !== index && accessible && "bg-light text-dark/70 hover:bg-primary/10",
                      !accessible && "cursor-not-allowed bg-light text-dark/35"
                    )}
                  >
                    <span
                      className={clsx(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs",
                        step === index ? "bg-teal text-dark" : "bg-white text-dark",
                        !accessible && "text-dark/35"
                      )}
                    >
                      {accessible ? index + 1 : <Lock size={14} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <form onSubmit={submit} className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft sm:p-7 scroll-pop" data-scroll-pop>
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
                    <p className="mt-2 text-xs font-bold text-orange">Gunakan nomor Indonesia, contoh 081234567890.</p>
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
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
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
                  <div key={index} className="rounded-lg border border-dark/10 bg-light p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-black">Anggota {index + 2}</p>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-black text-red-600 transition hover:border-red-600 hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
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
                  <p className="text-sm font-bold text-dark/60">
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
                <div className="rounded-lg border border-dark/10 bg-light p-5 md:col-span-2">
                  <h3 className="font-black">{selectedCategory?.name}</h3>
                  <p className="mt-2 text-sm text-dark/65">{selectedCategory?.description}</p>
                  <ul className="mt-4 grid gap-2">
                    {selectedCategory?.requirements.map((item) => (
                      <li key={item} className="flex gap-2 text-sm text-dark/70">
                        <Check className="mt-0.5 text-primary" size={16} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-5">
                <div className="card border border-primary/15 bg-white p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-primary">
                        <CreditCard size={20} />
                        <h3 className="font-black">Pembayaran Pendaftaran</h3>
                      </div>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-dark/65">
                        Buat QRIS melalui Pakasir, lakukan pembayaran, lalu cek status. Tahap verifikasi OTP baru aktif
                        setelah pembayaran terkonfirmasi.
                      </p>
                    </div>
                    <StatusPill tone={paymentTone(payment?.status)}>
                      {payment ? paymentStatusLabel(payment.status) : "Belum dibuat"}
                    </StatusPill>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <ReadOnlyField label="Nama Tim" value={form.name || "-"} />
                    <ReadOnlyField label="Email Ketua" value={form.leaderEmail || "-"} />
                    <ReadOnlyField label="Order ID" value={payment?.orderId || "-"} />
                  </div>

                  {payment ? (
                    <div className="mt-5 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                      <div className="card border border-dark/10 bg-light p-4 text-center">
                        {payment.paymentNumber ? (
                          <img
                            src={qrImageUrl(payment.paymentNumber)}
                            alt={`QRIS pembayaran ${payment.orderId}`}
                            className="mx-auto h-56 w-56 bg-white p-3"
                          />
                        ) : (
                          <div className="mx-auto grid h-56 w-56 place-items-center bg-white text-dark/45">
                            <QrCode size={64} />
                          </div>
                        )}
                        <p className="mt-3 text-xs font-bold text-dark/55">Scan QRIS atau buka link Pakasir.</p>
                      </div>
                      <div className="card border border-dark/10 bg-light p-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <ReadOnlyField label="Nominal" value={formatCurrency(payment.amount)} />
                          <ReadOnlyField label="Total Bayar" value={formatCurrency(payment.totalPayment)} />
                          <ReadOnlyField label="Metode" value={payment.paymentMethod || "QRIS"} />
                          <ReadOnlyField label="Kedaluwarsa" value={formatDateTime(payment.expiredAt)} />
                        </div>
                        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                          {payment.paymentUrl ? (
                            <a className="btn-secondary" href={payment.paymentUrl} target="_blank" rel="noreferrer">
                              <ExternalLink size={18} />
                              Buka Pakasir
                            </a>
                          ) : null}
                          <button type="button" className="btn-primary" onClick={checkPayment} disabled={paymentChecking}>
                            <RefreshCw size={18} className={clsx(paymentChecking && "animate-spin")} />
                            {paymentChecking ? "Mengecek..." : "Cek Pembayaran"}
                          </button>
                        </div>
                        {payment.status !== "completed" ? (
                          <p className="mt-4 text-sm leading-6 text-dark/60">
                            Setelah membayar, tekan <span className="font-black text-dark">Cek Pembayaran</span> untuk
                            membuka tahap verifikasi.
                          </p>
                        ) : (
                          <p className="mt-4 text-sm font-bold text-primary">
                            Pembayaran sudah masuk. Silakan lanjut ke verifikasi email.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-md border border-dashed border-dark/20 bg-light p-5">
                      <p className="text-sm leading-6 text-dark/65">
                        QRIS akan dibuat untuk tim <span className="font-black text-dark">{form.name || "-"}</span>.
                        Pastikan data tim dan email ketua sudah benar karena pembayaran terikat ke data ini.
                      </p>
                      <button type="button" className="btn-primary mt-4" onClick={createPayment} disabled={paymentLoading}>
                        <QrCode size={18} />
                        {paymentLoading ? "Membuat QRIS..." : "Buat QRIS Pakasir"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="grid gap-5">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-black">Verifikasi Email Ketua</h3>
                      <p className="mt-1 text-sm leading-6 text-dark/65">
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

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-dark/10 pt-5 sm:flex-row sm:justify-between">
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

function paymentStatusLabel(status = "") {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return "Lunas";
  if (normalized === "expired") return "Kedaluwarsa";
  if (normalized === "failed") return "Gagal";
  if (normalized === "cancelled") return "Dibatalkan";
  return "Menunggu";
}

function paymentTone(status = ""): "teal" | "amber" | "orange" | "dark" {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return "teal";
  if (normalized === "expired" || normalized === "failed" || normalized === "cancelled") return "orange";
  return "amber";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function qrImageUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=2&data=${encodeURIComponent(value)}`;
}

function isValidWhatsAppNumber(value: string) {
  return Boolean(normalizeWhatsAppNumber(value));
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="rounded-md border border-dark/10 bg-white px-3 py-2.5 text-sm font-bold text-dark/70">{value}</p>
    </div>
  );
}
