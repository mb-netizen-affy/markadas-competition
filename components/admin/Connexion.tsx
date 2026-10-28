"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Entete from "@/components/Entete";

// Page de connexion de l'admin : compte créé dans Supabase → Authentication → Users → Add user
export default function Connexion() {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function seConnecter(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: mdp });
    setEnCours(false);
    if (error) setErreur("Email ou mot de passe incorrect.");
  }

  return (
    <main className="min-h-screen">
      <Entete
        titre="Administration"
        sousTitre="Accès réservé"
        droite={
          <Link href="/" className="mk-btn mk-btn-contour shrink-0 px-3 py-1.5 text-xs">
            ⌂ Accueil
          </Link>
        }
      />
      <form onSubmit={seConnecter} className="mx-auto mt-10 max-w-sm space-y-3 p-4">
        <div className="mk-carte space-y-3">
          <p className="mk-titre text-lg">Connexion</p>
          <label className="block space-y-1">
            <span className="text-xs font-bold uppercase text-mk-gris">Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mk-input" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold uppercase text-mk-gris">Mot de passe</span>
            <input type="password" required autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} className="mk-input" />
          </label>
          {erreur && <p className="text-sm font-semibold text-mk-rouge">{erreur}</p>}
          <button type="submit" disabled={enCours} className="mk-btn mk-btn-rouge w-full">
            {enCours ? "Connexion…" : "Se connecter"}
          </button>
        </div>
      </form>
    </main>
  );
}