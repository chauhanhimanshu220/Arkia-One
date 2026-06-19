import React, { useState, useEffect, useRef } from "react";

export type PlanType = "starter" | "professional" | "enterprise";
export type BillingCycle = "monthly" | "annual";

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlan: PlanType;
  initialSeats: number;
  initialBilling: BillingCycle;
  isDark: boolean;
  onLogin?: (email: string, password: string) => Promise<any>;
}

export const WizardThemeContext = React.createContext<{ isDark: boolean }>({ isDark: false });

interface FormData {
  plan: PlanType; billing: BillingCycle; seats: number; modules: string[];
  companyName: string; legalName: string; businessEmail: string; businessPhone: string;
  website: string; companySize: string; industry: string; gstNumber: string;
  workspaceName: string; timezone: string; currency: string; dateFormat: string;
  language: string; workspaceAvailable: boolean | null;
  ownerName: string; ownerEmail: string; password: string; confirmPassword: string;
  phone: string; otpSent: boolean; otpVerified: boolean; otp: string;
  enable2FA: boolean; agreedToTerms: boolean;
  enabledModules: string[]; employeeCount: string; workModel: string; approvalStructure: string;
  couponCode: string; couponApplied: boolean;
  paymentMethod: string; cardNumber: string; cardExpiry: string; cardCVV: string;
  cardName: string; upiId: string;
}

const PLAN_DETAILS = {
  starter: { name: "Starter", monthlyPerUser: 30, annualPerUser: 24, features: ["Daily & weekly timesheets", "Basic leave management", "Single-level approvals", "Employee dashboard", "Standard reports"] },
  professional: { name: "Professional", monthlyPerUser: 75, annualPerUser: 60, features: ["Multi-level approvals", "Advanced leave workflows", "Team management", "Payroll processing", "Finance reports", "Real-time chat"] },
  enterprise: { name: "Enterprise", monthlyPerUser: 0, annualPerUser: 0, features: [] },
};

const STEPS = [
  { id: 1, label: "Plan", sub: "Subscription" },
  { id: 2, label: "Company", sub: "Identity" },
  { id: 3, label: "Workspace", sub: "Environment" },
  { id: 4, label: "Licence Owner", sub: "Account" },
  { id: 5, label: "Billing", sub: "Review" },
  { id: 6, label: "Payment", sub: "Checkout" },
];

const INITIAL: FormData = {
  plan: "starter", billing: "annual", seats: 10, modules: [],
  companyName: "", legalName: "", businessEmail: "", businessPhone: "",
  website: "", companySize: "", industry: "", gstNumber: "",
  workspaceName: "", timezone: "Asia/Kolkata", currency: "INR",
  dateFormat: "DD/MM/YYYY", language: "English", workspaceAvailable: null,
  ownerName: "", ownerEmail: "", password: "", confirmPassword: "",
  phone: "", otpSent: false, otpVerified: false, otp: "", enable2FA: false, agreedToTerms: false,
  enabledModules: ["Timesheets", "Attendance", "Leave Management"],
  employeeCount: "", workModel: "Hybrid", approvalStructure: "Multi-Level",
  couponCode: "", couponApplied: false,
  paymentMethod: "card", cardNumber: "", cardExpiry: "", cardCVV: "", cardName: "", upiId: "",
};

