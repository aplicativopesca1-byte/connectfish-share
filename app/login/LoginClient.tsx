// 📂 app/login/LoginClient.tsx
"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type Mode = "login" | "register" | "reset";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function buildSafeUsernameFromUser(user: any) {
  const emailPrefix = user?.email?.split("@")?.[0] || "";
  const displayName = user?.displayName || "";
  const base = emailPrefix || displayName || "usuario";

  const normalized = String(base)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");

  return normalized.length >= 3
    ? normalized
    : `user_${user?.uid?.slice(0, 6) || "cf"}`;
}

async function loadFirebaseAuth() {
  const [{ auth }, fbAuth] = await Promise.all([
    import("@/lib/firebase"),
    import("firebase/auth"),
  ]);

  return {
    auth,
    browserLocalPersistence: fbAuth.browserLocalPersistence,
    setPersistence: fbAuth.setPersistence,
    signInWithEmailAndPassword: fbAuth.signInWithEmailAndPassword,
    createUserWithEmailAndPassword: fbAuth.createUserWithEmailAndPassword,
    sendPasswordResetEmail: fbAuth.sendPasswordResetEmail,
    GoogleAuthProvider: fbAuth.GoogleAuthProvider,
    OAuthProvider: fbAuth.OAuthProvider,
    signInWithPopup: fbAuth.signInWithPopup,
  };
}

async function loadFirestore() {
  const [{ db }, fs] = await Promise.all([
    import("@/lib/firebase"),
    import("firebase/firestore"),
  ]);

  return {
    db,
    doc: fs.doc,
    getDoc: fs.getDoc,
    setDoc: fs.setDoc,
  };
}

async function ensurePersistence() {
  try {
    const fb = await loadFirebaseAuth();
    await fb.setPersistence(fb.auth, fb.browserLocalPersistence);
  } catch (err) {
    console.error("[Login] setPersistence error:", err);
  }
}

async function ensureUserProfile(user: any, provider = "email") {
  if (!user?.uid) {
    throw new Error("Usuário inválido.");
  }

  const fs = await loadFirestore();
  const ref = fs.doc(fs.db, "users", user.uid);
  const snap = await fs.getDoc(ref);

  if (snap.exists()) return;

  const now = Date.now();

  await fs.setDoc(ref, {
    userId: user.uid,
    email: normalizeEmail(user.email || ""),
    username: buildSafeUsernameFromUser(user),
    createdAt: now,
    updatedAt: now,

    photoUrl: user.photoURL || null,
    bio: "",
    completedSetup: false,

    legal: {
      accepted: true,
      source: provider === "google" ? "login_google_web" : provider === "apple" ? "login_apple_web" : "register_email_web",
      acceptedAt: now,
      termsVersion: "current",
      privacyVersion: "current",
    },

    membership: {
      tier: "free",
      status: "inactive",
      provider,
      startedAt: null,
      expiresAt: null,
      autoRenew: false,
    },

    xpTotal: 0,
    level: 1,
    badges: [],

    stats: {
      totalPosts: 0,
      totalDistance: 0,
      totalTime: 0,
      totalFish: 0,
      biggestCatchLength: null,
      biggestCatchWeight: null,
    },

    region: {
      state: null,
      city: null,
      country: "Brasil",
    },

    usage: {
      fishingLogsMonthCount: 0,
      savedPinsCount: 0,
      currentMonthKey: null,
    },
  });
}

async function createServerSession(idToken: string) {
  const r = await fetch("/api/sessionLogin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ idToken }),
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    console.error("[/api/sessionLogin] response:", data);
    throw new Error(data?.error || `Falha ao criar sessão (${r.status}).`);
  }

  return true;
}

