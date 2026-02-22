"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "login" | "register" | "reset";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
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

async function createServerSession(idToken: string) {
  const r = await fetch("/api/sessionLogin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data?.error || "Falha ao criar sessão.");
  }

  return true;
}

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/seller";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canLogin = useMemo(
    () => isValidEmail(email) && pass.length >= 6,
    [email, pass]
  );
  const canReset = useMemo(() => isValidEmail(email), [email]);

  async function doLogin() {
    try {
      setErr(null);
      setMsg(null);
      setLoading(true);

      await ensurePersistence();
      const fb = await loadFirebaseAuth();

      const cred = await fb.signInWithEmailAndPassword(
        fb.auth,
        email.trim(),
        pass
      );

      // ✅ Cenário B: cria cookie de sessão no servidor
      const idToken = await cred.user.getIdToken(true);
      await createServerSession(idToken);

      router.replace(next);
    } catch (e: unknown) {
      const code = String((e as any)?.code || "");
      const message = String((e as any)?.message || "");

      if (
        code.includes("auth/invalid-credential") ||
        code.includes("auth/wrong-password")
      ) {
        setErr("E-mail ou senha inválidos.");
      } else if (code.includes("auth/user-not-found")) {
        setErr("Usuário não encontrado. Crie uma conta.");
      } else if (code.includes("auth/too-many-requests")) {
        setErr("Muitas tentativas. Aguarde um pouco e tente novamente.");
      } else if (
        message.toLowerCase().includes("sessão") ||
        message.toLowerCase().includes("session")
      ) {
        setErr("Login ok, mas não conseguimos criar a sessão. Tente novamente.");
      } else {
        setErr("Não foi possível entrar. Tente novamente.");
      }
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
        email.trim(),
        pass
      );

      // ✅ Cenário B: cria cookie de sessão no servidor
      const idToken = await cred.user.getIdToken(true);
      await createServerSession(idToken);

      router.replace(next);
    } catch (e: unknown) {
      const code = String((e as any)?.code || "");
      const message = String((e as any)?.message || "");

      if (code.includes("auth/email-already-in-use")) {
        setErr("Esse e-mail já está em uso. Faça login.");
      } else if (code.includes("auth/weak-password")) {
        setErr("Senha fraca. Use pelo menos 6 caracteres (ideal 8+).");
      } else if (code.includes("auth/invalid-email")) {
        setErr("E-mail inválido.");
      } else if (
        message.toLowerCase().includes("sessão") ||
        message.toLowerCase().includes("session")
      ) {
        setErr("Conta criada, mas não conseguimos criar a sessão. Tente entrar.");
      } else {
        setErr("Não foi possível criar a conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function doReset() {
    try {
      setErr(null);
      setMsg(null);
      setLoading(true);

      await ensurePersistence();
      const fb = await loadFirebaseAuth();
      await fb.sendPasswordResetEmail(fb.auth, email.trim());

      setMsg("Enviamos um e-mail para redefinir sua senha.");
      setMode("login");
    } catch (e: unknown) {
      const code = String((e as any)?.code || "");
      if (code.includes("auth/user-not-found")) {
        setErr("Não existe conta com esse e-mail.");
      } else if (code.includes("auth/invalid-email")) {
        setErr("E-mail inválido.");
      } else {
        setErr("Não foi possível enviar o e-mail. Tente novamente.");
      }
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
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />

            <div style={styles.hintRow}>
              <span style={styles.hint}>
                Dica: use 8+ caracteres para ficar mais seguro.
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
            Próximo: adicionar Google Login e “continuar no app”.
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
    background: "linear-gradient(120deg, #0B3C5D 0%, #2E8B57 70%)",
    padding: 18,
    fontFamily: "system-ui",
  },
  card: {
    width: "min(460px, 100%)",
    background: "rgba(255,255,255,0.96)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
    border: "1px solid rgba(15,23,42,0.10)",
  },
  brand: { display: "flex", gap: 12, alignItems: "center", marginBottom: 12 },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 14,
    background: "#0F172A",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    letterSpacing: 1,
    userSelect: "none",
  },
  brandTitle: { fontSize: 16, fontWeight: 900, color: "#0F172A" },
  brandSub: { fontSize: 12, fontWeight: 700, color: "#64748B", marginTop: 2 },

  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  h1: { fontSize: 16, fontWeight: 900, color: "#0F172A" },

  pills: { display: "flex", gap: 8 },
  pill: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.14)",
    background: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
    color: "#0F172A",
  },
  pillOn: {
    background: "rgba(46,139,87,0.16)",
    border: "1px solid rgba(46,139,87,0.35)",
    color: "#0F172A",
  },

  label: { fontSize: 12, fontWeight: 900, color: "#0F172A", marginTop: 12 },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.14)",
    outline: "none",
    marginTop: 6,
    fontWeight: 700,
  },

  hintRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  hint: { fontSize: 12, color: "#64748B", fontWeight: 700 },

  linkBtn: {
    background: "transparent",
    border: "none",
    color: "#0B3C5D",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
    padding: 0,
    textDecoration: "underline",
  },

  resetBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    background: "rgba(11,60,93,0.06)",
    border: "1px solid rgba(15,23,42,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  resetTxt: { fontSize: 12, color: "#334155", fontWeight: 800 },

  primaryBtn: {
    width: "100%",
    borderRadius: 14,
    padding: "12px 12px",
    background: "#2E8B57",
    color: "#fff",
    border: "none",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: 14,
  },
  btnDisabled: { opacity: 0.6, cursor: "not-allowed" },

  msg: {
    background: "rgba(46,139,87,0.10)",
    border: "1px solid rgba(46,139,87,0.25)",
    color: "#14532D",
    padding: 10,
    borderRadius: 14,
    fontWeight: 800,
    marginTop: 12,
    fontSize: 12,
  },
  err: {
    background: "rgba(229,57,53,0.10)",
    border: "1px solid rgba(229,57,53,0.25)",
    color: "#B91C1C",
    padding: 10,
    borderRadius: 14,
    fontWeight: 800,
    marginTop: 12,
    fontSize: 12,
  },

  footer: { marginTop: 12, textAlign: "center" },
  footerTxt: { fontSize: 12, color: "#64748B", fontWeight: 700 },
};

