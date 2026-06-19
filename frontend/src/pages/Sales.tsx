import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, IconName } from "../components/Icon";
import { AmbientAuraBackground } from "../components/AmbientAuraBackground";
import { useAppTheme } from "../hooks/useAppTheme";
import { BRAND_NAME } from "../config/branding";
import { WorkspaceSetupWizard, PlanType, BillingCycle } from "../components/WorkspaceSetupWizard";

type RoleType = "employee" | "manager" | "hr" | "finance" | "admin" | "licensee";

interface ClearanceFeature {
  title: string;
  icon: IconName;
  desc: string;
}

const ROLE_FEATURES: Record<RoleType, ClearanceFeature[]> = {
  employee: [
    { title: "Submit timesheets", icon: "clock", desc: "Submit weekly timesheets with task breakdown." },
    { title: "Apply leave requests", icon: "leave", desc: "Apply for leaves with dynamic balance check." },
    { title: "View personal reports", icon: "reports", desc: "Access personal attendance and hours summaries." },
    { title: "Track assigned tasks", icon: "projects", desc: "View task schedules and assignments." },
  ],
  manager: [
    { title: "Approve team timesheets", icon: "approvals", desc: "Review and approve submitted team timesheets." },
    { title: "Manage team workload", icon: "team", desc: "Supervise task allocations and team bandwidth." },
    { title: "Review leave requests", icon: "timesheet", desc: "Approve or reject leave applications." },
    { title: "Monitor project activity", icon: "dashboard", desc: "Track progress of project deliverables." },
  ],
  hr: [
    { title: "Manage employees", icon: "employees", desc: "Add, modify, and manage employee profiles." },
    { title: "Handle leave policies", icon: "shield", desc: "Define rules and allocations for leave types." },
    { title: "Access workforce records", icon: "departments", desc: "View audit logs and digital worker cards." },
    { title: "Track attendance analytics", icon: "reports", desc: "Analyze late filings and attendance metrics." },
  ],
  finance: [
    { title: "Process payroll", icon: "timesheet", desc: "Calculate payouts and verify working hours." },
    { title: "Generate financial reports", icon: "file-spreadsheet", desc: "Generate billing statements and summaries." },
    { title: "Monitor billing workflows", icon: "monitor", desc: "Track client invoices and project billings." },
    { title: "Export payroll data", icon: "download", desc: "Download ledgers in SSRS CSV or Excel formats." },
  ],
  admin: [
    { title: "Configure workspace settings", icon: "settings", desc: "Configure global system parameters." },
    { title: "Manage departments & roles", icon: "git-branch", desc: "Organize company structures and RBAC rules." },
    { title: "Control approvals", icon: "approvals", desc: "Set up multi-level approval routing rules." },
    { title: "Access full system analytics", icon: "reports", desc: "Compile complete system telemetry metrics." },
  ],
  licensee: [
    { title: "Manage subscription plans", icon: "file-spreadsheet", desc: "Manage billing plans and workspace licensing." },
    { title: "Monitor active seats", icon: "employees", desc: "Track occupied seats and assign keys." },
    { title: "Access billing overview", icon: "dashboard", desc: "View upcoming renewals and payment settings." },
    { title: "Control workspace licensing", icon: "shield", desc: "Verify key credentials and organizational bindings." },
  ],
};

interface SalesProps {
  onLogin?: (email: string, password: string) => Promise<any>;
}

