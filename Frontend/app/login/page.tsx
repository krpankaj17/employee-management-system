"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  X,
  ShieldCheck,
  Building2,
  WalletCards,
  Clock,
  Check,
} from "lucide-react";
import {
  authenticateWithCredentials,
  registerNewUser,
} from "@/lib/auth";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/apiClient";

export default function LoginPage() {
  const router = useRouter();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [signupOtp, setSignupOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [signupCooldown, setSignupCooldown] = useState(0);
  const [signupOtpLoading, setSignupOtpLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupSuccessMsg, setSignupSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Forgot Password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<"request" | "verify" | "success">("request");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState("");

  // Clean URL query and handle expired session alert
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isIntentional =
        sessionStorage.getItem("ems_intentional_logout") === "true" ||
        sessionStorage.getItem("ems_logged_out") === "true";

      if (isIntentional) {
        sessionStorage.removeItem("ems_intentional_logout");
        sessionStorage.removeItem("ems_logged_out");
        if (window.location.search.includes("session_expired")) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        return;
      }

      const token = localStorage.getItem("ems_access_token");
      if (token && (!token.includes(".") || token.split(".").length !== 3)) {
        localStorage.removeItem("ems_access_token");
        localStorage.removeItem("ems_refresh_token");
      }

      if (window.location.search.includes("session_expired=true")) {
        setLoginError("Your session has expired. Please sign in with your corporate credentials.");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Cooldown timers
  useEffect(() => {
    let interval: any = null;
    if (signupCooldown > 0) {
      interval = setInterval(() => {
        setSignupCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [signupCooldown]);

  useEffect(() => {
    let interval: any = null;
    if (forgotCooldown > 0) {
      interval = setInterval(() => {
        setForgotCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [forgotCooldown]);

  const handleSendSignupOtp = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setLoginError("Please enter a valid corporate email address (e.g. name@company.com).");
      return;
    }
    setLoginError(null);
    setSignupOtpLoading(true);
    try {
      const res = await api.auth.sendOtp({ email: trimmed, purpose: "signup" });
      setOtpSent(true);
      const cooldownSecs = res.resend_in_seconds || res.expires_in_seconds || res.retry_after || 150;
      setSignupCooldown(cooldownSecs);
      setSignupOtp("");
    } catch (err: any) {
      setLoginError(err.message || "Failed to dispatch email verification code.");
    } finally {
      setSignupOtpLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setSignupSuccessMsg(null);

    const trimmedEmail = email.trim();

    // Registration Flow Validation
    if (isRegisterMode) {
      if (!displayName.trim()) {
        setLoginError("Please enter your full name.");
        return;
      }
      if (!trimmedEmail || !trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
        setLoginError("Please enter a valid corporate email address (e.g. name@company.com).");
        return;
      }
      if (!signupOtp || signupOtp.trim().length !== 6) {
        setLoginError("Please enter the 6-digit email verification code.");
        return;
      }
      if (!password || password.length < 6) {
        setLoginError("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setLoginError("Passwords do not match. Please verify.");
        return;
      }

      setLoading(true);
      try {
        const regResult = await registerNewUser(displayName, trimmedEmail, password, signupOtp);
        setLoading(false);
        if (!regResult.ok) {
          setLoginError(regResult.message);
          return;
        }
        setSignupSuccessMsg(
          "Account registered successfully! You can now sign in with your corporate credentials."
        );
        setIsRegisterMode(false);
        setDisplayName("");
        setConfirmPassword("");
        setSignupOtp("");
        setOtpSent(false);
      } catch (err: any) {
        setLoading(false);
        setLoginError(err.message || "Failed to register account.");
      }
      return;
    }

    // Login Flow Validation
    if (!trimmedEmail || !trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      setLoginError("Please enter your corporate email address.");
      return;
    }
    if (!password) {
      setLoginError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const authResult = await authenticateWithCredentials(trimmedEmail, password);
      setLoading(false);

      if (!authResult.ok) {
        setLoginError(authResult.message);
        return;
      }

      if (authResult.isPending) {
        router.push("/onboarding-pending");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setLoading(false);
      setLoginError(err.message || "Invalid credentials. Please verify your email and password.");
    }
  };

  const openForgotPassword = () => {
    setForgotEmail(email.trim() || "");
    setForgotStep("request");
    setForgotError(null);
    setForgotOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
    setIsForgotModalOpen(true);
  };

  const handleRequestResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    const trimmed = forgotEmail.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setForgotError("Please enter a valid corporate email address.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await api.auth.forgotPassword({ email: trimmed });
      setForgotSuccessMsg(res.message);
      const cooldownSecs = res.resend_in_seconds || res.expires_in_seconds || res.retry_after || 150;
      setForgotCooldown(cooldownSecs);
      setForgotOtp("");
      setForgotStep("verify");
    } catch (err: any) {
      setForgotError(err.message || "Failed to dispatch reset verification code.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setForgotError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError("New passwords do not match. Please verify.");
      return;
    }
    if (!forgotOtp || forgotOtp.trim().length !== 6) {
      setForgotError("Verification code must be 6 digits.");
      return;
    }
    setForgotError(null);
    setForgotLoading(true);
    try {
      await api.auth.resetPassword({
        email: forgotEmail.trim(),
        otp_code: forgotOtp.trim(),
        new_password: newPassword,
      });
      setForgotStep("success");
    } catch (err: any) {
      setForgotError(err.message || "Failed to reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="web-auth-page">
      {/* ── Enterprise Website Navigation Bar ── */}
      <header className="web-auth-header">
        <div className="web-auth-header-inner">
          <div className="web-auth-brand">
            <div className="web-auth-brand-badge">
              <ShieldCheck size={20} color="#111827" strokeWidth={2.4} />
            </div>
            <div>
              <span className="web-auth-brand-title">Employee Management System</span>
              <span className="web-auth-brand-tag">Enterprise Edition</span>
            </div>
          </div>
          <div className="web-auth-header-right">
            <span className="web-auth-status-pill">
              <span className="web-auth-status-dot" />
              All Systems Operational
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Responsive Website Split Layout ── */}
      <main className="web-auth-main">
        <div className="web-auth-grid">
          {/* Left Column: Enterprise Value Showcase */}
          <div className="web-auth-hero">
            <div className="web-auth-pill-chip">
              ✨ Enterprise Workforce & Payroll Architecture
            </div>
            <h1 className="web-auth-headline">
              Streamline enterprise workforce operations & payroll.
            </h1>
            <p className="web-auth-subhead">
              Single unified portal for automated salary disbursements, attendance tracking, leave requests, and RBAC governance.
            </p>

            {/* Feature Bento Showcase */}
            <div className="web-auth-features">
              <div className="web-auth-feature-item">
                <div className="web-auth-feature-icon">
                  <WalletCards size={18} />
                </div>
                <div>
                  <h2 className="web-auth-feature-title">Salary & Batch Payroll</h2>
                  <p className="web-auth-feature-desc">
                    Calculates base compensation, bonuses, statutory deductions, and automated payout disbursement records.
                  </p>
                </div>
              </div>

              <div className="web-auth-feature-item">
                <div className="web-auth-feature-icon">
                  <Clock size={18} />
                </div>
                <div>
                  <h2 className="web-auth-feature-title">Real-Time Attendance & Leaves</h2>
                  <p className="web-auth-feature-desc">
                    Biometric-compatible shift check-ins, automated leave ledger tracking, and instant manager approvals.
                  </p>
                </div>
              </div>

              <div className="web-auth-feature-item">
                <div className="web-auth-feature-icon">
                  <Building2 size={18} />
                </div>
                <div>
                  <h2 className="web-auth-feature-title">Governance & Audit Security</h2>
                  <p className="web-auth-feature-desc">
                    Granular role-based access control with complete audit trails and SOC-2 compliant verification.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: High-End Web Authentication Form */}
          <div className="web-auth-form-card">
            {/* Mode Switcher Tabs */}
            <div className="web-auth-tabs">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(false);
                  setLoginError(null);
                  setSignupSuccessMsg(null);
                }}
                className={`web-auth-tab ${!isRegisterMode ? "active" : ""}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(true);
                  setLoginError(null);
                  setSignupSuccessMsg(null);
                }}
                className={`web-auth-tab ${isRegisterMode ? "active" : ""}`}
              >
                Register Profile
              </button>
            </div>

            <div className="web-auth-form-header">
              <h2 className="web-auth-form-title">
                {isRegisterMode ? "Create Corporate Account" : "Sign In to Workspace"}
              </h2>
              <p className="web-auth-form-subtitle">
                {isRegisterMode
                  ? "Enter your corporate credentials and verify your email"
                  : "Welcome back. Enter your credentials to continue"}
              </p>
            </div>

            {/* Alerts */}
            {signupSuccessMsg && (
              <div className="web-auth-alert-success">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{signupSuccessMsg}</span>
              </div>
            )}

            {loginError && (
              <div className="web-auth-alert-error">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLoginError(null)}
                  className="web-auth-alert-close"
                  title="Dismiss error"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="web-auth-form">
              {/* Full Name (Register Mode Only) */}
              {isRegisterMode && (
                <div className="web-auth-field">
                  <label className="web-auth-label">Full Name *</label>
                  <div className="web-auth-input-wrap">
                    <User size={16} className="web-auth-icon" />
                    <input
                      type="text"
                      id="name"
                      required
                      className="web-auth-input"
                      placeholder="e.g. Aditya Verma"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div className="web-auth-field">
                <label className="web-auth-label">Corporate Email *</label>
                <div className="web-auth-input-wrap">
                  <Mail size={16} className="web-auth-icon" />
                  <input
                    type="email"
                    id="email"
                    required
                    className="web-auth-input"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* 6-Digit OTP (Register Mode Only) */}
              {isRegisterMode && (
                <div className="web-auth-field">
                  <div className="flex justify-between items-center mb-1">
                    <label className="web-auth-label mb-0">6-Digit Verification OTP *</label>
                    <button
                      type="button"
                      onClick={handleSendSignupOtp}
                      disabled={signupCooldown > 0 || signupOtpLoading}
                      className="web-auth-text-btn"
                    >
                      {signupOtpLoading ? (
                        <>
                          <Loader2 size={12} className="animate-spin inline mr-1" />
                          Sending...
                        </>
                      ) : signupCooldown > 0 ? (
                        `Resend in ${signupCooldown}s`
                      ) : otpSent ? (
                        "Resend OTP"
                      ) : (
                        "Send Verification OTP"
                      )}
                    </button>
                  </div>
                  <div className="web-auth-input-wrap">
                    <KeyRound size={16} className="web-auth-icon" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      className="web-auth-input font-mono"
                      placeholder="Enter 6-digit OTP"
                      value={signupOtp}
                      onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      style={{ letterSpacing: "0.2em" }}
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              <div className="web-auth-field">
                <div className="flex justify-between items-center mb-1">
                  <label className="web-auth-label mb-0">Password *</label>
                  {!isRegisterMode && (
                    <button
                      type="button"
                      onClick={openForgotPassword}
                      className="web-auth-link-btn"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="web-auth-input-wrap">
                  <Lock size={16} className="web-auth-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    required
                    className="web-auth-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="web-auth-eye-btn"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (Register Mode Only) */}
              {isRegisterMode && (
                <div className="web-auth-field">
                  <label className="web-auth-label">Confirm Password *</label>
                  <div className="web-auth-input-wrap">
                    <Lock size={16} className="web-auth-icon" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      className="web-auth-input"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="web-auth-eye-btn"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Remember Me Checkbox */}
              {!isRegisterMode && (
                <div className="web-auth-remember">
                  <label className="web-auth-checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="web-auth-checkbox"
                    />
                    <span>Remember this device for 30 days</span>
                  </label>
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="web-auth-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : isRegisterMode ? (
                  <>
                    <span>Create Corporate Profile</span>
                    <ArrowRight size={16} />
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* ── Enterprise Footer ── */}
      <footer className="web-auth-footer">
        <p>
          © 2026 Employee Management System. Enterprise grade architecture • 256-bit encryption.
        </p>
      </footer>

      {/* ── Forgot Password Modal ── */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Reset Account Password"
      >
        {forgotStep === "request" && (
          <form onSubmit={handleRequestResetOtp}>
            <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: 16 }}>
              Enter your registered corporate email to receive a 6-digit verification code.
            </p>
            {forgotError && (
              <div className="web-auth-alert-error" style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertCircle size={15} /> {forgotError}
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Corporate Email Address *</label>
              <input
                type="email"
                required
                className="input-field"
                placeholder="name@company.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={forgotLoading}
                className="btn btn-primary"
              >
                {forgotLoading ? "Sending OTP..." : "Send Verification OTP"}
              </button>
            </div>
          </form>
        )}

        {forgotStep === "verify" && (
          <form onSubmit={handleConfirmReset}>
            <div className="web-auth-alert-success" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} /> {forgotSuccessMsg}
              </div>
            </div>
            {forgotError && (
              <div className="web-auth-alert-error" style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertCircle size={15} /> {forgotError}
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">6-Digit OTP Code *</label>
              <input
                type="text"
                required
                maxLength={6}
                className="input-field font-mono"
                placeholder="123456"
                value={forgotOtp}
                onChange={(e) => setForgotOtp(e.target.value)}
                style={{ letterSpacing: "0.15em" }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">New Password *</label>
              <input
                type="password"
                required
                className="input-field"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password *</label>
              <input
                type="password"
                required
                className="input-field"
                placeholder="••••••••"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {forgotCooldown > 0 ? `Resend OTP in ${forgotCooldown}s` : ""}
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setForgotStep("request")}
                  className="btn btn-secondary"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="btn btn-primary"
                >
                  {forgotLoading ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </div>
          </form>
        )}

        {forgotStep === "success" && (
          <div style={{ textAlign: "center", padding: "20px 10px" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              Password Reset Complete
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
              Your password has been updated. You can now sign in with your new credentials.
            </p>
            <button
              onClick={() => {
                setIsForgotModalOpen(false);
                setPassword(newPassword);
              }}
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
            >
              Return to Sign In
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