export const WorkspaceSetupWizard: React.FC<WizardProps> = ({ isOpen, onClose, initialPlan, initialSeats, initialBilling, isDark, onLogin }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({ ...INITIAL, plan: initialPlan, seats: initialSeats, billing: initialBilling });
  const [visible, setVisible] = useState(false);
  const [provStep, setProvStep] = useState(0);
  const [wsTimer, setWsTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleCompletePayment = async () => {
    if (!form.agreedToTerms) {
      alert("Please agree to the Terms of Service and Privacy Policy on Step 4 (Owner Setup).");
      setStep(4);
      return;
    }

    if (form.seats < 10) {
      alert("Minimum 10 users required.");
      setStep(1);
      return;
    }

    if (!form.companyName || !form.workspaceName || !form.ownerEmail || !form.password) {
      alert("Please ensure all required fields are filled out in the previous steps.");
      return;
    }

    setIsSubmitting(true);
    setPaymentError(null);

    try {
      const res = await fetch("/api/Onboarding/provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan: form.plan,
          billing: form.billing,
          seats: form.seats,
          companyName: form.companyName,
          workspaceName: form.workspaceName,
          ownerName: form.ownerName,
          ownerEmail: form.ownerEmail,
          password: form.password,
          paymentMethod: form.paymentMethod,
        }),
      });

      if (!res.ok) {
        let errorMessage = "Failed to provision workspace.";
        try {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            errorMessage = data.message || data.error || errorMessage;
            if (data.details) {
              console.error("[Provision Details]", data.details);
            }
          } catch {
            const cleanedText = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
            errorMessage = cleanedText.length > 300 ? cleanedText.substring(0, 300) + "..." : (cleanedText || `Status Code: ${res.status}`);
          }
        } catch {
          errorMessage = `HTTP Error ${res.status}`;
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();

      localStorage.setItem("provisioned_owner_email", form.ownerEmail);
      localStorage.setItem("provisioned_owner_password", form.password);

      setStep(7);
    } catch (err: any) {
      setPaymentError(err.message || "Something went wrong.");
      alert("Provisioning Error: " + (err.message || "Something went wrong."));
    } finally {
      setIsSubmitting(false);
    }
  };
  const scroll = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1); setProvStep(0);
      setForm({ ...INITIAL, plan: initialPlan, seats: Math.max(initialSeats, 10), billing: initialBilling });
      setTimeout(() => setVisible(true), 20);
    } else { setVisible(false); }
  }, [isOpen, initialPlan, initialSeats, initialBilling]);

  useEffect(() => {
    if (!form.workspaceName || form.workspaceName.length < 3) { upd({ workspaceAvailable: null }); return; }
    if (wsTimer) clearTimeout(wsTimer);
    upd({ workspaceAvailable: null });
    const t = setTimeout(() => setForm(f => ({ ...f, workspaceAvailable: !f.workspaceName.includes("taken") })), 900);
    setWsTimer(t);
  }, [form.workspaceName]);

  const handleLaunchConsole = async () => {
    const email = localStorage.getItem("provisioned_owner_email") || form.ownerEmail;
    const pwd = localStorage.getItem("provisioned_owner_password") || form.password;
    if (onLogin) {
      try {
        await onLogin(email, pwd);
      } catch (err) {
        console.error("Auto-login failed:", err);
        alert("Auto-login failed. Redirecting to login page to authenticate manually.");
      }
    }
    localStorage.removeItem("provisioned_owner_email");
    localStorage.removeItem("provisioned_owner_password");
    onClose();
  };

  useEffect(() => {
    if (step !== 7) return;
    setProvStep(0);
    let i = 0;
    const iv = setInterval(() => {
      i++; setProvStep(i);
      if (i >= 7) {
        clearInterval(iv);
        setTimeout(() => {
          handleLaunchConsole();
        }, 900);
      }
    }, 650);
    return () => clearInterval(iv);
  }, [step]);

  const upd = (p: Partial<FormData>) => setForm(f => ({ ...f, ...p }));
  const goTo = (n: number) => { setStep(n); scroll.current?.scrollTo({ top: 0, behavior: "smooth" }); };
  const next = () => step < 8 && goTo(step + 1);
  const back = () => step > 1 && goTo(step - 1);

  const price = () => {
    if (form.plan === "enterprise") return null;
    return (form.billing === "annual" ? PLAN_DETAILS[form.plan].annualPerUser : PLAN_DETAILS[form.plan].monthlyPerUser) * form.seats;
  };
  const tax = () => { const p = price(); return p ? Math.round(p * 0.18) : 0; };
  const total = () => { const p = price(); return p ? p + tax() : 0; };

  if (!isOpen) return null;

  return (
    <WizardThemeContext.Provider value={{ isDark }}>
      <div
        className={`fixed inset-0 z-[300] flex items-center justify-center transition-all duration-700 ease-out ${visible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{ backdropFilter: "blur(24px) saturate(180%)", backgroundColor: isDark ? "rgba(0,0,0,0.75)" : "rgba(15,23,42,0.3)" }}
      >
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full" style={{ background: isDark ? "radial-gradient(circle, #6366f1 0%, transparent 70%)" : "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", opacity: isDark ? 0.2 : 0.6, animation: "pulse 8s ease-in-out infinite" }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full" style={{ background: isDark ? "radial-gradient(circle, #8b5cf6 0%, transparent 70%)" : "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)", opacity: isDark ? 0.15 : 0.5, animation: "pulse 10s ease-in-out infinite 2s" }} />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full" style={{ background: isDark ? "radial-gradient(circle, #10b981 0%, transparent 70%)" : "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)", opacity: isDark ? 0.1 : 0.4, animation: "pulse 12s ease-in-out infinite 4s" }} />
      </div>

      {/* Modal */}
      <div
        className={`relative flex w-full max-w-[1080px] mx-4 rounded-[28px] overflow-hidden border transition-all duration-700 ease-out ${visible ? "scale-100 translate-y-0 opacity-100" : "scale-[0.92] translate-y-12 opacity-0"}`}
        style={{
          maxHeight: "92vh",
          background: isDark ? "linear-gradient(145deg, #09090e 0%, #0e0e16 40%, #0a0a12 100%)" : "linear-gradient(145deg, #ffffff 0%, #fafafa 40%, #f4f4f7 100%)",
          borderColor: isDark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.15)",
          boxShadow: isDark 
            ? "0 0 0 1px rgba(99,102,241,0.1), 0 50px 140px -20px rgba(0,0,0,0.95), 0 0 80px -20px rgba(99,102,241,0.15)"
            : "0 0 0 1px rgba(99,102,241,0.05), 0 30px 90px -20px rgba(15,23,42,0.08), 0 0 50px -20px rgba(99,102,241,0.06)",
        }}
      >
        {/* Noise texture overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025] z-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "128px" }} />

        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px z-20" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.6) 30%, rgba(139,92,246,0.8) 50%, rgba(99,102,241,0.6) 70%, transparent 100%)" }} />

        {/* ── LEFT SIDEBAR ── */}
        <aside className="hidden lg:flex flex-col w-72 flex-shrink-0 relative" style={{ borderRight: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.06)", background: isDark ? "linear-gradient(180deg, rgba(99,102,241,0.03) 0%, transparent 100%)" : "linear-gradient(180deg, rgba(99,102,241,0.01) 0%, transparent 100%)" }}>
          {/* Sidebar inner glow */}
          <div className="absolute top-0 left-0 right-0 h-64 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%)" }} />

          <div className="relative z-10 flex flex-col h-full px-7 py-8">
            {/* Brand */}
            <div className="flex items-center gap-3 mb-12">
              <div className="relative">
                <div className="h-9 w-9 rounded-2xl flex items-center justify-center font-black text-white text-sm" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}>A</div>
                <div className="absolute -inset-1 rounded-2xl opacity-40 blur-md" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }} />
              </div>
              <div>
                <p className={`font-mono text-xs font-black tracking-widest ${isDark ? "text-white" : "text-zinc-900"}`}>ARKIA</p>
                <p className="font-mono text-[9px] text-zinc-500 tracking-widest">WORKSPACE SETUP</p>
              </div>
            </div>

            {/* Step spine */}
            {step < 8 && (
              <nav className="flex flex-col flex-1 relative gap-1">

                {STEPS.map((s) => {
                  const done = step > s.id;
                  const active = step === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => done ? goTo(s.id) : undefined}
                      className={`relative flex items-center gap-4 py-3 px-3 rounded-2xl transition-all duration-300 ${
                        done 
                          ? "cursor-pointer hover:bg-zinc-100/40 dark:hover:bg-white/[0.02]" 
                          : ""
                      } ${
                        active 
                          ? "bg-indigo-500/[0.04] dark:bg-indigo-500/[0.03] border border-indigo-500/10 dark:border-indigo-500/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-none" 
                          : "border border-transparent"
                      }`}
                    >
                      {/* Circle */}
                      <div className="relative flex-shrink-0 z-10">
                        {active && (
                          <div
                            className="absolute -inset-2 rounded-full animate-pulse opacity-25"
                            style={{
                              background: "radial-gradient(circle, #6366f1 0%, transparent 70%)",
                            }}
                          />
                        )}
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-500"
                          style={{
                            background: active
                              ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                              : done
                                ? (isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.06)")
                                : (isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)"),
                            border: active
                              ? "1px solid rgba(99,102,241,0.25)"
                              : done
                                ? (isDark ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(16,185,129,0.2)")
                                : (isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)"),
                            boxShadow: active
                              ? "0 0 16px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.2)"
                              : "none",
                            color: active
                              ? "#ffffff"
                              : done
                                ? (isDark ? "#10b981" : "#059669")
                                : (isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.4)"),
                          }}
                        >
                          {done ? "✓" : s.id}
                        </div>
                      </div>
                      {/* Label */}
                      <div className="flex flex-col min-w-0">
                        <p
                          className={`font-sans text-xs font-bold tracking-tight transition-all duration-300 ${
                            active 
                              ? (isDark ? "text-white" : "text-zinc-950") 
                              : done 
                                ? (isDark ? "text-zinc-350" : "text-zinc-700") 
                                : (isDark ? "text-zinc-550" : "text-zinc-400")
                          }`}
                        >
                          {s.label}
                        </p>
                        <p
                          className={`font-mono text-[9px] uppercase tracking-widest mt-0.5 transition-all duration-300 ${
                            active 
                              ? (isDark ? "text-indigo-400" : "text-indigo-650 font-bold") 
                              : done 
                                ? "text-emerald-500" 
                                : (isDark ? "text-zinc-650" : "text-zinc-450")
                          }`}
                        >
                          {s.sub}
                        </p>
                      </div>
                      {active && (
                        <div
                          className="ml-auto w-1 h-5 rounded-full"
                          style={{
                            background: "linear-gradient(180deg, #6366f1, #8b5cf6)",
                            boxShadow: "0 0 8px rgba(99,102,241,0.6)",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </nav>
            )}
            {step >= 7 && (
              <div className="flex items-center gap-4 py-3 px-3">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{
                    background: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.06)",
                    border: isDark ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(16,185,129,0.2)",
                  }}
                >
                  <span className="text-emerald-500 text-xs">✓</span>
                </div>
                <div>
                  <p className="font-sans text-xs font-bold text-emerald-500">Provisioning</p>
                  <p className="font-mono text-[9px] text-zinc-550 dark:text-zinc-450 uppercase tracking-wider">Workspace</p>
                </div>
              </div>
            )}

            {/* Plan pill */}
            {step < 7 && price() !== null && (
              <div className="mt-auto pt-6" style={{ borderTop: isDark ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(0,0,0,0.06)" }}>
                <div className="rounded-2xl p-4" style={{ background: isDark ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.04)", border: isDark ? "1px solid rgba(99,102,241,0.12)" : "1px solid rgba(99,102,241,0.08)" }}>
                  <p className="font-mono text-[9px] text-zinc-550 dark:text-zinc-450 uppercase tracking-[0.2em] mb-1">Configured Plan</p>
                  <p className={`font-mono text-sm font-black ${isDark ? "text-white" : "text-zinc-900"}`}>{PLAN_DETAILS[form.plan].name}</p>
                  <p className="font-mono text-xs mt-1" style={{ color: "#818cf8" }}>₹{total().toLocaleString("en-IN")} <span className="text-zinc-500">/{form.billing === "annual" ? "yr" : "mo"}</span></p>
                  <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${((step - 1) / 5) * 100}%`, background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }} />
                  </div>
                  <p className="font-mono text-[9px] text-zinc-550 dark:text-zinc-450 mt-1.5">{step}/6 steps completed</p>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <div className="flex flex-col flex-1 min-w-0 relative z-10">
          {/* Top bar */}
          <div className="flex items-center justify-between px-7 py-4 flex-shrink-0" style={{ borderBottom: isDark ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(0,0,0,0.06)", background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.005)" }}>
            <div className="flex items-center gap-4 flex-1">
              {/* Mobile step label */}
              <div className="lg:hidden">
                <p className="font-mono text-[10px] text-zinc-550 dark:text-zinc-450 uppercase tracking-widest">{step < 7 ? `Step ${step} of 6` : "Provisioning"}</p>
              </div>
              {/* Progress bar */}
              <div className="hidden lg:flex items-center gap-3 flex-1">
                <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${((Math.min(step, 6) - 1) / 5) * 100}%`, background: "linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1)", backgroundSize: "200%", animation: "shimmer 3s linear infinite" }}
                  />
                </div>
                <span className="font-mono text-[10px] text-zinc-550 dark:text-zinc-450 flex-shrink-0 w-14 text-right">{step < 7 ? `${Math.round(((step-1)/5)*100)}%` : "DONE"}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="ml-4 h-8 w-8 rounded-xl flex items-center justify-center text-zinc-500 transition-all duration-200 hover:text-zinc-950 dark:hover:text-white flex-shrink-0"
              style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)" }}
            >✕</button>
          </div>

          {/* Scrollable area */}
          <div ref={scroll} className="flex-1 overflow-y-auto overscroll-contain">

            {/* ── STEP 1 — Plan Configuration ── */}
            {step === 1 && (
              <StepWrap title="Plan Configuration" sub="Select your subscription and configure workspace capacity.">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {(["starter", "professional"] as PlanType[]).map(p => {
                    const sel = form.plan === p;
                    return (
                      <button key={p} onClick={() => upd({ plan: p })} className="relative rounded-2xl p-5 text-left transition-all duration-300 group overflow-hidden" style={{ background: sel ? "rgba(99,102,241,0.08)" : (isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)"), border: sel ? "1px solid rgba(99,102,241,0.4)" : (isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)"), boxShadow: sel ? "0 0 30px rgba(99,102,241,0.1), inset 0 1px 0 rgba(99,102,241,0.2)" : "none" }}>
                        {sel && <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.8), transparent)" }} />}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "radial-gradient(circle at 50% 0%, rgba(99,102,241,0.05) 0%, transparent 70%)" }} />
                        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-2">{p}</p>
                        <p className={`font-mono text-lg font-black ${isDark ? "text-white" : "text-zinc-900"} mb-1`}>{PLAN_DETAILS[p].name}</p>
                        <p className="font-mono text-xs mb-4" style={{ color: "#818cf8" }}>₹{PLAN_DETAILS[p].monthlyPerUser}<span className="text-zinc-500">/user/mo</span></p>
                        <div className="space-y-1.5">
                          {PLAN_DETAILS[p].features.slice(0, 3).map(f => (
                            <div key={f} className="flex items-center gap-2">
                              <div className="h-3.5 w-3.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: sel ? "rgba(16,185,129,0.2)" : (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"), border: sel ? "1px solid rgba(16,185,129,0.3)" : (isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)") }}>
                                <span className="text-[7px]" style={{ color: sel ? "#10b981" : (isDark ? "#3f3f46" : "#a1a1aa") }}>✓</span>
                              </div>
                              <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400">{f}</span>
                            </div>
                          ))}
                        </div>
                        {sel && <div className="absolute top-4 right-4 h-5 w-5 rounded-full flex items-center justify-center" style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)" }}><span className="text-[8px] text-indigo-400">✓</span></div>}
                      </button>
                    );
                  })}
                </div>

                {/* Billing toggle */}
                <div className="flex items-center justify-center gap-5 mb-6 py-4 px-6 rounded-2xl" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)", border: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.06)" }}>
                  <button onClick={() => upd({ billing: "monthly" })} className={`font-mono text-xs font-bold tracking-widest transition-all duration-200 ${form.billing === "monthly" ? (isDark ? "text-white" : "text-zinc-900") : "text-zinc-400 dark:text-zinc-550 hover:text-zinc-600"}`}>MONTHLY</button>
                  <button onClick={() => upd({ billing: form.billing === "monthly" ? "annual" : "monthly" })} className="relative h-7 w-14 rounded-full flex items-center transition-all duration-300" style={{ background: "rgba(99,102,241,0.3)", border: "1px solid rgba(99,102,241,0.4)", boxShadow: "0 0 12px rgba(99,102,241,0.2)" }}>
                    <span className={`absolute h-5 w-5 rounded-full transition-transform duration-300 ease-out ${form.billing === "annual" ? "translate-x-8" : "translate-x-1"}`} style={{ background: "#818cf8", boxShadow: "0 0 8px rgba(99,102,241,0.6)" }} />
                  </button>
                  <button onClick={() => upd({ billing: "annual" })} className={`font-mono text-xs font-bold tracking-widest transition-all duration-200 ${form.billing === "annual" ? (isDark ? "text-white" : "text-zinc-900") : "text-zinc-400 dark:text-zinc-550 hover:text-zinc-600"}`}>
                    ANNUAL <span className="ml-1 px-1.5 py-0.5 rounded text-[8px] font-black" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>20% OFF</span>
                  </button>
                </div>

                {/* Capacity slider */}
                <div className="rounded-2xl p-6 mb-6" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)", border: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.06)" }}>
                  <div className="flex justify-between items-center mb-5">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-1">Workspace Capacity</p>
                      <div className="flex items-baseline gap-2">
                        <input
                          type="number" value={form.seats} min={0} max={500}
                          onChange={e => upd({ seats: Math.min(500, Math.max(0, Number(e.target.value))) })}
                          className={`font-mono text-3xl font-black ${isDark ? "text-white" : "text-zinc-900"} bg-transparent outline-none w-20 text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
                          style={{ borderBottom: "1px solid rgba(99,102,241,0.3)" }}
                        />
                        <span className={`font-mono text-lg font-black ${isDark ? "text-white" : "text-zinc-900"}`}>Users</span>
                      </div>
                      {form.seats < 10 && <p className="font-mono text-[10px] mt-1" style={{ color: "#f59e0b" }}>⚠ Minimum 10 users required</p>}
                    </div>
                    {price() !== null && (
                      <div className="text-right">
                        <p className="font-mono text-[9px] text-zinc-500 dark:text-zinc-400 mb-1">Estimated</p>
                        <p className={`font-mono text-2xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}>₹{total().toLocaleString("en-IN")}</p>
                        <p className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{form.billing === "annual" ? "/ year · incl. GST" : "/ month · incl. GST"}</p>
                      </div>
                    )}
                  </div>
                  <input
                    type="range" min={10} max={500} value={form.seats}
                    onChange={e => upd({ seats: Number(e.target.value) })}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right, #6366f1 0%, #8b5cf6 ${((form.seats - 10) / 490) * 100}%, ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} ${((form.seats - 10) / 490) * 100}%, ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} 100%)` }}
                  />
                  <div className="flex justify-between font-mono text-[9px] text-zinc-550 dark:text-zinc-450 mt-2 tracking-widest">
                    <span>10 USERS</span><span>500 USERS</span>
                  </div>
                </div>
              </StepWrap>
            )}

            {/* ── STEP 2 — Company Information ── */}
            {step === 2 && (
              <StepWrap title="Company Information" sub="Establish your organization's identity on the platform.">
                <Section label="Company Details">
                  <Field label="Company Name *" value={form.companyName} onChange={v => upd({ companyName: v })} placeholder="" />
                  <Field label="Legal Business Name" value={form.legalName} onChange={v => upd({ legalName: v })} placeholder="" />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Business Email *" type="email" value={form.businessEmail} onChange={v => upd({ businessEmail: v })} placeholder="" />
                    <Field label="Business Phone *" type="tel" value={form.businessPhone} onChange={v => upd({ businessPhone: v })} placeholder="" />
                  </div>
                  <Field label="Website URL" value={form.website} onChange={v => upd({ website: v })} placeholder="" />
                </Section>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Select label="Company Size" value={form.companySize} onChange={v => upd({ companySize: v })} options={["1–10", "11–50", "51–200", "201–500", "500+"]} />
                  <Select label="Industry" value={form.industry} onChange={v => upd({ industry: v })} options={["IT", "Marketing", "Finance", "Healthcare", "Education", "Manufacturing", "Other"]} />
                </div>
                <Section label="Optional · Tax Details" className="mt-4">
                  <Field label="GST / VAT Number" value={form.gstNumber} onChange={v => upd({ gstNumber: v })} placeholder="" />
                </Section>
              </StepWrap>
            )}

            {/* ── STEP 3 — Workspace Configuration ── */}
            {step === 3 && (
              <StepWrap title="Workspace Configuration" sub="Define your organization's workspace environment and system preferences.">
                <Section label="Workspace Identity">
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-[0.15em] mb-2 text-zinc-550 dark:text-zinc-400">Workspace Name *</label>
                    <div className="relative">
                      <input
                        value={form.workspaceName}
                        onChange={e => upd({ workspaceName: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                        placeholder=""
                        className="w-full rounded-xl px-4 py-3.5 font-mono text-sm text-zinc-900 placeholder-zinc-450 bg-zinc-50 border border-zinc-200 outline-none transition-all duration-200 pr-10 dark:text-white dark:placeholder-zinc-650 dark:bg-zinc-900/30 dark:border-zinc-800 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
                      />
                      {form.workspaceName.length >= 3 && (
                        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold ${form.workspaceAvailable === null ? "animate-pulse text-zinc-400 dark:text-zinc-600" : form.workspaceAvailable ? "text-emerald-500" : "text-red-500"}`}>
                          {form.workspaceAvailable === null ? "⟳" : form.workspaceAvailable ? "✓" : "✕"}
                        </span>
                      )}
                    </div>
                    {form.workspaceName && (
                      <p className="font-mono text-[10px] mt-2 text-zinc-500 dark:text-zinc-400">
                        Preview: <span style={{ color: "#818cf8" }}>https://app.arkia.com/{form.workspaceName}</span>
                      </p>
                    )}
                    {form.workspaceAvailable === true && <p className="font-mono text-[10px] text-emerald-500 mt-1">✓ Workspace name is available</p>}
                    {form.workspaceAvailable === false && <p className="font-mono text-[10px] text-red-500 mt-1">This workspace name is already taken</p>}
                  </div>
                </Section>
                <Section label="System Configuration" className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Select label="Timezone" value={form.timezone} onChange={v => upd({ timezone: v })} options={["Asia/Kolkata", "America/New_York", "Europe/London", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney"]} />
                    <Select label="Currency" value={form.currency} onChange={v => upd({ currency: v })} options={["INR", "USD", "EUR", "GBP", "AED", "SGD"]} />
                    <Select label="Date Format" value={form.dateFormat} onChange={v => upd({ dateFormat: v })} options={["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]} />
                    <Select label="Language" value={form.language} onChange={v => upd({ language: v })} options={["English", "Hindi"]} />
                  </div>
                </Section>
              </StepWrap>
            )}

            {/* ── STEP 4 — Licence Owner Setup ── */}
            {step === 4 && (
              <StepWrap title="Licence Owner Account" sub="Create the primary organization licence owner with enterprise-grade security.">
                <Section label="Identity">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Full Name *" value={form.ownerName} onChange={v => upd({ ownerName: v })} placeholder="" />
                    <Field label="Work Email *" type="email" value={form.ownerEmail} onChange={v => upd({ ownerEmail: v })} placeholder="" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Password *" type="password" value={form.password} onChange={v => upd({ password: v })} placeholder="Min. 8 characters" />
                    <Field label="Confirm Password *" type="password" value={form.confirmPassword} onChange={v => upd({ confirmPassword: v })} placeholder="Repeat password" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Mobile Number" type="tel" value={form.phone} onChange={v => upd({ phone: v })} placeholder="e.g. +91 98765 43210" />
                  </div>
                </Section>
                <div className="mt-4 flex items-start gap-3 cursor-pointer" onClick={() => upd({ agreedToTerms: !form.agreedToTerms })}>
                  <div className="h-4 w-4 mt-0.5 rounded flex-shrink-0 flex items-center justify-center transition-all duration-200" style={{ background: form.agreedToTerms ? "rgba(99,102,241,0.8)" : "transparent", border: form.agreedToTerms ? "1px solid #6366f1" : (isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.18)") }}>
                    {form.agreedToTerms && <span className="text-white text-[8px]">✓</span>}
                  </div>
                  <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">I agree to the <span style={{ color: "#818cf8" }} className="underline">Terms of Service</span> and <span style={{ color: "#818cf8" }} className="underline">Privacy Policy</span></span>
                </div>
              </StepWrap>
            )}

            {/* ── STEP 5 — Billing Review ── */}
            {step === 5 && (
              <StepWrap title="Billing Review" sub="Review your complete organization setup before proceeding to payment.">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <ReviewCard label="Organization">
                    <RRow k="Company" v={form.companyName || "—"} />
                    <RRow k="Workspace" v={form.workspaceName ? `/${form.workspaceName}` : "—"} />
                    <RRow k="Team Size" v={`${form.seats} users`} />
                    <RRow k="Work Model" v={form.workModel} />
                  </ReviewCard>
                  <ReviewCard label="Subscription">
                    <RRow k="Plan" v={PLAN_DETAILS[form.plan].name} />
                    <RRow k="Billing" v={form.billing === "annual" ? "Annual" : "Monthly"} />
                    <RRow k="Modules" v={`${form.enabledModules.length} active`} />
                    <RRow k="Approval" v={form.approvalStructure} />
                  </ReviewCard>
                </div>
                {price() !== null && (
                  <div className="rounded-2xl p-5 mb-4" style={{ background: isDark ? "rgba(99,102,241,0.04)" : "rgba(99,102,241,0.02)", border: isDark ? "1px solid rgba(99,102,241,0.12)" : "1px solid rgba(99,102,241,0.08)" }}>
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] mb-4" style={{ color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.4)" }}>Charges Breakdown</p>
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">Base Price</span><span className={`font-mono text-xs ${isDark ? "text-white" : "text-zinc-900"}`}>₹{price()?.toLocaleString("en-IN")}</span></div>
                      <div className="flex justify-between"><span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">GST (18%)</span><span className={`font-mono text-xs ${isDark ? "text-white" : "text-zinc-900"}`}>₹{tax().toLocaleString("en-IN")}</span></div>
                      {form.couponApplied && <div className="flex justify-between"><span className="font-mono text-xs text-emerald-500">Coupon Discount</span><span className="font-mono text-xs text-emerald-450 dark:text-emerald-400">−₹0</span></div>}
                    </div>
                    <div className="flex justify-between mt-4 pt-4 items-center" style={{ borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)" }}>
                      <span className={`font-mono text-xs font-black ${isDark ? "text-white" : "text-zinc-900"} uppercase tracking-widest`}>Total</span>
                      <span className={`font-mono text-2xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}>₹{total().toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                )}
                <Section label="Coupon Code">
                  <div className="flex gap-3">
                    <input
                      value={form.couponCode}
                      onChange={e => upd({ couponCode: e.target.value.toUpperCase(), couponApplied: false })}
                      placeholder="ENTER COUPON CODE"
                      className="flex-1 rounded-xl px-4 py-3 font-mono text-sm text-zinc-900 placeholder-zinc-450 bg-zinc-50 border border-zinc-200 outline-none uppercase tracking-widest transition-all duration-200 dark:text-white dark:placeholder-zinc-650 dark:bg-zinc-900/30 dark:border-zinc-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />
                    <button onClick={() => upd({ couponApplied: form.couponCode.length > 3 })} className="px-5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all duration-200" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#818cf8" }}>Apply</button>
                  </div>
                  {form.couponApplied && <p className="font-mono text-[10px] text-emerald-500 mt-2">✓ Coupon applied</p>}
                </Section>
              </StepWrap>
            )}

            {/* ── STEP 6 — Payment ── */}
            {step === 6 && (
              <StepWrap title="Secure Payment" sub="Complete payment to activate your workforce workspace.">
                {paymentError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg font-mono">
                    {paymentError}
                  </div>
                )}
                <div className="flex gap-2 mb-6">
                  {[{ id: "card", label: "Credit / Debit Card" }, { id: "upi", label: "UPI" }, { id: "netbanking", label: "Net Banking" }].map(g => (
                    <button key={g.id} onClick={() => upd({ paymentMethod: g.id })} className="flex-1 py-3 rounded-xl font-mono text-xs font-bold transition-all duration-200" style={{ background: form.paymentMethod === g.id ? "rgba(99,102,241,0.1)" : (isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)"), border: form.paymentMethod === g.id ? "1px solid rgba(99,102,241,0.35)" : (isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)"), color: form.paymentMethod === g.id ? "#818cf8" : (isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.4)") }}>{g.label}</button>
                  ))}
                </div>
                {form.paymentMethod === "card" && (
                  <Section label="Card Details">
                    <Field label="Cardholder Name" value={form.cardName} onChange={v => upd({ cardName: v })} placeholder="" />
                    <Field label="Card Number" value={form.cardNumber} onChange={v => upd({ cardNumber: v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim() })} placeholder="1234  5678  9012  3456" />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Expiry" value={form.cardExpiry} onChange={v => upd({ cardExpiry: v })} placeholder="MM / YY" />
                      <Field label="CVV" value={form.cardCVV} onChange={v => upd({ cardCVV: v.replace(/\D/g, "").slice(0, 3) })} placeholder="•••" type="password" />
                    </div>
                  </Section>
                )}
                {form.paymentMethod === "upi" && (
                  <Section label="UPI"><Field label="UPI ID" value={form.upiId} onChange={v => upd({ upiId: v })} placeholder="" /></Section>
                )}
                {form.paymentMethod === "netbanking" && (
                  <Section label="Select Bank">
                    <div className="grid grid-cols-3 gap-3">
                      {["SBI", "HDFC", "ICICI", "Axis", "Kotak", "Other"].map(b => (
                        <button key={b} className="py-3 rounded-xl font-mono text-xs font-bold transition-all duration-200" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)", border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)", color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.5)" }}>{b}</button>
                      ))}
                    </div>
                  </Section>
                )}
                <div className="mt-4 flex items-center gap-4 p-4 rounded-2xl" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.12)" }}>
                  <span className="text-2xl">🔒</span>
                  <div>
                    <p className="font-mono text-[10px] font-black text-emerald-500 uppercase tracking-widest">256-bit SSL · PCI DSS Compliant</p>
                    <p className="font-mono text-[10px] text-zinc-500 dark:text-zinc-700 mt-0.5">Secured by Stripe & Razorpay. Card data is never stored.</p>
                  </div>
                </div>
                {price() !== null && (
                  <div className="mt-4 flex justify-between items-center p-5 rounded-2xl" style={{ background: isDark ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.04)", border: isDark ? "1px solid rgba(99,102,241,0.15)" : "1px solid rgba(99,102,241,0.1)" }}>
                    <span className="font-mono text-xs text-zinc-500">Amount payable today</span>
                    <span className={`font-mono text-2xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}>₹{total().toLocaleString("en-IN")}</span>
                  </div>
                )}
              </StepWrap>
            )}

            {/* ── STEP 7 — Provisioning ── */}
            {step === 7 && (
              <div className="flex flex-col items-center justify-center min-h-[540px] p-10 text-center">
                <div className="relative mb-10">
                  <div className="absolute -inset-8 rounded-full opacity-20 animate-pulse" style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />
                  <div className="relative h-28 w-28 rounded-full flex items-center justify-center" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                    <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-indigo-500 border-r-violet-500 animate-spin" />
                    <div className="absolute inset-4 rounded-full border border-indigo-500/20 animate-ping" />
                    <span className="text-3xl" style={{ color: "#818cf8" }}>⬡</span>
                  </div>
                </div>
                <h2 className={`font-mono text-2xl font-black ${isDark ? "text-white" : "text-zinc-900"} mb-2 tracking-tight`}>Provisioning Workspace</h2>
                <p className="font-mono text-xs text-zinc-550 dark:text-zinc-650 mb-10">Configuring your organization infrastructure...</p>
                <div className="w-full max-w-sm space-y-3">
                  {["Creating organization identity", "Provisioning tenant workspace", "Assigning organization owner", "Generating system defaults", "Configuring RBAC & permissions", "Activating subscription", "Launching workforce console"].map((s, i) => (
                    <div key={i} className={`flex items-center gap-3 transition-all duration-500 ${i < provStep ? "opacity-100" : "opacity-15"}`}>
                      <div className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold transition-all duration-300" style={{ background: i < provStep ? "rgba(16,185,129,0.15)" : (isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"), border: i < provStep ? "1px solid rgba(16,185,129,0.3)" : (isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)"), color: i < provStep ? "#10b981" : (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.35)") }}>
                        {i < provStep ? "✓" : i + 1}
                      </div>
                      <span className="font-mono text-xs text-left" style={{ color: i < provStep ? (isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.75)") : (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.25)") }}>{s}</span>
                      {i === provStep - 1 && <span className="ml-auto font-mono text-[9px] text-emerald-500 tracking-widest">DONE</span>}
                    </div>
                  ))}
                </div>
                <div className="mt-10 w-full max-w-sm h-1 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)" }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(provStep / 7) * 100}%`, background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }} />
                </div>
              </div>
            )}

            {/* ── STEP 8 — Success ── */}
            {step === 8 && (
              <div className="flex flex-col items-center justify-center min-h-[540px] p-10 text-center">
                <div className="relative mb-10">
                  <div className="absolute -inset-12 rounded-full opacity-15 animate-pulse" style={{ background: "radial-gradient(circle, #10b981, transparent)" }} />
                  <div className="h-28 w-28 rounded-full flex items-center justify-center relative" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", boxShadow: "0 0 40px rgba(16,185,129,0.1)" }}>
                    <span className="text-5xl" style={{ color: "#10b981" }}>✓</span>
                  </div>
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3">Workspace Active</p>
                <h2 className={`font-mono text-3xl font-black ${isDark ? "text-white" : "text-zinc-900"} mb-2`}>Welcome, {form.ownerName || "Owner"}</h2>
                <p className="font-mono text-sm text-zinc-500 mb-10">Your workforce workspace is ready to operate.</p>
                <div className="w-full max-w-xs space-y-2 mb-10 text-left">
                  {["Invite Employees", "Create Departments", "Configure Attendance", "Setup Leave Policies", "Configure Payroll", "Setup Roles & Permissions"].map(t => (
                    <div key={t} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)", border: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.06)" }}>
                      <div className="h-4 w-4 rounded border flex-shrink-0" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)" }} />
                      <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{t}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleLaunchConsole}
                  className="relative px-10 py-4 rounded-2xl font-mono text-xs font-black uppercase tracking-widest text-white overflow-hidden transition-all duration-300 hover:scale-105 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 8px 32px rgba(99,102,241,0.35), 0 0 0 1px rgba(99,102,241,0.2)" }}
                >
                  <span className="relative z-10">Launch Console →</span>
                  <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300" style={{ background: "linear-gradient(135deg, #818cf8, #a78bfa)" }} />
                </button>
              </div>
            )}

          </div>

          {/* ── FOOTER ── */}
          {step < 7 && (
            <div
              className="flex items-center justify-between px-7 py-5 flex-shrink-0"
              style={{
                borderTop: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(99,102,241,0.08)",
                background: isDark ? "rgba(9,9,14,0.4)" : "rgba(255,255,255,0.45)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <button
                onClick={step === 1 ? onClose : back}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-mono text-xs font-bold tracking-wider transition-all duration-200 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                style={{
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)",
                  border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(99,102,241,0.15)",
                  boxShadow: isDark ? "none" : "0 2px 10px rgba(99,102,241,0.03)",
                }}
              >
                <span>←</span> {step === 1 ? "Cancel" : "Back"}
              </button>
              <div className="flex items-center gap-3">
                {/* Mini step dots */}
                <div className="hidden sm:flex items-center gap-1.5">
                  {STEPS.map(s => (
                    <div
                      key={s.id}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: step === s.id ? "20px" : "6px",
                        height: "6px",
                        background: step === s.id
                          ? "linear-gradient(90deg, #6366f1, #8b5cf6)"
                          : step > s.id
                            ? "rgba(16,185,129,0.5)"
                            : isDark
                              ? "rgba(255,255,255,0.12)"
                              : "rgba(99,102,241,0.15)"
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={step === 6 ? handleCompletePayment : next}
                  disabled={isSubmitting}
                  className="relative flex items-center gap-2.5 px-7 py-2.5 rounded-xl font-mono text-xs font-black uppercase tracking-wider text-white overflow-hidden transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 20px rgba(99,102,241,0.3), 0 0 0 1px rgba(99,102,241,0.2)" }}
                >
                  {step === 6 ? (isSubmitting ? "Provisioning..." : "Complete Payment") : "Continue"} <span>→</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }
      `}</style>
    </div>
    </WizardThemeContext.Provider>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────────
const StepWrap: React.FC<{ title: string; sub: string; children: React.ReactNode }> = ({ title, sub, children }) => {
  const { isDark } = React.useContext(WizardThemeContext);
  return (
    <div className="p-7 lg:p-8">
      <div className="mb-7">
        <p className="font-mono text-[9px] uppercase tracking-[0.25em] mb-2" style={{ color: "rgba(99,102,241,0.6)" }}>Setup</p>
        <h2 className={`font-mono text-xl font-black ${isDark ? "text-white" : "text-zinc-900"} tracking-tight`}>{title}</h2>
        <p className="font-mono text-xs mt-1.5" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.4)" }}>{sub}</p>
      </div>
      {children}
    </div>
  );
};

const Section: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = "" }) => {
  const { isDark } = React.useContext(WizardThemeContext);
  return (
    <div className={`rounded-2xl p-5 ${className}`} style={{ background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)", border: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.06)" }}>
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] mb-4" style={{ color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.4)" }}>{label}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }> = ({ label, value, onChange, placeholder, type = "text" }) => {
  const { isDark } = React.useContext(WizardThemeContext);
  return (
    <div>
      {label && <label className="block font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.45)" }}>{label}</label>}
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3 font-mono text-sm text-zinc-900 placeholder-zinc-450 bg-zinc-50 border border-zinc-200 outline-none transition-all duration-200 dark:text-white dark:placeholder-zinc-650 dark:bg-zinc-900/30 dark:border-zinc-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
      />
    </div>
  );
};

const Select: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: string[] }> = ({ label, value, onChange, options }) => {
  const { isDark } = React.useContext(WizardThemeContext);
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.45)" }}>{label}</label>
      <div className="relative">
        <select
          value={value} onChange={e => onChange(e.target.value)}
          className="w-full rounded-xl px-4 py-3 font-mono text-sm text-zinc-900 bg-zinc-50 border border-zinc-200 outline-none transition-all duration-200 appearance-none cursor-pointer dark:text-white dark:bg-zinc-900/30 dark:border-zinc-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
        >
          {options.map(o => <option key={o} value={o} style={{ background: isDark ? "#0f0f13" : "#ffffff", color: isDark ? "#ffffff" : "#000000" }}>{o}</option>)}
        </select>
        <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-xs">▼</span>
      </div>
    </div>
  );
};

const ReviewCard: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const { isDark } = React.useContext(WizardThemeContext);
  return (
    <div className="rounded-2xl p-4" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)", border: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.06)" }}>
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] mb-3" style={{ color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.4)" }}>{label}</p>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
};

const RRow: React.FC<{ k: string; v: string }> = ({ k, v }) => {
  const { isDark } = React.useContext(WizardThemeContext);
  return (
    <div className="flex justify-between items-center">
      <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{k}</span>
      <span className={`font-mono text-xs font-bold ${isDark ? "text-zinc-300" : "text-zinc-900"}`}>{v}</span>
    </div>
  );
};
