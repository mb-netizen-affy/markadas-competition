"use client";

import { useEffect, useState } from "react";
import { supabase, type Categorie, type Reglages } from "@/lib/supabase";
import { maxParPassage, nbPassages, repartir } from "@/lib/competition";

// Réglage unique pour toute la compétition : combien de danseurs tiennent sur la piste.
// Les passages de chaque catégorie en découlent automatiquement.
export default function ReglagesPassages({
  reglages,
  categories,
  inscrits,
  presents,
  onChange,
}: {
  reglages: Reglages;
  categories: Categorie[];
  inscrits: Record<string, number>;
  presents: Record<string, number>;
  onChange: () => void;
}) {
  const [f, setF] = useState(reglages);
  const [enCours, setEnCours] = useState(false);
  useEffect(() => setF(reglages), [reglages]);

  const modifie = f.lignes !== reglages.lignes || f.par_ligne !== reglages.par_ligne;
  const val = (v: string) => Math.max(1, parseInt(v, 10) || 1);

  async function enregistrer() {
    setEnCours(true);
    const { error } = await supabase
      .from("reglages")
      .upsert({ id: 1, lignes: f.lignes, par_ligne: f.par_ligne });
    setEnCours(false);
    if (error) alert("Erreur : " + error.message);
    else onChange();
  }

  const champ =
    "w-20 rounded-md border border-mk-ligne bg-mk-noir px-2 py-1 text-center text-lg font-bold text-mk-texte focus:border-mk-rouge focus:outline-none";

  // Aperçu : "45 danseurs → 3 passages (15 · 15 · 15)"
  const apercu = (n: number, fixe: number) => {
    const nb = nbPassages(n, f, fixe);
    const tailles = repartir(Array.from({ length: n }), nb).map((p) => p.length);
    return (
      <>
        <b>{nb}</b> <span className="text-xs text-mk-gris">({tailles.join(" · ")})</span>
      </>
    );
  };

  return (
    <section className="mk-carte space-y-4 border-mk-rouge/40">
      <div>
        <h2 className="mk-titre text-lg">Passages automatiques</h2>
        <p className="text-sm text-mk-gris">
          Sauf si un nombre de passages est fixé dans la catégorie, les passages sont calculés tout seuls à partir des danseurs <b className="text-mk-texte">présents</b>,
          dans l&apos;ordre des dossards. Il suffit d&apos;indiquer la place sur la piste.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Bloc label="Lignes" aide="sur la piste">
          <input type="number" min={1} value={f.lignes} onChange={(e) => setF({ ...f, lignes: val(e.target.value) })} className={champ} />
        </Bloc>
        <span className="text-xl font-bold text-mk-gris">×</span>
        <Bloc label="Par ligne" aide="danseurs max">
          <input type="number" min={1} value={f.par_ligne} onChange={(e) => setF({ ...f, par_ligne: val(e.target.value) })} className={champ} />
        </Bloc>
        <span className="text-xl font-bold text-mk-gris">=</span>
        <div className="rounded-md bg-mk-rouge/15 px-4 py-3 text-center">
          <div className="text-2xl font-extrabold">{maxParPassage(f)}</div>
          <div className="text-[11px] font-bold uppercase text-mk-gris">max par passage</div>
        </div>
        <button onClick={enregistrer} disabled={!modifie || enCours} className="mk-btn mk-btn-rouge ml-auto">
          {enCours ? "Enregistrement…" : modifie ? "Enregistrer" : "Enregistré"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-mk-ligne">
        <table className="w-full text-sm">
          <thead className="bg-mk-carte2 text-left text-xs uppercase tracking-wider text-mk-gris">
            <tr>
              <th className="p-2">Catégorie</th>
              <th className="p-2">Prévision (inscrits)</th>
              <th className="p-2">Jour J (présents)</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-t border-mk-ligne">
                <td className="p-2 font-bold uppercase">
                  {c.nom}
                  {c.nb_passages > 0 && (
                    <span className="ml-2 rounded bg-mk-rouge/20 px-1.5 py-0.5 text-[10px] text-red-300">
                      {c.nb_passages} FIXÉS
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap p-2">
                  {(inscrits[c.id] ?? 0) > 0 ? (
                    <>
                      <span className="text-mk-gris">{inscrits[c.id]} →</span> {apercu(inscrits[c.id], c.nb_passages)}
                    </>
                  ) : (
                    <span className="text-mk-gris">aucun inscrit</span>
                  )}
                </td>
                <td className="whitespace-nowrap p-2">
                  {(presents[c.id] ?? 0) > 0 ? (
                    <>
                      <span className="text-mk-gris">{presents[c.id]} →</span> {apercu(presents[c.id], c.nb_passages)}
                    </>
                  ) : (
                    <span className="text-mk-gris">aucun présent</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Bloc({ label, aide, children }: { label: string; aide: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col items-center gap-1 rounded-md bg-mk-carte2 p-2 text-center">
      <span className="text-xs font-bold uppercase">{label}</span>
      {children}
      <span className="text-[11px] text-mk-gris">{aide}</span>
    </label>
  );
}