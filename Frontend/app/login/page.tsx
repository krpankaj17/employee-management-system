"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Check,
} from "lucide-react";
import {
  authenticateWithCredentials,
  registerNewUser,
} from "@/lib/auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
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

  // Ref for 3D tilt
  const cardRef = useRef<HTMLDivElement>(null);

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
        setLoginError("Your previous session has expired or was invalid. Please sign in with your corporate credentials.");
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

  // 3D Tilt & Cursor tracking on Card
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const rotateX = ((y - cy) / cy) * -6;
      const rotateY = ((x - cx) / cx) * 6;

      const withinCard = x >= -60 && x <= rect.width + 60 && y >= -60 && y <= rect.height + 60;

      if (withinCard) {
        card.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(0)`;
        card.style.setProperty("--mx", `${((x / rect.width) * 100).toFixed(1)}%`);
        card.style.setProperty("--my", `${((y / rect.height) * 100).toFixed(1)}%`);
      } else {
        card.style.transform = "rotateX(0deg) rotateY(0deg)";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Ripple effect on button click
  const handleButtonRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    const size = Math.max(rect.width, rect.height) * 1.5;
    ripple.className = "glass-ripple";
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(ripple);
    setTimeout(() => {
      ripple.remove();
    }, 650);
  };

  const handleSendSignupOtp = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setLoginError("Please enter your corporate email address first.");
      return;
    }
    if (!trimmed.includes("@") || !trimmed.includes(".")) {
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
      if (err.retryAfter && err.retryAfter > 0) {
        setOtpSent(true);
        setSignupCooldown(err.retryAfter);
      } else {
        const match = (err.message || "").match(/wait\s+(\d+)\s+seconds/i);
        if (match) {
          setOtpSent(true);
          setSignupCooldown(parseInt(match[1], 10));
        }
      }
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
      if (!trimmedEmail) {
        setLoginError("Please enter your corporate email address.");
        return;
      }
      if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
        setLoginError("Please enter a valid corporate email address (e.g. name@company.com).");
        return;
      }
      if (!signupOtp || signupOtp.trim().length !== 6) {
        setLoginError("Please enter the 6-digit email verification code.");
        return;
      }
      if (!password) {
        setLoginError("Please enter a password.");
        return;
      }
      if (password.length < 6) {
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
          "Account registered successfully! Your email has been verified. You can now sign in with your credentials."
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
    if (!trimmedEmail) {
      setLoginError("Please enter your corporate email address.");
      return;
    }
    if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      setLoginError("Please enter a valid corporate email address (e.g. name@company.com).");
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
      setLoginError(err.message || "Invalid corporate email or password. Please verify your credentials.");
    }
  };

  // Forgot Password Helpers
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
      if (err.retryAfter && err.retryAfter > 0) {
        setForgotCooldown(err.retryAfter);
      } else {
        const match = (err.message || "").match(/wait\s+(\d+)\s+seconds/i);
        if (match) {
          setForgotCooldown(parseInt(match[1], 10));
        }
      }
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
    <div className="glass-scene" id="scene">
      {/* ── Atmospheric Ambient Orbs (Matching Application Brand Theme) ── */}
      <div className="glass-blob b1" />
      <div className="glass-blob b2" />
      <div className="glass-blob b3" />

      {/* Floating Theme Toggle (Top Right) */}
      <div className="glass-theme-toggle-wrap">
        <ThemeToggle />
      </div>

      {/* ── Centered Glass Card (Single Card, No Split Screen) ── */}
      <div className="glass-center-container">
        <div className="glass-card" id="card" ref={cardRef}>
          {/* Brand Header */}
          <div className="glass-card-brand">
            <div className="glass-card-mark">
              <ShieldCheck size={20} color="#ffffff" strokeWidth={2.4} />
            </div>
            <div className="glass-card-brand-name">Employee Management System</div>
          </div>

          <h1 className="glass-card-title">
            {isRegisterMode ? "Create Account" : "Welcome back"}
          </h1>
          <p className="glass-card-sub">
            {isRegisterMode
              ? "Register your self-service employee profile"
              : "Sign in to your employee account"}
          </p>

          {/* Success Alert Banner */}
          {signupSuccessMsg && (
            <div className="glass-alert-success">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{signupSuccessMsg}</span>
            </div>
          )}

          {/* Error Alert Banner */}
          {loginError && (!isRegisterMode || !loginError.includes("session has expired")) && (
            <div className="glass-alert-error">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
              <button
                type="button"
                onClick={() => setLoginError(null)}
                className="glass-alert-close"
                title="Dismiss error"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Authentication Form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* Full Name (Register Mode Only) */}
            {isRegisterMode && (
              <div className="glass-field">
                <label className="glass-label">Full Name *</label>
                <div className="glass-input-box">
                  <User size={16} className="glass-input-icon" />
                  <input
                    type="text"
                    id="name"
                    required
                    className="glass-input"
                    placeholder="e.g. Aditya Verma"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Corporate Email Field */}
            <div className="glass-field">
              <label className="glass-label">Corporate Email Address *</label>
              <div className="glass-input-box">
                <Mail size={16} className="glass-input-icon" />
                <input
                  type="email"
                  id="email"
                  required
                  className="glass-input"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Email OTP Verification (Register Mode Only) */}
            {isRegisterMode && (
              <div className="glass-field">
                <div className="flex justify-between items-center mb-1 px-0.5">
                  <label className="glass-label mb-0">6-Digit OTP Code *</label>
                  <button
                    type="button"
                    onClick={handleSendSignupOtp}
                    disabled={signupCooldown > 0 || signupOtpLoading}
                    className="glass-text-btn flex items-center gap-1.5"
                    style={{ cursor: (signupCooldown > 0 || signupOtpLoading) ? "not-allowed" : "pointer" }}
                  >
                    {signupOtpLoading ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : signupCooldown > 0 ? (
                      `Resend in ${signupCooldown}s`
                    ) : otpSent ? (
                      "Resend OTP"
                    ) : (
                      "Send OTP"
                    )}
                  </button>
                </div>
                <div className="glass-input-box">
                  <KeyRound size={16} className="glass-input-icon" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    className="glass-input"
                    placeholder="Enter 6-digit OTP"
                    value={signupOtp}
                    onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    style={{ letterSpacing: "0.2em", fontFamily: "var(--font-mono)" }}
                    autoComplete="one-time-code"
                  />
                </div>
              </div>
            )}

            {/* Password Field */}
            <div className="glass-field">
              <div className="flex justify-between items-center mb-1 px-0.5">
                <label className="glass-label mb-0">Password *</label>
                {!isRegisterMode && (
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="glass-link-btn"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="glass-input-box">
                <Lock size={16} className="glass-input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  required
                  className="glass-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="glass-eye-btn"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Register Mode Only) */}
            {isRegisterMode && (
              <div className="glass-field">
                <label className="glass-label">Confirm Password *</label>
                <div className="glass-input-box">
                  <KeyRound size={16} className="glass-input-icon" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    className="glass-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="glass-eye-btn"
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Remember Me Checkbox (Login Mode Only) */}
            {!isRegisterMode && (
              <div className="glass-row">
                <label className="glass-remember">
                  <span className={`glass-custom-checkbox ${rememberMe ? "checked" : ""}`}>
                    {rememberMe && <Check size={11} strokeWidth={3.2} />}
                  </span>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
                  />
                  <span>Remember me on this workstation</span>
                </label>
              </div>
            )}

            {/* Liquid Gradient Sweep Submit Button with Ripple */}
            <button
              type="submit"
              disabled={loading}
              className="glass-submit"
              id="loginBtn"
              onClick={handleButtonRipple}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Authenticating credentials...</span>
                </>
              ) : (
                <>
                  <span>{isRegisterMode ? "Complete Registration" : "Sign In to Portal"}</span>
                  <ArrowRight size={16} className="glass-btn-arrow" />
                </>
              )}
            </button>
          </form>

          {/* Bottom Switcher */}
          <div className="glass-footer-text">
            {isRegisterMode ? "Already have an account?" : "Don't have an account yet?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setLoginError(null);
                setSignupSuccessMsg(null);
              }}
              className="glass-switch-btn"
            >
              {isRegisterMode ? "Sign in" : "Sign up"}
            </button>
          </div>
        </div>

        {/* Subtle Watermark */}
        <div className="glass-watermark">
          <Lock size={12} style={{ opacity: 0.65 }} />
          <span>Employee Management System</span>
        </div>
      </div>

      {/* ── Forgot Password Modal ── */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Reset Account Password"
      >
        {forgotStep === "request" && (
          <form onSubmit={handleRequestResetOtp}>
            <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: 16 }}>
              Enter your corporate email address. We will dispatch a 6-digit verification code to reset your credentials.
            </p>
            {forgotError && (
              <div className="glass-alert-error" style={{ marginBottom: 14 }}>
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
            <div className="glass-alert-success" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} /> {forgotSuccessMsg}
              </div>
            </div>
            {forgotError && (
              <div className="glass-alert-error" style={{ marginBottom: 14 }}>
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
                className="input-field"
                placeholder="123456"
                value={forgotOtp}
                onChange={(e) => setForgotOtp(e.target.value)}
                style={{ letterSpacing: "0.15em", fontFamily: "var(--font-mono)" }}
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
                color: "#34d399",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, fontFamily: "'Outfit', sans-serif" }}>
              Password Reset Complete
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
              Your corporate password has been updated. You can now sign in with your new credentials.
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
