"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState<string | null>("Torneios");

  function toggle(section: string) {
    setOpen((prev) => (prev === section ? null : section));
  }

  function Item({
    label,
    path,
  }: {
    label: string;
    path: string;
  }) {
    const active = pathname === path;

    return (
      <button
        onClick={() => router.push(path)}
        style={{
          ...styles.item,
          ...(active ? styles.activeItem : {}),
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>ConnectFish</div>

      {/* DASHBOARD */}
      <Item label="Dashboard" path="/seller" />

      {/* TORNEIOS */}
      <div>
        <button style={styles.group} onClick={() => toggle("Torneios")}>
          Torneios
        </button>

        {open === "Torneios" && (
          <div style={styles.sub}>
            <Item label="Criar torneio" path="/seller/tournaments/new" />
            <Item label="Meus torneios" path="/seller/tournaments" />
            <Item label="Inscrições" path="/seller/tournaments/registrations" />
          </div>
        )}
      </div>

      {/* FINANCEIRO */}
      <div>
        <button style={styles.group} onClick={() => toggle("Financeiro")}>
          Financeiro
        </button>

        {open === "Financeiro" && (
          <div style={styles.sub}>
            <Item label="Wallet" path="/seller/wallet" />
            <Item label="Repasses" path="/seller/payouts" />
            <Item label="Extrato" path="/seller/transactions" />
          </div>
        )}
      </div>

      {/* OPERAÇÃO */}
      <div>
        <button style={styles.group} onClick={() => toggle("Operação")}>
          Operação
        </button>

        {open === "Operação" && (
          <div style={styles.sub}>
            <Item label="Meu pesqueiro" path="/seller/fishery" />
            <Item label="Pedidos" path="/seller/orders" />
          </div>
        )}
      </div>

      {/* CONTA */}
      <div>
        <button style={styles.group} onClick={() => toggle("Conta")}>
          Conta
        </button>

        {open === "Conta" && (
          <div style={styles.sub}>
            <Item label="Perfil do organizador" path="/seller/profile" />
            <Item label="Conta financeira" path="/seller/financial-account" />
            <Item label="Assinatura" path="/seller/billing" />
            <Item label="Configurações" path="/seller/settings" />
          </div>
        )}
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: 260,
    background: "#0F172A",
    color: "#fff",
    padding: 20,
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  logo: {
    fontWeight: 900,
    fontSize: 18,
    marginBottom: 20,
  },
  group: {
    width: "100%",
    textAlign: "left" as const,
    background: "transparent",
    border: "none",
    color: "#94A3B8",
    fontWeight: 700,
    cursor: "pointer",
    padding: "10px 8px",
  },
  sub: {
    display: "flex",
    flexDirection: "column" as const,
    marginLeft: 10,
  },
  item: {
    textAlign: "left" as const,
    background: "transparent",
    border: "none",
    color: "#E2E8F0",
    padding: "8px 10px",
    borderRadius: 8,
    cursor: "pointer",
  },
  activeItem: {
    background: "#1E293B",
    fontWeight: 900,
  },
};