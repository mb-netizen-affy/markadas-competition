"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Etat = "connexion" | "connecte" | "hors-ligne";

// Surveille la connexion au serveur (réseau + temps réel Supabase)
export function useConnexion(): Etat {
  const [etat, setEtat] = useState<Etat>("connexion");
  const [reseau, setReseau] = useState(true);

  useEffect(() => {
    setReseau(navigator.onLine);
    const enLigne = () => setReseau(true);
    const horsLigne = () => setReseau(false);
    window.addEventListener("online", enLigne);
    window.addEventListener("offline", horsLigne);

    const channel = supabase
      .channel(`etat-connexion-${Math.random().toString(36).slice(2)}`)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setEtat("connecte");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setEtat("hors-ligne");
      });

    return () => {
      window.removeEventListener("online", enLigne);
      window.removeEventListener("offline", horsLigne);
      supabase.removeChannel(channel);
    };
  }, []);

  return reseau ? etat : "hors-ligne";
}

// Petit voyant affiché dans l'en-tête
export function Voyant({ etat }: { etat: Etat }) {
  const style = {
    connecte: { point: "bg-ok", texte: "En direct" },
    connexion: { point: "bg-amber-400 animate-pulse", texte: "Connexion…" },
    "hors-ligne": { point: "bg-mk-rouge animate-pulse", texte: "Hors ligne" },
  }[etat];
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-mk-gris" title="État de la connexion">
      <span className={`h-2.5 w-2.5 rounded-full ${style.point}`} />
      <span className="hidden sm:inline">{style.texte}</span>
    </span>
  );
}

// Bandeau d'alerte quand la connexion est perdue
export function AlerteHorsLigne({ etat }: { etat: Etat }) {
  if (etat !== "hors-ligne") return null;
  return (
    <p className="rounded-md border border-mk-rouge/60 bg-mk-rouge/15 px-3 py-2 text-sm font-semibold text-red-200">
      📡 Connexion perdue : cet écran n&apos;est plus à jour et vos clics risquent de ne pas être enregistrés.
      Reconnexion automatique en cours…
    </p>
  );
}