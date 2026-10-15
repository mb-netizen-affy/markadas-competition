"use client";

import Link from "next/link";
import { useMemo } from "react";
import * as XLSX from "xlsx";
import { useCategorie } from "@/lib/useCategorie";
import { fmt, medaille, lettre, actifs } from "@/lib/competition";
import { imprimerResultats } from "@/lib/impression";
import Entete, { Etat } from "@/components/Entete";

export default function VueSecretariat({ slug }: { slug: string }) {
  const { categorie, danseurs, chargement, erreur } = useCategorie(slug);

  const lignes = useMemo(
    () => [...danseurs].sort((a, b) => a.dossard - b.dossard).map((d) => ({ d, m: medaille(d) })),
    [danseurs]
  );

  const totaux = useMemo(() => ({
    presents: danseurs.filter((d) => d.present === true).length,
    absents: danseurs.filter((d) => d.present !== true).length,
    or: lignes.filter((l) => l.m === "or").length,
    argent: lignes.filter((l) => l.m === "argent").length,
    bronze: lignes.filter((l) => l.m === "bronze").length,
  }), [danseurs, lignes]);

  if (chargement) return <Etat texte="Chargement…" />;
  if (erreur || !categorie) return <Etat texte={erreur ?? "Erreur"} erreur />;

  function exporter() {
    const data = lignes.map(({ d, m }) => ({
      Dossard: fmt(d.dossard),
      Nom: d.nom,
      Prénom: d.prenom,
      Présence: d.present === true ? "Présent" : "Absent",
      "Qualifié finale (1er tour)": d.qualif_t1 ? "X" : "",
      "Qualifié demi-finale": d.qualif_rep ? "X" : "",
      Bronze: m === "bronze" ? "X" : "",
      Argent: m === "argent" ? "X" : "",
      Or: m === "or" ? "X" : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, categorie!.nom.slice(0, 31));
    XLSX.writeFile(wb, `markadas-${categorie!.slug}.xlsx`);
  }

  // Impression des résultats (l'Or et l'Argent sont annoncés sur la piste, pas imprimés)
  function imprimerPremierTour() {
    const presents = actifs(danseurs);
    if (!categorie!.demarree && !confirm("La catégorie n'a pas encore démarré. Imprimer quand même ?")) return;
    if (!presents.some((d) => d.qualif_t1) && !confirm("Aucun danseur n'est encore sélectionné pour la finale. Imprimer quand même ?")) return;
    imprimerResultats("premier-tour", categorie!, danseurs);
  }
  function imprimerDemiFinale() {
    const presents = actifs(danseurs);
    if (!presents.some((d) => d.qualif_rep) && !confirm("Aucun danseur n'est encore qualifié en demi-finale. Imprimer quand même ?")) return;
    imprimerResultats("demi-finale", categorie!, danseurs);
  }

  const coche = (v: boolean) => (v ? <span className="text-lg font-bold text-mk-rouge">✔</span> : null);
  const pastille = (couleur: string, v: boolean) =>
    v ? <span className={`inline-block h-4 w-4 rounded-full ${couleur}`} /> : null;

  return (
    <main className="min-h-screen">
      <Entete
        titre={categorie.nom}
        sousTitre={`Secrétariat · Jury ${lettre(categorie.jury)}`}
        droite={
          <div className="flex shrink-0 gap-2">
            <Link href={`/espace/secretariat/${lettre(categorie.jury).toLowerCase()}`} className="mk-btn mk-btn-contour px-3 py-1.5 text-xs">
              ☰ Catégories
            </Link>
            <button onClick={exporter} className="mk-btn mk-btn-rouge text-xs">Export Excel</button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide">
          <Puce label="Inscrits" valeur={danseurs.length} />
          <Puce label="Présents" valeur={totaux.presents} couleur="text-ok" />
          <Puce label="Absents" valeur={totaux.absents} couleur="text-mk-rouge" />
          <Puce label="Or" valeur={totaux.or} couleur="text-or" />
          <Puce label="Argent" valeur={totaux.argent} couleur="text-argent" />
          <Puce label="Bronze" valeur={totaux.bronze} couleur="text-bronze" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={imprimerPremierTour} className="mk-btn mk-btn-sombre border border-mk-ligne py-3">
            🖨 Résultats 1er tour
            <span className="ml-1 hidden font-normal normal-case text-mk-gris sm:inline">(finale / demi-finale)</span>
          </button>
          <button onClick={imprimerDemiFinale} className="mk-btn mk-btn-sombre border border-mk-ligne py-3">
            🖨 Résultats demi-finale
            <span className="ml-1 hidden font-normal normal-case text-mk-gris sm:inline">(finale / bronze)</span>
          </button>
        </div>
      </Entete>

      <div className="mx-auto max-w-5xl p-3">
        <div className="overflow-x-auto rounded-lg border border-mk-ligne bg-mk-carte">
          <table className="w-full text-sm">
            <thead className="bg-mk-carte2 text-left text-xs uppercase tracking-wider text-mk-gris">
              <tr>
                <th className="p-3">Dossard</th>
                <th className="p-3">Nom</th>
                <th className="p-3">Prénom</th>
                <th className="p-3">Présence</th>
                <th className="p-3 text-center">Qualifié direct</th>
                <th className="p-3 text-center">Qualifié demi-finale</th>
                <th className="p-3 text-center text-bronze">Bronze</th>
                <th className="p-3 text-center text-argent">Argent</th>
                <th className="p-3 text-center text-or">Or</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(({ d, m }) => (
                <tr key={d.id} className={`border-t border-mk-ligne ${d.present !== true ? "opacity-40" : ""}`}>
                  <td className="p-3 font-extrabold tabular-nums">{fmt(d.dossard)}</td>
                  <td className="p-3 font-semibold uppercase">{d.nom}</td>
                  <td className="p-3">{d.prenom}</td>
                  <td className="p-3">
                    {d.present === true && <span className="font-semibold text-ok">Présent</span>}
                    {d.present !== true && <span className="font-semibold text-mk-rouge">Absent</span>}
                  </td>
                  <td className="p-3 text-center">{coche(d.qualif_t1)}</td>
                  <td className="p-3 text-center">{coche(d.qualif_rep)}</td>
                  <td className="p-3 text-center">{pastille("bg-bronze", m === "bronze")}</td>
                  <td className="p-3 text-center">{pastille("bg-argent", m === "argent")}</td>
                  <td className="p-3 text-center">{pastille("bg-or", m === "or")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function Puce({ label, valeur, couleur = "text-white" }: { label: string; valeur: number; couleur?: string }) {
  return (
    <span className="rounded-md bg-mk-carte2 px-3 py-1.5 text-mk-gris">
      {label} <span className={`ml-1 text-sm ${couleur}`}>{valeur}</span>
    </span>
  );
}