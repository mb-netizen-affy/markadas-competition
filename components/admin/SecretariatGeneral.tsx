"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase, type Categorie, type Danseur } from "@/lib/supabase";
import { fmt, medaille, estFinaliste } from "@/lib/competition";

// Supabase renvoie 1000 lignes maximum par requête : on charge par paquets
async function chargerTousLesDanseurs(): Promise<Danseur[]> {
  const tous: Danseur[] = [];
  for (let debut = 0; ; debut += 1000) {
    const { data, error } = await supabase
      .from("danseurs").select("*").order("id").range(debut, debut + 999);
    if (error) throw error;
    tous.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return tous;
}

type Stats = {
  inscrits: number; presents: number; absents: number; aPointer: number;
  finalistes: number; or: number; argent: number; bronze: number;
};

function calculer(ds: Danseur[]): Stats {
  const m = ds.map(medaille);
  return {
    inscrits: ds.length,
    presents: ds.filter((d) => d.present === true).length,
    absents: ds.filter((d) => d.present === false).length,
    aPointer: ds.filter((d) => d.present === null).length,
    finalistes: ds.filter(estFinaliste).length,
    or: m.filter((x) => x === "or").length,
    argent: m.filter((x) => x === "argent").length,
    bronze: m.filter((x) => x === "bronze").length,
  };
}

// Nom de feuille Excel valide : 31 caractères max, sans [ ] : * ? / \
const nomFeuille = (s: string) => s.replace(/[[\]:*?/\\]/g, " ").slice(0, 31);

export default function SecretariatGeneral({ categories }: { categories: Categorie[] }) {
  const [danseurs, setDanseurs] = useState<Danseur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let annule = false;
    let connecteUneFois = false;
    const recharger = () =>
      chargerTousLesDanseurs()
        .then((ds) => { if (!annule) { setDanseurs(ds); setChargement(false); } })
        .catch((e) => { if (!annule) { setErreur((e as Error).message); setChargement(false); } });

    recharger();

    // Temps réel sur toutes les catégories
    const channel = supabase
      .channel(`secretariat-general-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "danseurs" }, (payload) => {
        if (payload.eventType === "UPDATE") {
          const maj = payload.new as Danseur;
          setDanseurs((prev) => prev.map((d) => (d.id === maj.id ? maj : d)));
        } else {
          recharger();
        }
      })
      .subscribe((status) => {
        // Après une coupure réseau : on recharge pour rattraper ce qui a changé
        if (status === "SUBSCRIBED") {
          if (connecteUneFois) recharger();
          connecteUneFois = true;
        }
      });

    return () => {
      annule = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const lignes = useMemo(
    () => categories.map((c) => ({ c, s: calculer(danseurs.filter((d) => d.categorie_id === c.id)) })),
    [categories, danseurs]
  );
  const total = useMemo(() => calculer(danseurs), [danseurs]);

  function exporterTout() {
    const wb = XLSX.utils.book_new();

    // Feuille 1 : synthèse
    const synthese: Record<string, string | number>[] = lignes.map(({ c, s }) => ({
      Catégorie: c.nom, Jury: c.jury, Inscrits: s.inscrits, Présents: s.presents, Absents: s.absents,
      "À pointer": s.aPointer, Finalistes: s.finalistes, Or: s.or, Argent: s.argent, Bronze: s.bronze,
    }));
    synthese.push({
      Catégorie: "TOTAL", Jury: "", Inscrits: total.inscrits, Présents: total.presents,
      Absents: total.absents, "À pointer": total.aPointer, Finalistes: total.finalistes,
      Or: total.or, Argent: total.argent, Bronze: total.bronze,
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(synthese), "Synthèse");

    // Puis une feuille par catégorie
    const pris = new Set(["Synthèse"]);
    for (const c of categories) {
      const ds = danseurs.filter((d) => d.categorie_id === c.id).sort((a, b) => a.dossard - b.dossard);
      const data = ds.map((d) => {
        const m = medaille(d);
        return {
          Dossard: fmt(d.dossard), Nom: d.nom, Prénom: d.prenom,
          Présence: d.present === true ? "Présent" : d.present === false ? "Absent" : "",
          "Qualifié direct finale": d.qualif_t1 ? "X" : "",
          "Qualifié repêchage": d.qualif_rep ? "X" : "",
          Bronze: m === "bronze" ? "X" : "", Argent: m === "argent" ? "X" : "", Or: m === "or" ? "X" : "",
        };
      });
      let nom = nomFeuille(c.nom) || "Catégorie";
      for (let n = 2; pris.has(nom); n++) nom = nomFeuille(`${c.nom}`.slice(0, 28) + ` ${n}`);
      pris.add(nom);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), nom);
    }

    XLSX.writeFile(wb, "markadas-resultats-complets.xlsx");
  }

  if (chargement) return <p className="p-4 text-mk-gris">Chargement…</p>;
  if (erreur) return <p className="p-4 text-mk-rouge">Erreur : {erreur}</p>;

  const pct = (s: Stats) => (s.inscrits ? Math.round(((s.presents + s.absents) / s.inscrits) * 100) : 0);

  return (
    <section className="space-y-3">
      {/* Totaux */}
      <div className="mk-carte space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="mk-titre text-lg">Toutes catégories</h2>
          <button onClick={exporterTout} className="mk-btn mk-btn-rouge text-xs">Export Excel complet</button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tuile label="Inscrits" valeur={total.inscrits} />
          <Tuile label="Présents" valeur={total.presents} couleur="text-ok" />
          <Tuile label="Absents" valeur={total.absents} couleur="text-mk-rouge" />
          <Tuile label="À pointer" valeur={total.aPointer} />
          <Tuile label="Finalistes" valeur={total.finalistes} />
          <Tuile label="Or" valeur={total.or} couleur="text-or" />
          <Tuile label="Argent" valeur={total.argent} couleur="text-argent" />
          <Tuile label="Bronze" valeur={total.bronze} couleur="text-bronze" />
        </div>
        <Barre pct={pct(total)} label="Pointage global" />
      </div>

      {/* Détail par catégorie */}
      <div className="overflow-x-auto rounded-lg border border-mk-ligne bg-mk-carte">
        <table className="w-full text-sm">
          <thead className="bg-mk-carte2 text-left text-xs uppercase tracking-wider text-mk-gris">
            <tr>
              <th className="p-3">Catégorie</th>
              <th className="p-3 text-center">Jury</th>
              <th className="p-3 text-center">Inscrits</th>
              <th className="p-3 text-center">Présents</th>
              <th className="p-3 text-center">Absents</th>
              <th className="p-3 text-center">À pointer</th>
              <th className="p-3 text-center">Finalistes</th>
              <th className="p-3 text-center text-or">Or</th>
              <th className="p-3 text-center text-argent">Argent</th>
              <th className="p-3 text-center text-bronze">Bronze</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(({ c, s }) => (
              <tr key={c.id} className="border-t border-mk-ligne">
                <td className="p-3">
                  <div className="font-bold uppercase">{c.nom}</div>
                  <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-mk-carte2">
                    <div className="h-full bg-ok" style={{ width: `${pct(s)}%` }} />
                  </div>
                </td>
                <td className="p-3 text-center text-mk-gris">{c.jury}</td>
                <td className="p-3 text-center font-semibold">{s.inscrits}</td>
                <td className="p-3 text-center text-ok">{s.presents}</td>
                <td className="p-3 text-center text-mk-rouge">{s.absents}</td>
                <td className="p-3 text-center">{s.aPointer || <span className="text-ok">✔</span>}</td>
                <td className="p-3 text-center">{s.finalistes}</td>
                <td className="p-3 text-center text-or">{s.or}</td>
                <td className="p-3 text-center text-argent">{s.argent}</td>
                <td className="p-3 text-center text-bronze">{s.bronze}</td>
                <td className="p-3 text-right">
                  <Link href={`/secretariat/${c.slug}`} className="mk-lien whitespace-nowrap text-xs font-bold uppercase">
                    Détail →
                  </Link>
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-mk-ligne bg-mk-carte2 font-extrabold">
              <td className="p-3 uppercase">Total</td>
              <td className="p-3"></td>
              <td className="p-3 text-center">{total.inscrits}</td>
              <td className="p-3 text-center text-ok">{total.presents}</td>
              <td className="p-3 text-center text-mk-rouge">{total.absents}</td>
              <td className="p-3 text-center">{total.aPointer}</td>
              <td className="p-3 text-center">{total.finalistes}</td>
              <td className="p-3 text-center text-or">{total.or}</td>
              <td className="p-3 text-center text-argent">{total.argent}</td>
              <td className="p-3 text-center text-bronze">{total.bronze}</td>
              <td className="p-3"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Tuile({ label, valeur, couleur = "text-mk-texte" }: { label: string; valeur: number; couleur?: string }) {
  return (
    <div className="rounded-md bg-mk-carte2 py-2 text-center">
      <div className={`text-2xl font-extrabold ${couleur}`}>{valeur}</div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-mk-gris">{label}</div>
    </div>
  );
}

function Barre({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-mk-gris">
        <span>{label}</span>
        <span>{pct} %</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-mk-carte2">
        <div className="h-full bg-ok transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}