async function checkServerSession() {
  const r = await fetch("/api/sessionCheck", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });

  const data = await r.json().catch(() => ({}));
  const ok = Boolean((data && data.ok === true) || (data && data.uid));

  return { ok: r.ok && ok, data };
}

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const { refresh } = useAuth();

  const rawNext = sp.get("next") || "/seller";
  const next = rawNext.startsWith("/") ? rawNext : "/seller";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canLogin = useMemo(
    () => isValidEmail(email) && pass.length >= 6,
    [email, pass]
  );

  const canReset = useMemo(() => isValidEmail(email), [email]);

  async function finishAuthAndGo() {
    const check = await checkServerSession();

    if (!check.ok) {
      console.error("[sessionCheck] after auth:", check.data);
      throw new Error("session_not_persisted");
    }

    const ok = await refresh();

    if (!ok) {
      console.error("[AuthContext.refresh] did not return logged user");
      throw new Error("session_not_recognized");
    }

    router.replace(next);
    router.refresh();
  }

  function handleAuthError(e: unknown, fallback: string) {
    const code = String((e as any)?.code || "");
    const message = String((e as any)?.message || "");

    if (
      code.includes("auth/invalid-credential") ||
      code.includes("auth/wrong-password")
    ) {
      setErr("E-mail ou senha inválidos.");
    } else if (code.includes("auth/user-not-found")) {
      setErr("Usuário não encontrado. Crie uma conta.");
    } else if (code.includes("auth/email-already-in-use")) {
      setErr("Esse e-mail já está em uso. Faça login.");
    } else if (code.includes("auth/weak-password")) {
      setErr("Senha fraca. Use pelo menos 6 caracteres.");
    } else if (code.includes("auth/invalid-email")) {
      setErr("E-mail inválido.");
    } else if (code.includes("auth/popup-closed-by-user")) {
      setErr("Login cancelado.");
    } else if (code.includes("auth/popup-blocked")) {
      setErr("O navegador bloqueou o popup. Libere popups para continuar.");
    } else if (code.includes("auth/account-exists-with-different-credential")) {
      setErr("Já existe uma conta com esse e-mail usando outro método de login.");
    } else if (code.includes("auth/too-many-requests")) {
      setErr("Muitas tentativas. Aguarde um pouco e tente novamente.");
    } else if (message.includes("session_not_persisted")) {
      setErr(
        "Login ok, mas a sessão não ficou salva no site. Abra sempre pelo mesmo domínio."
      );
    } else if (message.includes("session_not_recognized")) {
      setErr(
        "Sessão criada, mas não foi reconhecida no site. Recarregue a página e tente novamente."
      );
    } else {
      console.error("[Login error]", e);
      setErr(fallback);
    }
  }

  async function doLogin() {
    try {
      setErr(null);
      setMsg(null);
      setLoading(true);

      await ensurePersistence();

      const fb = await loadFirebaseAuth();
      const cred = await fb.signInWithEmailAndPassword(
        fb.auth,
        normalizeEmail(email),
        pass
      );

      await ensureUserProfile(cred.user, "email");

      const idToken = await cred.user.getIdToken(true);
      await createServerSession(idToken);

      await finishAuthAndGo();
    } catch (e: unknown) {
      handleAuthError(e, "Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function doRegister() {
    try {
      setErr(null);
      setMsg(null);
      setLoading(true);

      await ensurePersistence();

      const fb = await loadFirebaseAuth();
      const cred = await fb.createUserWithEmailAndPassword(
        fb.auth,
        normalizeEmail(email),
        pass
      );

      await ensureUserProfile(cred.user, "email");

      const idToken = await cred.user.getIdToken(true);
      await createServerSession(idToken);

      await finishAuthAndGo();
    } catch (e: unknown) {
      handleAuthError(e, "Não foi possível criar a conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function doGoogleLogin() {
    try {
      setErr(null);
      setMsg(null);
      setSocialLoading("google");

      await ensurePersistence();

      const fb = await loadFirebaseAuth();
      const provider = new fb.GoogleAuthProvider();

      provider.setCustomParameters({
        prompt: "select_account",
      });

      const result = await fb.signInWithPopup(fb.auth, provider);
      const user = result.user;

      await ensureUserProfile(user, "google");

      const idToken = await user.getIdToken(true);
      await createServerSession(idToken);

      await finishAuthAndGo();
    } catch (e: unknown) {
      handleAuthError(e, "Não foi possível entrar com Google.");
    } finally {
      setSocialLoading(null);
    }
  }

  async function doAppleLogin() {
    try {
      setErr(null);
      setMsg(null);
      setSocialLoading("apple");

      await ensurePersistence();

      const fb = await loadFirebaseAuth();
      const provider = new fb.OAuthProvider("apple.com");

      provider.addScope("email");
      provider.addScope("name");

      const result = await fb.signInWithPopup(fb.auth, provider);
      const user = result.user;

      await ensureUserProfile(user, "apple");

      const idToken = await user.getIdToken(true);
      await createServerSession(idToken);

      await finishAuthAndGo();
    } catch (e: unknown) {
      handleAuthError(e, "Não foi possível entrar com Apple.");
    } finally {
      setSocialLoading(null);
    }
  }

  async function doReset() {
    try {
      setErr(null);
      setMsg(null);
      setLoading(true);

      await ensurePersistence();

      const fb = await loadFirebaseAuth();
      await fb.sendPasswordResetEmail(fb.auth, normalizeEmail(email));

      setMsg("Enviamos um e-mail para redefinir sua senha.");
      setMode("login");
    } catch (e: unknown) {
      handleAuthError(e, "Não foi possível enviar o e-mail. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const title =
    mode === "login"
      ? "Entrar"
      : mode === "register"
      ? "Criar conta"
      : "Recuperar senha";

  const primaryAction =
    mode === "login" ? doLogin : mode === "register" ? doRegister : doReset;

  const primaryDisabled =
    loading ||
    !!socialLoading ||
    (mode === "reset" ? !canReset : !canLogin) ||
    (mode === "register" ? pass.length < 6 : false);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <div style={styles.logo}>CF</div>

          <div>
            <div style={styles.brandTitle}>ConnectFish Seller</div>
            <div style={styles.brandSub}>Acesse com sua conta do app</div>
          </div>
        </div>

        <div style={styles.headerRow}>
          <div style={styles.h1}>{title}</div>

          <div style={styles.pills}>
            <button
              type="button"
              style={{
                ...styles.pill,
                ...(mode === "login" ? styles.pillOn : {}),
              }}
              onClick={() => {
                setErr(null);
                setMsg(null);
                setMode("login");
              }}
            >
              Login
            </button>

            <button
              type="button"
              style={{
                ...styles.pill,
                ...(mode === "register" ? styles.pillOn : {}),
              }}
              onClick={() => {
                setErr(null);
                setMsg(null);
                setMode("register");
              }}
            >
              Criar
            </button>
          </div>
        </div>

        {msg && <div style={styles.msg}>{msg}</div>}
        {err && <div style={styles.err}>{err}</div>}

        {mode !== "reset" && (
          <>
            <div style={styles.socialBox}>
              <button
                type="button"
                style={{
                  ...styles.socialBtn,
                  ...(!!socialLoading || loading ? styles.btnDisabled : {}),
                }}
                onClick={doGoogleLogin}
                disabled={!!socialLoading || loading}
              >
                {socialLoading === "google"
                  ? "Entrando com Google..."
                  : "Entrar com Google"}
              </button>

              <button
                type="button"
                style={{
                  ...styles.socialBtnDark,
                  ...(!!socialLoading || loading ? styles.btnDisabled : {}),
                }}
                onClick={doAppleLogin}
                disabled={!!socialLoading || loading}
              >
                {socialLoading === "apple"
                  ? "Entrando com Apple..."
                  : "Entrar com Apple"}
              </button>
            </div>

            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>ou continue com e-mail</span>
              <span style={styles.dividerLine} />
            </div>
          </>
        )}

        <label style={styles.label} htmlFor="email">
          E-mail
        </label>

        <input
          id="email"
          type="email"
          style={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          disabled={loading || !!socialLoading}
        />

        {mode !== "reset" && (
          <>
            <label style={styles.label} htmlFor="password">
              Senha
            </label>

            <input
              id="password"
              type="password"
              style={styles.input}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              disabled={loading || !!socialLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !primaryDisabled) {
                  primaryAction();
                }
              }}
            />

            <div style={styles.hintRow}>
              <span style={styles.hint}>
                {mode === "register"
                  ? "Ao criar conta, você concorda com os Termos e a Política de Privacidade."
                  : "Use o mesmo login cadastrado no app."}
              </span>

              <button
                type="button"
                style={styles.linkBtn}
                onClick={() => {
                  setErr(null);
                  setMsg(null);
                  setMode("reset");
                }}
              >
                Esqueci a senha
              </button>
            </div>
          </>
        )}

        {mode === "reset" && (
          <div style={styles.resetBox}>
            <div style={styles.resetTxt}>
              Enviaremos um link de redefinição para seu e-mail.
            </div>

            <button
              type="button"
              style={styles.linkBtn}
              onClick={() => {
                setErr(null);
                setMsg(null);
                setMode("login");
              }}
            >
              Voltar
            </button>
          </div>
        )}

        <button
          type="button"
          style={{
            ...styles.primaryBtn,
            ...(primaryDisabled ? styles.btnDisabled : {}),
          }}
          onClick={primaryAction}
          disabled={primaryDisabled}
        >
          {loading
            ? "Aguarde..."
            : mode === "login"
            ? "Entrar"
            : mode === "register"
            ? "Criar conta"
            : "Enviar e-mail"}
        </button>

        <div style={styles.footer}>
          <div style={styles.footerTxt}>
            Login único para app e painel ConnectFish.
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background:
      "radial-gradient(circle at top left, rgba(0,191,223,0.22), transparent 34%), linear-gradient(135deg, #071B2C 0%, #0B3C5D 42%, #2E8B57 100%)",
    padding: 18,
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },

  card: {
    width: "min(460px, 100%)",
    background: "rgba(255,255,255,0.97)",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 20px 60px rgba(0,0,0,0.22)",
    border: "1px solid rgba(255,255,255,0.42)",
  },

  brand: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginBottom: 16,
  },

  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    background: "linear-gradient(135deg, #023F88, #00BFDF)",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontWeight: 950,
    letterSpacing: 1,
    userSelect: "none",
    boxShadow: "0 10px 24px rgba(2,63,136,0.28)",
  },

  brandTitle: {
    fontSize: 16,
    fontWeight: 950,
    color: "#0F172A",
  },

  brandSub: {
    fontSize: 12,
    fontWeight: 800,
    color: "#64748B",
    marginTop: 2,
  },

  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  h1: {
    fontSize: 18,
    fontWeight: 950,
    color: "#0F172A",
  },

  pills: {
    display: "flex",
    gap: 8,
  },

  pill: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.14)",
    background: "#FFFFFF",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 12,
    color: "#0F172A",
  },

  pillOn: {
    background: "rgba(0,191,223,0.14)",
    border: "1px solid rgba(0,191,223,0.34)",
    color: "#023F88",
  },

  socialBox: {
    display: "grid",
    gap: 10,
    marginTop: 16,
  },

  socialBtn: {
    width: "100%",
    borderRadius: 16,
    padding: "12px 12px",
    background: "#FFFFFF",
    color: "#0F172A",
    border: "1px solid rgba(15,23,42,0.14)",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(15,23,42,0.05)",
  },

  socialBtnDark: {
    width: "100%",
    borderRadius: 16,
    padding: "12px 12px",
    background: "#0F172A",
    color: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.14)",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(15,23,42,0.10)",
  },

  divider: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    marginBottom: 2,
  },

  dividerLine: {
    height: 1,
    flex: 1,
    background: "rgba(15,23,42,0.10)",
  },

  dividerText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: 850,
    whiteSpace: "nowrap",
  },

  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 950,
    color: "#0F172A",
    marginTop: 12,
  },

  input: {
    width: "100%",
    padding: "13px 12px",
    borderRadius: 16,
    border: "1px solid rgba(15,23,42,0.14)",
    outline: "none",
    marginTop: 6,
    fontWeight: 800,
    color: "#0F172A",
    background: "#FFFFFF",
    boxSizing: "border-box",
  },

  hintRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 10,
  },

  hint: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: 750,
    lineHeight: 1.4,
  },

  linkBtn: {
    background: "transparent",
    border: "none",
    color: "#023F88",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 12,
    padding: 0,
    textDecoration: "underline",
    whiteSpace: "nowrap",
  },

  resetBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    background: "rgba(2,63,136,0.06)",
    border: "1px solid rgba(15,23,42,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  resetTxt: {
    fontSize: 12,
    color: "#334155",
    fontWeight: 850,
    lineHeight: 1.4,
  },

  primaryBtn: {
    width: "100%",
    borderRadius: 16,
    padding: "13px 12px",
    background: "linear-gradient(135deg, #023F88, #00BFDF)",
    color: "#FFFFFF",
    border: "none",
    fontWeight: 950,
    cursor: "pointer",
    marginTop: 14,
    boxShadow: "0 12px 26px rgba(2,63,136,0.24)",
  },

  btnDisabled: {
    opacity: 0.58,
    cursor: "not-allowed",
  },

  msg: {
    background: "rgba(46,139,87,0.10)",
    border: "1px solid rgba(46,139,87,0.25)",
    color: "#14532D",
    padding: 10,
    borderRadius: 16,
    fontWeight: 850,
    marginTop: 12,
    fontSize: 12,
  },

  err: {
    background: "rgba(229,57,53,0.10)",
    border: "1px solid rgba(229,57,53,0.25)",
    color: "#B91C1C",
    padding: 10,
    borderRadius: 16,
    fontWeight: 850,
    marginTop: 12,
    fontSize: 12,
  },

  footer: {
    marginTop: 12,
    textAlign: "center",
  },

  footerTxt: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: 750,
  },
};