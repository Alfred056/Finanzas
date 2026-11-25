"use client";
import { useState } from "react";
import { Wallet } from "lucide-react";
import { post } from "@/lib/api";
import type { SessionUser } from "./AppShell";

export function AuthScreen({ onAuth }: { onAuth: (u: SessionUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const register = mode === "register";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onAuth(await post<SessionUser>(`/api/auth/${mode}`, { username, password, displayName }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const input = "input-well";
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm key-card space-y-3">
        <h1 className="flex items-center gap-2 text-xl font-medium text-white">
          <Wallet className="text-coral-pulse" size={22} /> Finanzas Personales
        </h1>
        <p className="text-sm text-zinc-400">{register ? "Crea tu cuenta" : "Inicia sesión para continuar"}</p>
        <input className={input} placeholder="Usuario" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className={input} type="password" placeholder="Contraseña" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 6 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
        {register && (
          <input className={input} placeholder="Nombre por el que quieres ser llamado" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="btn-primary w-full">
          {register ? "Registrarse" : "Iniciar sesión"}
        </button>
        <button type="button" className="w-full text-center text-sm text-zinc-400 hover:text-zinc-200" onClick={() => { setMode(register ? "login" : "register"); setError(""); }}>
          {register ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
        </button>
      </form>
    </div>
  );
}
