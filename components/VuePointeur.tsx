"use client";

import { useMemo, useState } from "react";
import { useCategorie } from "@/lib/useCategorie";
import { fmt } from "@/lib/competition";
import type { Danseur } from "@/lib/supabase";
import Entete, { Etat } from "@/components/Entete";

export default function VuePointeur({ slug }: { slug: string }) {
  const { categorie, danseurs, chargement, erreur, modifier } = useCategorie(slug);
  const [recherche, setRecherche] = useState("");

  const stats = useMemo(() => ({
    presents: danseurs.filter((d) => d.present === true).length,
    absents: danseurs.filter((d) => d.present === false).length,
    aPointer: danseurs.filter((d) => d.present === null).length,
  }), [danseurs]);

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return danseurs;
    return danseurs.filter((d) =>
      fmt(d.dossard).includes(q) ||
      d.nom.toLowerCase().includes(q) ||
      d.prenom.toLowerCase().includes(q)
    );
  }, [danseurs, recherche]);

  if (chargement) return <Etat texte="Chargement…" />;
  if (erreur || !categorie) return <Etat texte={erreur ?? "Erreur"} erreur />;

  // Clic sur Présent/Absent ; recliquer sur le même bouton annule le pointage
  const pointer = (d: Danseur, v: boolean) => modifier(d, { present: d.present === v ? null : v });

  return (
    <main className="min-h-screen">
      <Entete titre={categorie.nom} sousTitre={`Pointage · Jury ${categorie.jury} · ${danseurs.length} attendus`}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat valeur={stats.presents} label="Présents" couleur="text-ok" />
          <Stat valeur={stats.absents} label="Absents" couleur="text-mk-rouge" />
          <Stat valeur={stats.aPointer} label="À pointer" couleur="text-white" />
        </div>
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un dossard ou un nom…"
          className="mk-input"
        />
      </Entete>

      <ul className="mx-auto max-w-5xl space-y-2 p-3">
        {liste.map((d) => (
          <li
            key={d.id}
            className={`flex items-center gap-3 rounded-lg border-l-4 bg-mk-carte p-3 ${
              d.present === true ? "border-ok" : d.present === false ? "border-mk-rouge opacity-60" : "border-mk-ligne"
            }`}
          >
            <span className="w-12 text-center text-2xl font-extrabold tabular-nums">{fmt(d.dossard)}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold uppercase">{d.nom}</div>
              <div className="truncate text-sm text-mk-gris">{d.prenom}</div>
            </div>
            <button
              onClick={() => pointer(d, true)}
              className={`mk-btn px-3 py-3 text-xs ${d.present === true ? "bg-ok text-white" : "mk-btn-sombre"}`}
            >
              Présent
            </button>
            <button
              onClick={() => pointer(d, false)}
              className={`mk-btn px-3 py-3 text-xs ${d.present === false ? "mk-btn-rouge" : "mk-btn-sombre"}`}
            >
              Absent
            </button>
          </li>
        ))}
        {liste.length === 0 && <p className="p-4 text-center text-mk-gris">Aucun résultat</p>}
      </ul>
    </main>
  );
}

function Stat({ valeur, label, couleur }: { valeur: number; label: string; couleur: string }) {
  return (
    <div className="rounded-md bg-mk-carte2 py-2">
      <div className={`text-2xl font-extrabold ${couleur}`}>{valeur}</div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-mk-gris">{label}</div>
    </div>
  );
}