export const Sales = ({ onLogin }: SalesProps) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useAppTheme();
  const isDark = theme === "dark";

  // Scroll Telemetry
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Spotlight position
  const [spotlightPos, setSpotlightPos] = useState({ x: 0, y: 0 });
  const handleGlobalMouseMove = (e: React.MouseEvent) => {
    setSpotlightPos({ x: e.clientX, y: e.clientY });
  };

  // Role switching
  const [activeRole, setActiveRole] = useState<RoleType>("employee");



  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Dynamic pricing state (Seats slider and monthly/annual switch)
  const [seats, setSeats] = useState(170);
  const [seatsInput, setSeatsInput] = useState("170");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("annual");

  // Workspace Setup Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPlan, setWizardPlan] = useState<PlanType>("starter");
  const openWizard = (plan: PlanType) => { setWizardPlan(plan); setWizardOpen(true); };

  // Contact Sales Modal
  const [contactSalesOpen, setContactSalesOpen] = useState(false);
  const [contactSalesVisible, setContactSalesVisible] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    company: "",
    size: "100-500",
    message: "",
  });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  useEffect(() => {
    if (contactSalesOpen) {
      setContactSubmitted(false);
      setContactForm({ name: "", email: "", company: "", size: "100-500", message: "" });
      const timer = setTimeout(() => setContactSalesVisible(true), 20);
      return () => clearTimeout(timer);
    } else {
      setContactSalesVisible(false);
    }
  }, [contactSalesOpen]);

  return (
    <>
    <WorkspaceSetupWizard
      isOpen={wizardOpen}
      onClose={() => setWizardOpen(false)}
      initialPlan={wizardPlan}
      initialSeats={seats >= 10 ? seats : 10}
      initialBilling={billingPeriod as BillingCycle}
      isDark={isDark}
      onLogin={onLogin}
    />

    {contactSalesOpen && (
      <div
        className={`fixed inset-0 z-[400] flex items-center justify-center transition-all duration-700 ease-out ${contactSalesVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{ backdropFilter: "blur(24px) saturate(180%)", backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(15,23,42,0.3)" }}
      >
        {/* Background glow orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full" style={{ background: isDark ? "radial-gradient(circle, #6366f1 0%, transparent 70%)" : "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", opacity: isDark ? 0.2 : 0.6, animation: "pulse 8s ease-in-out infinite" }} />
          <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full" style={{ background: isDark ? "radial-gradient(circle, #8b5cf6 0%, transparent 70%)" : "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)", opacity: isDark ? 0.15 : 0.5, animation: "pulse 10s ease-in-out infinite 2s" }} />
        </div>

        {/* Modal container */}
        <div
          className={`relative w-full max-w-[550px] mx-4 rounded-[24px] border overflow-hidden transition-all duration-700 ease-out ${contactSalesVisible ? "scale-100 translate-y-0 opacity-100" : "scale-[0.95] translate-y-8 opacity-0"}`}
          style={{
            background: isDark ? "linear-gradient(145deg, #09090e 0%, #0e0e16 40%, #0a0a12 100%)" : "linear-gradient(145deg, #ffffff 0%, #fafafa 40%, #f4f4f7 100%)",
            borderColor: isDark ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.15)",
            boxShadow: isDark 
              ? "0 0 0 1px rgba(99,102,241,0.1), 0 30px 100px -10px rgba(0,0,0,0.9), 0 0 60px -15px rgba(99,102,241,0.2)"
              : "0 0 0 1px rgba(99,102,241,0.05), 0 25px 80px -20px rgba(15,23,42,0.08), 0 0 45px -15px rgba(99,102,241,0.06)",
          }}
        >
          {/* Top gradient line */}
          <div className="absolute top-0 left-0 right-0 h-px z-20" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.6) 30%, rgba(139,92,246,0.8) 50%, rgba(99,102,241,0.6) 70%, transparent 100%)" }} />

          {/* Close button */}
          <button
            onClick={() => setContactSalesOpen(false)}
            className="absolute top-5 right-5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition duration-200 z-30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="px-8 py-10 relative z-25">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center font-black text-white text-xs" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>A</div>
                <div className="absolute -inset-1 rounded-xl opacity-40 blur-md" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }} />
              </div>
              <div>
                <p className={`font-mono text-[10px] font-black tracking-widest ${isDark ? "text-white" : "text-zinc-900"}`}>ARKIA ENTERPRISE</p>
                <p className="font-mono text-[8px] text-zinc-550 dark:text-zinc-450 tracking-widest">CONTACT SALES</p>
              </div>
            </div>

            {!contactSubmitted ? (
              <>
                <h3 className={`font-heading text-2xl font-bold ${isDark ? "text-white" : "text-zinc-900"} mb-2`}>Request Custom Workspace</h3>
                <p className="text-xs text-zinc-550 dark:text-zinc-400 mb-6 font-mono">
                  Scale your organization with isolated database instances, custom integrations, advanced RBAC, and dedicated support.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setIsSubmittingContact(true);
                    setTimeout(() => {
                      setIsSubmittingContact(false);
                      setContactSubmitted(true);
                    }, 1200);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-mono text-zinc-500 dark:text-zinc-400 mb-1.5 font-bold">Your Name</label>
                    <input
                      type="text"
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      placeholder="Jane Doe"
                      className="w-full rounded-xl px-4 py-3 font-mono text-sm text-zinc-900 placeholder-zinc-450 bg-zinc-50 border border-zinc-200 outline-none transition-all duration-200 dark:text-white dark:placeholder-zinc-650 dark:bg-zinc-900/30 dark:border-zinc-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-mono text-zinc-500 dark:text-zinc-400 mb-1.5 font-bold">Business Email</label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="jane@company.com"
                      className="w-full rounded-xl px-4 py-3 font-mono text-sm text-zinc-900 placeholder-zinc-450 bg-zinc-50 border border-zinc-200 outline-none transition-all duration-200 dark:text-white dark:placeholder-zinc-650 dark:bg-zinc-900/30 dark:border-zinc-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-mono text-zinc-500 dark:text-zinc-400 mb-1.5 font-bold">Company Name</label>
                      <input
                        type="text"
                        required
                        value={contactForm.company}
                        onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                        placeholder="Acme Corp"
                        className="w-full rounded-xl px-4 py-3 font-mono text-sm text-zinc-900 placeholder-zinc-450 bg-zinc-50 border border-zinc-200 outline-none transition-all duration-200 dark:text-white dark:placeholder-zinc-650 dark:bg-zinc-900/30 dark:border-zinc-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-mono text-zinc-500 dark:text-zinc-400 mb-1.5 font-bold">Expected Seats</label>
                      <div className="relative">
                        <select
                          value={contactForm.size}
                          onChange={(e) => setContactForm({ ...contactForm, size: e.target.value })}
                          className="w-full rounded-xl px-4 py-3 font-mono text-sm text-zinc-900 bg-zinc-50 border border-zinc-200 outline-none transition-all duration-200 appearance-none cursor-pointer dark:text-white dark:bg-zinc-900/30 dark:border-zinc-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                        >
                          <option value="100-500" style={{ background: isDark ? "#0f0f13" : "#ffffff", color: isDark ? "#ffffff" : "#000000" }}>100 - 500 seats</option>
                          <option value="500-2000" style={{ background: isDark ? "#0f0f13" : "#ffffff", color: isDark ? "#ffffff" : "#000000" }}>500 - 2,000 seats</option>
                          <option value="2000+" style={{ background: isDark ? "#0f0f13" : "#ffffff", color: isDark ? "#ffffff" : "#000000" }}>2,000+ seats</option>
                        </select>
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-xs">▼</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-mono text-zinc-500 dark:text-zinc-400 mb-1.5 font-bold">Use Case Details</label>
                    <textarea
                      rows={3}
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      placeholder="Tell us about your custom billing, hosting or compliance requirements..."
                      className="w-full rounded-xl px-4 py-3 font-mono text-sm text-zinc-900 placeholder-zinc-450 bg-zinc-50 border border-zinc-200 outline-none transition-all duration-200 dark:text-white dark:placeholder-zinc-650 dark:bg-zinc-900/30 dark:border-zinc-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingContact}
                    className="w-full mt-6 rounded-xl py-3 text-xs font-bold uppercase tracking-wider text-white transition duration-200 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden font-mono flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", boxShadow: "0 4px 20px rgba(99,102,241,0.25)" }}
                  >
                    {isSubmittingContact ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Transmitting Setup...</span>
                      </>
                    ) : (
                      <span>Request Enterprise Session</span>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6 border border-indigo-500/20 relative" style={{ background: isDark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.25)" }}>
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <div className="absolute -inset-2 rounded-2xl opacity-20 blur-md bg-indigo-500" />
                </div>
                <h3 className={`font-heading text-2xl font-bold ${isDark ? "text-white" : "text-zinc-900"} mb-2`}>Request Transmitted</h3>
                <p className="text-xs text-zinc-550 dark:text-zinc-400 max-w-sm mx-auto mb-8 font-mono">
                  Your enterprise briefing is successfully routed. An Account Specialist will contact you at <span className="text-indigo-450 dark:text-indigo-400 font-bold">{contactForm.email}</span> within 2 hours.
                </p>
                <button
                  onClick={() => setContactSalesOpen(false)}
                  className="px-6 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold uppercase tracking-wider text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 transition duration-200 font-mono"
                >
                  Close Window
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    <div
      onMouseMove={handleGlobalMouseMove}
      className="relative min-h-screen bg-zinc-50 text-zinc-900 transition-colors duration-500 overflow-x-hidden selection:bg-zinc-200 selection:text-zinc-900 font-sans subtle-grid-dots dark:bg-zinc-950 dark:text-zinc-100"
    >
      {/* Dynamic Backlight Spotlight */}
      <div
        className="glow-spotlight fixed inset-0 z-0 transition-opacity duration-300 pointer-events-none"
        style={{
          "--mouse-x": `${spotlightPos.x}px`,
          "--mouse-y": `${spotlightPos.y}px`,
        } as React.CSSProperties}
      />

      {/* Minimal Animated Mesh/Aura Background */}
      <AmbientAuraBackground />

      {/* Sticky Header Nav */}
      <header
        className={`fixed z-50 left-1/2 -translate-x-1/2 transition-all duration-300 lg:transition-none ${
          scrolled
            ? "top-4 w-[calc(100%-2rem)] max-w-5xl rounded-2xl sm:rounded-full border border-zinc-200/60 bg-white/70 py-2.5 px-4 sm:px-8 shadow-xl backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/70 lg:opacity-0 lg:scale-0 lg:pointer-events-none"
            : "top-0 w-full border-b border-transparent py-6 bg-transparent px-6 sm:px-12"
        }`}
      >
        <div className="flex items-center justify-between w-full relative">
          
          {/* Left Side: Logo and conditional scrolled nav links (only for tablet/mobile view when topbar remains) */}
          <div className="flex items-center gap-6 lg:gap-8">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 transition duration-300 hover:rotate-12">
                <Icon name="clock" className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="text-sm font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100 font-mono">
                {BRAND_NAME}
              </span>
            </div>

            {/* Nav links (Only shown next to logo when scrolled on mobile/tablet if topbar is active) */}
            {scrolled && (
              <nav className="hidden md:flex lg:hidden items-center gap-6 text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-300 animate-fade-in">
                <a href="#console" className="transition hover:text-indigo-650 dark:hover:text-indigo-400">Home</a>
                <a href="#roles" className="transition hover:text-indigo-650 dark:hover:text-indigo-400">Roles</a>
                <a href="#pricing" className="transition hover:text-indigo-650 dark:hover:text-indigo-400">Pricing</a>
                <a href="#security" className="transition hover:text-indigo-650 dark:hover:text-indigo-400">Security</a>
              </nav>
            )}
          </div>

          {/* Centered Nav links (Only shown in center when NOT scrolled) */}
          {!scrolled && (
            <nav className="hidden lg:flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-300 absolute left-1/2 -translate-x-1/2">
              <a href="#console" className="transition hover:text-indigo-650 dark:hover:text-indigo-400">Home</a>
              <a href="#roles" className="transition hover:text-indigo-650 dark:hover:text-indigo-400">Roles</a>
              <a href="#pricing" className="transition hover:text-indigo-650 dark:hover:text-indigo-400">Pricing</a>
              <a href="#security" className="transition hover:text-indigo-650 dark:hover:text-indigo-400">Security</a>
            </nav>
          )}

          {/* Right Actions Group */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 shadow-sm"
              aria-label="Toggle Theme Mode"
            >
              <Icon name={theme === "light" ? "moon" : "sun"} className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
            </button>

            <button
              onClick={() => navigate("/login")}
              className="relative inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold uppercase tracking-widest text-zinc-750 shadow-sm hover:bg-zinc-50 transition dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Left Floating Command Sidebar (Scrolled state on Desktop) */}
      <aside
        className={`fixed top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col items-center justify-between py-8 px-4 bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-xl transition-all duration-500 min-h-[460px] w-28 ${
          scrolled ? "left-6 opacity-100 translate-x-0" : "-left-32 opacity-0 -translate-x-10 pointer-events-none"
        }`}
      >
        {/* Top: Logo / Branding Icon */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 transition duration-300 hover:rotate-12">
            <Icon name="clock" className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200 font-mono mt-2">
            {BRAND_NAME}
          </span>
        </div>

        {/* Middle: Vertical Navigation */}
        <nav className="flex flex-col gap-3.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 w-full text-center">
          <a href="#console" className="py-2 rounded-xl hover:bg-zinc-100/60 dark:hover:bg-zinc-900/50 transition hover:text-indigo-650 dark:hover:text-indigo-400">Home</a>
          <a href="#roles" className="py-2 rounded-xl hover:bg-zinc-100/60 dark:hover:bg-zinc-900/50 transition hover:text-indigo-650 dark:hover:text-indigo-400">Roles</a>
          <a href="#pricing" className="py-2 rounded-xl hover:bg-zinc-100/60 dark:hover:bg-zinc-900/50 transition hover:text-indigo-650 dark:hover:text-indigo-400">Pricing</a>
          <a href="#security" className="py-2 rounded-xl hover:bg-zinc-100/60 dark:hover:bg-zinc-900/50 transition hover:text-indigo-650 dark:hover:text-indigo-400">Security</a>
        </nav>

        {/* Bottom: Theme Switcher & Login button */}
        <div className="flex flex-col items-center gap-4 w-full">
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 shadow-sm"
            aria-label="Toggle Theme Mode"
            title="Toggle Theme"
          >
            <Icon name={theme === "light" ? "moon" : "sun"} className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
          </button>

          <button
            onClick={() => navigate("/login")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 shadow-sm text-zinc-700 dark:text-zinc-200"
            title="Login"
          >
            <Icon name="external-link" className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Hero Section */}
      <section id="console" className="relative z-10 mx-auto max-w-[90rem] px-6 lg:px-12 pt-28 pb-14 md:pt-36 md:pb-18">
        <div className="grid gap-16 lg:grid-cols-12 lg:items-center">
          
          {/* Hero Left Content */}
          <div className="lg:col-span-7 text-left flex flex-col">


            <h1 className="font-heading text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.08] text-zinc-900 dark:text-white">
              Manage workforce operations <br />
              with clarity, control, &amp; scale.
            </h1>

            <p className="mt-6 text-lg text-zinc-700 dark:text-zinc-350 leading-relaxed max-w-xl">
              Bring payroll, approvals, timesheets, finance, and workforce management into one operational system. Built for seamless team scale and audit readiness.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={() => navigate("/login")}
                className="group relative inline-flex items-center gap-3 rounded-xl bg-zinc-900 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white shadow-[0_10px_25px_-5px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_25px_-5px_rgba(255,255,255,0.05)] hover:scale-[1.02] active:scale-[0.98] duration-200"
              >
                Start Free Trial
                <Icon name="external-link" className="h-4 w-4" />
              </button>
              
              <a
                href="#pricing"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white/50 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-zinc-700 hover:bg-zinc-100 transition dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:bg-zinc-900/80 hover:scale-[1.02] active:scale-[0.98] duration-200"
              >
                View Pricing Plans
              </a>
            </div>


          </div>

          {/* Hero Right Content: Cinematic Telemetry Console */}
          <div className="lg:col-span-5 relative group">
            {/* Outer glow ring */}
            <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-br from-indigo-500/40 via-purple-500/20 to-emerald-500/20 opacity-50 blur-sm group-hover:opacity-80 transition-all duration-700" />
            {/* Inner card — light: white glass, dark: deep black */}
            <div className="relative rounded-2xl overflow-hidden border border-zinc-200/80 bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_-8px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-zinc-950 dark:shadow-[0_32px_80px_-12px_rgba(0,0,0,0.9)]">

              {/* Scanline overlay (dark only) */}
              <div className="absolute inset-0 pointer-events-none z-10 opacity-0 dark:opacity-[0.03]"
                style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.8) 2px, rgba(255,255,255,0.8) 3px)" }} />

              {/* Ambient glows */}
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-indigo-500/8 dark:bg-indigo-500/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

              {/* Title bar */}
              <div className="relative z-20 flex items-center gap-3 px-5 py-3.5 border-b border-zinc-200/60 bg-zinc-50/60 dark:border-white/[0.06] dark:bg-white/[0.03]">
                {/* macOS-style dots */}
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                </div>
                <div className="flex items-center gap-2 ml-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-emerald-600 dark:text-emerald-400/80 uppercase">
                    [ OPERATIONAL.OVERVIEW ]
                  </span>
                </div>
              </div>

              {/* Status rows */}
              <div className="relative z-20 px-5 py-5 space-y-1">
                {[
                  "Employee timesheets synchronized",
                  "Leave requests managed",
                  "Payroll workflows active",
                  "Project tracking connected",
                  "Team approvals enabled",
                  "Workforce analytics live",
                  "Financial reporting secured",
                  "Real-time activity monitoring",
                  "Multi-role access configured",
                  "Enterprise workspace protected",
                ].map((text, i) => (
                  <div
                    key={i}
                    className="group/row flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100/70 dark:hover:bg-white/[0.04] transition-all duration-200 cursor-default"
                  >
                    <div className="w-[2px] h-4 rounded-full bg-emerald-500/30 group-hover/row:bg-emerald-500/70 transition-colors duration-200 flex-shrink-0" />
                    <svg className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="font-mono text-xs text-zinc-500 group-hover/row:text-zinc-800 dark:text-zinc-400 dark:group-hover/row:text-zinc-200 transition-colors duration-200 tracking-wide">
                      {text}
                    </span>
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500/40 group-hover/row:bg-emerald-500 group-hover/row:shadow-[0_0_6px_2px_rgba(52,211,153,0.4)] transition-all duration-200 flex-shrink-0" />
                  </div>
                ))}
              </div>

            </div>
          </div>


        </div>
      </section>

      {/* Role-Based Switcher Section */}
      <section id="roles" className="relative z-10 w-full max-w-[90rem] mx-auto px-6 lg:px-12 py-16 border-t border-zinc-200 dark:border-zinc-900 overflow-visible">
        <div className="mb-16 text-center max-w-2xl mx-auto">
          <h2 className="font-heading text-3xl font-extrabold sm:text-4xl text-zinc-900 dark:text-white">
            Role Clearance Control
          </h2>
          <p className="mt-4 text-base text-zinc-750 dark:text-zinc-300 leading-relaxed">
            Configure individual permissions. Switch clearance level below to preview console layout variations.
          </p>
        </div>

        {/* Selector Tabs Container */}
        <div className="mb-16 w-full max-w-5xl mx-auto px-4 md:px-8 text-center relative z-30 overflow-visible flex justify-center">
          <div className="inline-flex flex-row items-center justify-center gap-1 sm:gap-1.5 p-1.5 bg-zinc-100/80 dark:bg-zinc-900/40 rounded-2xl border border-zinc-200/50 dark:border-zinc-800 backdrop-blur-xl shadow-lg max-w-full overflow-visible">
            {[
              { id: "employee", label: "Employee", midLabel: "Employee", shortLabel: "Emp" },
              { id: "manager", label: "Team Manager", midLabel: "Manager", shortLabel: "Mgr" },
              { id: "hr", label: "HR Manager", midLabel: "HR Manager", shortLabel: "HR" },
              { id: "finance", label: "Finance Admin", midLabel: "Finance", shortLabel: "Fin" },
              { id: "admin", label: "System Admin", midLabel: "Admin", shortLabel: "Adm" },
              { id: "licensee", label: "License Holder", midLabel: "License", shortLabel: "Lic" },
            ].map(role => (
              <button
                key={role.id}
                onClick={() => setActiveRole(role.id as RoleType)}
                className={`relative z-40 flex-shrink-0 rounded-xl px-1.5 py-1.5 sm:px-2.5 sm:py-2 lg:px-4 lg:py-2.5 text-[8px] sm:text-[10px] lg:text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                  activeRole === role.id
                    ? "bg-white text-zinc-950 border border-zinc-200/60 shadow-[0_4px_12px_rgba(0,0,0,0.06)] dark:bg-zinc-800 dark:text-white dark:border-zinc-700/50 dark:shadow-[0_4px_12px_rgba(0,0,0,0.25)]"
                    : "border border-transparent text-zinc-550 hover:text-zinc-900 hover:bg-white/40 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-900/30"
                }`}
              >
                <span className="hidden lg:inline">{role.label}</span>
                <span className="hidden sm:inline lg:hidden">{role.midLabel}</span>
                <span className="inline sm:hidden">{role.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Live Mock Console View */}
        <div className="mx-auto max-w-[80rem] rounded-2xl border border-zinc-200 bg-white/60 p-8 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/20 transition duration-300 hover:border-zinc-300 dark:hover:border-zinc-800 relative overflow-hidden group">
          <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-indigo-500/5 dark:bg-indigo-500/2 blur-2xl pointer-events-none" />
          <div className="mb-6 flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider font-mono dark:text-zinc-350 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
              {activeRole === "employee" && "EMPLOYEE WORKSPACE"}
              {activeRole === "manager" && "TEAM MANAGER WORKSPACE"}
              {activeRole === "hr" && "HR MANAGER WORKSPACE"}
              {activeRole === "finance" && "FINANCE ADMIN WORKSPACE"}
              {activeRole === "admin" && "SYSTEM ADMIN WORKSPACE"}
              {activeRole === "licensee" && "LICENSE HOLDER WORKSPACE"}
            </span>
            <span className="text-xs font-bold text-emerald-650 border border-emerald-500/20 px-2.5 py-0.5 rounded uppercase font-mono dark:text-emerald-400 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/10">
              ACTIVE CONSOLE PREVIEW
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            {ROLE_FEATURES[activeRole].map((feature, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-zinc-200 bg-white/40 p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-indigo-500/25 hover:bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/10 dark:hover:border-indigo-400/20 dark:hover:bg-zinc-900/20 group flex flex-col justify-between relative overflow-hidden"
              >
                <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/0 via-indigo-500/0 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:border-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-900">
                    <Icon name={feature.icon} className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="mt-4 text-xs sm:text-sm font-bold uppercase tracking-wider font-mono text-zinc-800 dark:text-zinc-100">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-xs text-zinc-550 leading-relaxed dark:text-zinc-350 font-mono">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="relative z-10 mx-auto w-full max-w-[90rem] px-6 lg:px-12 py-16 border-t border-zinc-200 dark:border-zinc-900 overflow-visible">
        <div className="mb-16 text-center">
          <h2 className="font-heading text-3xl font-extrabold sm:text-4xl text-zinc-900 dark:text-white">
            Flexible Pricing For Every Team
          </h2>
          <p className="mt-4 text-sm text-zinc-650 dark:text-zinc-400 max-w-xl mx-auto">
            Choose the right plan for your organization and scale as your workforce grows.
          </p>
        </div>

        {/* Workspace Capacity & Billing Switch */}
        <div className="mx-auto max-w-4xl mb-12 rounded-3xl border border-zinc-200/80 bg-white/60 p-8 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/30 relative overflow-hidden group">
          <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-indigo-500/5 dark:bg-indigo-500/2 blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 relative z-10">
            <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest font-mono dark:text-zinc-355">
              Workspace Capacity
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="500"
                value={seatsInput}
                onChange={(e) => {
                  setSeatsInput(e.target.value);
                  const val = Number(e.target.value);
                  if (!isNaN(val) && e.target.value !== "") setSeats(Math.min(500, Math.max(0, val)));
                }}
                onBlur={() => {
                  const val = Number(seatsInput);
                  const clamped = isNaN(val) ? 0 : Math.min(500, Math.max(0, val));
                  setSeats(clamped);
                  setSeatsInput(String(clamped));
                }}
                className="w-20 text-right text-2xl font-black bg-transparent border-b-2 border-indigo-500/40 focus:border-indigo-500 outline-none text-zinc-900 dark:text-white font-mono transition-colors duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-2xl font-black text-zinc-900 dark:text-white font-mono">Users</span>
            </div>
          </div>

          {/* Minimum users warning */}
          {seats < 10 && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-500/20 animate-fade-in relative z-10">
              <svg className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono tracking-wide">
                Minimum 10 users required
              </span>
            </div>
          )}

          {/* Slider input */}
          <div className="relative mb-8 z-10">
            <input
              type="range"
              min="10"
              max="500"
              value={seats}
              onChange={(e) => { const v = Number(e.target.value); setSeats(v); setSeatsInput(String(v)); }}
              className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer metallic-slider"
              style={{
                background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${((seats - 10) / 490) * 100}%, ${theme === "dark" ? "#27272a" : "#e4e4e7"} ${((seats - 10) / 490) * 100}%, ${theme === "dark" ? "#27272a" : "#e4e4e7"} 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-zinc-550 dark:text-zinc-400 font-mono mt-3">
              <span>10 USERS</span>
              <span>500 USERS</span>
            </div>
          </div>

          {/* Billing Switch */}
          <div className="flex justify-center items-center gap-4 mt-4 relative z-10">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`text-xs font-bold font-mono tracking-wider transition-colors duration-200 ${
                billingPeriod === "monthly" ? "text-zinc-900 dark:text-white" : "text-zinc-550 dark:text-zinc-400"
              }`}
            >
              MONTHLY
            </button>
            
            <button
              onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "annual" : "monthly")}
              className="relative inline-flex h-6 w-12 items-center rounded-full bg-zinc-200 transition-colors duration-300 dark:bg-zinc-800 focus:outline-none"
              aria-label="Toggle billing period"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-md ${
                  billingPeriod === "annual" ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>

            <button
              onClick={() => setBillingPeriod("annual")}
              className={`text-xs font-bold font-mono tracking-wider transition-colors duration-200 ${
                billingPeriod === "annual" ? "text-zinc-900 dark:text-white" : "text-zinc-550 dark:text-zinc-400"
              }`}
            >
              ANNUAL (20% SAVE)
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-8 md:grid-cols-3 items-stretch max-w-[80rem] mx-auto overflow-visible">
          
          {/* Starter */}
          <div className="rounded-2xl border border-zinc-200 bg-white/50 p-8 flex flex-col justify-between dark:border-zinc-800 dark:bg-zinc-900/20 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] hover:border-indigo-500/20 dark:hover:border-indigo-400/15 group relative overflow-hidden">
            <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/0 via-indigo-500/0 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <span className="text-xs font-bold text-zinc-650 uppercase tracking-widest block mb-1 font-mono dark:text-zinc-350">Starter</span>
              <div className="text-3xl font-bold text-zinc-900 dark:text-white font-heading">
                ₹{Math.round(seats * 30 * (billingPeriod === "annual" ? 12 * 0.8 : 1.0)).toLocaleString("en-IN")}{" "}
                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-450 font-mono">
                  {billingPeriod === "annual" ? "/ annual" : "/ month"}
                </span>
              </div>

              <ul className="mt-6 space-y-3.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-mono">
                <li>• Daily & weekly timesheets</li>
                <li>• Basic leave management</li>
                <li>• Single-level approvals</li>
                <li>• Employee dashboard</li>
                <li>• Standard reports</li>
                <li>• Up to 10 team members</li>
              </ul>
            </div>
            <button
              onClick={() => seats >= 10 && openWizard("starter")}
              disabled={seats < 10}
              title={seats < 10 ? "Minimum 10 users required" : undefined}
              className={`mt-8 w-full rounded-xl border py-3 text-xs font-bold uppercase tracking-wider transition duration-200 relative z-10 ${
                seats < 10
                  ? "border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed opacity-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-600"
                  : "border-zinc-200 bg-white text-zinc-750 hover:bg-zinc-50 hover:scale-[1.02] active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-850"
              }`}
            >
              Get Started
            </button>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border border-zinc-200 bg-white/50 p-8 flex flex-col justify-between dark:border-zinc-800 dark:bg-zinc-900/20 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] hover:border-indigo-500/20 dark:hover:border-indigo-400/15 group relative overflow-hidden">
            <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/0 via-indigo-500/0 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <span className="text-xs font-bold text-zinc-650 uppercase tracking-widest block mb-1 font-mono dark:text-zinc-350">Professional</span>
              <div className="text-3xl font-bold text-zinc-900 dark:text-white font-heading">
                ₹{Math.round(seats * 75 * (billingPeriod === "annual" ? 12 * 0.8 : 1.0)).toLocaleString("en-IN")}{" "}
                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-450 font-mono">
                  {billingPeriod === "annual" ? "/ annual" : "/ month"}
                </span>
              </div>

              <ul className="mt-6 space-y-3.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-mono">
                <li>• Multi-level timesheet approvals</li>
                <li>• Advanced leave workflows</li>
                <li>• Team & department management</li>
                <li>• Project and task tracking</li>
                <li>• Payroll processing</li>
                <li>• Real-time team chat</li>
                <li>• Finance & productivity reports</li>
                <li>• Up to 50 team members</li>
              </ul>
            </div>
            <button
              onClick={() => seats >= 10 && openWizard("professional")}
              disabled={seats < 10}
              title={seats < 10 ? "Minimum 10 users required" : undefined}
              className={`mt-8 w-full rounded-xl border py-3 text-xs font-bold uppercase tracking-wider transition duration-200 relative z-10 ${
                seats < 10
                  ? "border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed opacity-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-600"
                  : "border-zinc-200 bg-white text-zinc-750 hover:bg-zinc-50 hover:scale-[1.02] active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-850"
              }`}
            >
              Get Started
            </button>
          </div>

          {/* Enterprise */}
          <div className="rounded-2xl border border-zinc-200 bg-white/50 p-8 flex flex-col justify-between dark:border-zinc-800 dark:bg-zinc-900/20 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] hover:border-indigo-500/20 dark:hover:border-indigo-400/15 group relative overflow-hidden">
            <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/0 via-indigo-500/0 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <span className="text-xs font-bold text-zinc-650 uppercase tracking-widest block mb-1 font-mono dark:text-zinc-350">Enterprise</span>
              <div className="text-3xl font-bold text-zinc-900 dark:text-white font-heading">Custom Pricing</div>
              <ul className="mt-6 space-y-3.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-mono">
                <li>• Organization-wide workforce management</li>
                <li>• Advanced RBAC permissions</li>
                <li>• Multi-tenant workspace infrastructure</li>
                <li>• SSO / SAML authentication</li>
                <li>• Audit logs & compliance controls</li>
                <li>• Dedicated support & SLA</li>
                <li>• Custom integrations & APIs</li>
                <li>• Unlimited team scaling</li>
              </ul>
            </div>
            <button
              onClick={() => setContactSalesOpen(true)}
              className="mt-8 w-full rounded-xl border border-zinc-200 bg-white py-3 text-xs font-bold uppercase tracking-wider text-zinc-750 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-850 transition duration-200 hover:scale-[1.02] active:scale-[0.98] relative z-10"
            >
              Contact Sales
            </button>
          </div>

        </div>
      </section>

      {/* Enterprise Security Section */}
      <section id="security" className="relative z-10 mx-auto max-w-[90rem] px-6 lg:px-12 py-16 border-t border-zinc-200 dark:border-zinc-900">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center max-w-[80rem] mx-auto">
          <div>
            <h2 className="font-heading text-3xl font-extrabold text-zinc-900 dark:text-white">
              Data Security & Compliance
            </h2>
            <p className="mt-6 text-base text-zinc-750 dark:text-zinc-300 leading-relaxed">
              Arkia ensures isolated organizational configurations, tracking all workforce logs inside secure audit trails designed for compliance readiness.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white/40 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/10 hover:border-indigo-500/25 dark:hover:border-indigo-400/20 transition-all duration-300">
              <h4 className="font-bold text-xs uppercase tracking-wider font-mono text-indigo-650 dark:text-indigo-400">Access Controls</h4>
              <p className="text-xs text-zinc-655 mt-2 dark:text-zinc-350">Role-based access logs tracking modifications dynamically.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white/40 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/10 hover:border-indigo-500/25 dark:hover:border-indigo-400/20 transition-all duration-300">
              <h4 className="font-bold text-xs uppercase tracking-wider font-mono text-indigo-650 dark:text-indigo-400">Audit Logging</h4>
              <p className="text-xs text-zinc-655 mt-2 dark:text-zinc-355">Comprehensive activity logs compiled for reporting reviews.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Drawer Accordion */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 lg:px-12 py-16 border-t border-zinc-200 dark:border-zinc-900">
        <h2 className="font-heading text-3xl font-extrabold text-zinc-900 dark:text-white text-center mb-16">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {[
            { q: "How is data isolation structured?", a: "Each organization instance receives segregated schemas inside the database, keeping queries and transactions strictly isolated." },
            { q: "Can we build custom leave approval chains?", a: "Yes. Workspace managers can define multi-tier approval configurations matching their internal policies." },
            { q: "What security compliance targets are active?", a: "Arkia tracks all system actions on audit tables, built on encryption standards that align with SOC-2 policies." },
          ].map((item, idx) => (
            <div key={idx} className="rounded-xl border border-zinc-200 bg-white/30 dark:border-zinc-800 dark:bg-zinc-900/10 overflow-hidden hover:border-indigo-500/20 transition duration-300">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex justify-between items-center px-6 py-5 text-left font-bold text-xs sm:text-sm uppercase tracking-wider hover:bg-zinc-100/50 text-zinc-800 transition dark:hover:bg-zinc-900/40 dark:text-zinc-200"
              >
                <span>{item.q}</span>
                <span>{openFaq === idx ? "−" : "+"}</span>
              </button>
              {openFaq === idx && (
                <div className="px-6 pb-5 text-xs sm:text-sm text-zinc-650 leading-relaxed border-t border-zinc-200 dark:border-zinc-800 pt-3 bg-zinc-50/50 dark:bg-zinc-900/20 dark:text-zinc-300">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-200 px-6 py-12 bg-zinc-100/50 dark:border-zinc-900 dark:bg-zinc-950">
        <div className="mx-auto max-w-[90rem] flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-zinc-500 lg:px-6">
          <div className="flex items-center gap-2 font-mono">
            <span className="font-bold text-zinc-800 dark:text-zinc-300">{BRAND_NAME}</span>
            <span>&copy; {new Date().getFullYear()}. All rights reserved.</span>
          </div>
          <div className="flex gap-6 font-mono font-bold uppercase tracking-wider text-xs">
            <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition">Privacy</a>
            <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition">Terms</a>
            <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition">Uptime SLA</a>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
};
