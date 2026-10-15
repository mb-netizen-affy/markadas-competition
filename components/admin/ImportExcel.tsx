"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase, type Categorie } from "@/lib/supabase";
import { normaliser } from "@/lib/texte";
import { lireClasseur, type CategorieImport, type Piste } from "@/lib/importFichier";

// Fichier modèle au format de l'école : un onglet par catégorie
function telechargerModele() {
  const wb = XLSX.utils.book_new();
  const onglet = (titre: string, debut: number, danseurs: [string, string, string][]) =>
    XLSX.utils.aoa_to_sheet([
      [titre],
      ["Club", "NOM", "PRENOM", "N°", "Présent", "Bronze", "O/A", "ARG", "OR"],
      ...danseurs.map(([club, nom, prenom], i) => [club, nom, prenom, debut + i]),
    ]);
  XLSX.utils.book_append_sheet(
    wb,
    onglet("HIP-HOP DEB-INTER", 600, [["BRON", "DUPONT", "Léa"], ["", "MARTIN", "Inès"], ["SP", "BERNARD", "Noah"]]),
    "A- HIP-HOP DEBINT"
  );
  XLSX.utils.book_append_sheet(
    wb,
    onglet("RAGGA INTER-AVANCE", 1500, [["MZ", "PETIT", "Jade"], ["", "ROUX", "Lina"]]),
    "B- RAGGA INTAV"
  );
  XLSX.writeFile(wb, "modele-inscriptions-markadas.xlsx");
}

export default function ImportExcel({
  categories,
  onImport,
}: {
  categories: Categorie[];
  onImport: () => void;
}) {
  const [nomFichier, setNomFichier] = useState("");
  const [lues, setLues] = useState<CategorieImport[]>([]);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [infos, setInfos] = useState<string[]>([]);
  const [supprimerAbsentes, setSupprimerAbsentes] = useState(true);
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);

  const existante = (nom: string) => categories.find((c) => normaliser(c.nom) === normaliser(nom));
  const total = lues.reduce((a, c) => a + c.danseurs.length, 0);
  const pisteManquante = lues.some((c) => !c.piste);
  const absentes = categories.filter((c) => !lues.some((l) => normaliser(l.nom) === normaliser(c.nom)));

  async function choisirFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // permet de rechoisir le même fichier
    if (!f) return;
    setMessage("");
    setNomFichier(f.name);
    try {
      const res = lireClasseur(XLSX.read(await f.arrayBuffer()));
      // Catégorie déjà connue sans piste dans le fichier : on garde sa piste actuelle
      for (const c of res.categories) {
        const ex = categories.find((x) => normaliser(x.nom) === normaliser(c.nom));
        if (!c.piste && ex && c.onglet && !/^\s*[A-Za-z]\s*[-–—_:]/.test(c.onglet)) c.piste = ex.jury === 2 ? "B" : "A";
      }
      setLues(res.categories);
      setErreurs(res.erreurs);
      setInfos(res.infos);
    } catch (err) {
      setLues([]);
      setInfos([]);
      setErreurs(["Fichier illisible : " + (err as Error).message]);
    }
  }

  function changerPiste(i: number, piste: Piste) {
    setLues((prev) => prev.map((c, j) => (j === i ? { ...c, piste } : c)));
  }

  async function importer() {
    if (pisteManquante) return alert("Choisis la piste (A ou B) de chaque catégorie avant d'importer.");
    if (!confirm(
      `Importer ${total} danseurs dans ${lues.length} catégories ?\n\n` +
      "La liste actuelle des danseurs sera remplacée : présences, passages et sélections du jury seront effacés." +
      (supprimerAbsentes && absentes.length ? `\n\n${absentes.length} catégorie(s) absente(s) du fichier seront supprimées.` : "")
    )) return;

    setEnCours(true);
    setMessage("");
    try {
      // 1. Catégories : mise à jour (piste, ordre) ou création, dans l'ordre des onglets
      const ids = new Map<string, string>();
      const slugsPris = new Set(categories.map((c) => c.slug));
      let creees = 0;
      for (let i = 0; i < lues.length; i++) {
        const l = lues[i];
        const jury = l.piste === "B" ? 2 : 1;
        const ex = existante(l.nom);
        if (ex) {
          const { error } = await supabase.from("categories").update({ jury, ordre: i + 1 }).eq("id", ex.id);
          if (error) throw error;
          ids.set(normaliser(l.nom), ex.id);
        } else {
          let slug = normaliser(l.nom) || "categorie";
          for (let n = 2; slugsPris.has(slug); n++) slug = `${normaliser(l.nom)}${n}`;
          slugsPris.add(slug);
          const { data, error } = await supabase
            .from("categories")
            .insert({
              nom: l.nom, slug, jury, ordre: i + 1,
              nb_passages: 0, passages_rep: 0, passages_finale: 0,
              retenus_par_passage: [0], retenus_repechage: 0,
            })
            .select()
            .single();
          if (error) throw error;
          ids.set(normaliser(l.nom), data.id);
          creees++;
        }
      }

      // 2. Catégories absentes du fichier (ex. catégories de test)
      if (supprimerAbsentes && absentes.length) {
        const { error } = await supabase.from("categories").delete().in("id", absentes.map((c) => c.id));
        if (error) throw error;
      }

      // 3. On repart d'une liste vide
      await supabase.from("categories").update({ demarree: false }).not("id", "is", null);
      const { error: errSuppr } = await supabase.from("danseurs").delete().not("id", "is", null);
      if (errSuppr) throw errSuppr;

      // 4. Danseurs (par paquets de 500), absents par défaut
      const rows = lues.flatMap((l) =>
        l.danseurs.map((d) => ({
          categorie_id: ids.get(normaliser(l.nom))!,
          dossard: d.dossard,
          nom: d.nom,
          prenom: d.prenom,
          present: false,
        }))
      );
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("danseurs").insert(rows.slice(i, i + 500));
        if (error) throw error;
      }

      setMessage(
        `✅ ${rows.length} danseurs importés dans ${lues.length} catégories` +
        (creees ? ` · ${creees} catégorie(s) créée(s)` : "") +
        (supprimerAbsentes && absentes.length ? ` · ${absentes.length} supprimée(s)` : "")
      );
      setLues([]);
      setInfos([]);
      setNomFichier("");
      onImport();
    } catch (err) {
      setMessage("❌ Erreur : " + (err as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="mk-carte space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="mk-titre text-lg">Importer la liste des danseurs</h2>
        <button onClick={telechargerModele} className="mk-lien text-sm">
          Télécharger un fichier modèle
        </button>
      </div>

      <div className="space-y-2 text-sm text-mk-gris">
        <p>
          Importe directement le <b className="text-mk-texte">fichier Excel de l&apos;école</b>, tel quel :{" "}
          <b className="text-mk-texte">un onglet par catégorie</b>.
        </p>
        <ul className="list-disc space-y-0.5 pl-5 text-xs">
          <li>
            Le nom de l&apos;onglet commence par la piste : <b className="text-mk-texte">A -</b> ou{" "}
            <b className="text-mk-texte">B -</b> (ex. « A- HIP-HOP DEBINT »). Pour les autres (ex. « U- »), tu choisis la piste ci-dessous.
          </li>
          <li>Le titre en haut de l&apos;onglet devient le nom de la catégorie.</li>
          <li>Colonnes lues : <b className="text-mk-texte">NOM</b>, <b className="text-mk-texte">PRENOM</b> et <b className="text-mk-texte">N°</b> (les autres sont ignorées).</li>
          <li>Les numéros réservés sans nom sont ignorés ; les onglets sans colonne N° (ex. DÉMOS) aussi.</li>
          <li>L&apos;import <b className="text-mk-texte">remplace toute la liste</b> actuelle ; tous les danseurs arrivent « absents ».</li>
        </ul>
      </div>

      <label className="mk-btn mk-btn-rouge cursor-pointer">
        Choisir le fichier Excel
        <input type="file" accept=".xlsx,.xls,.csv" onChange={choisirFichier} className="hidden" />
      </label>
      {nomFichier && <span className="ml-3 text-sm text-mk-gris">{nomFichier}</span>}

      {erreurs.length > 0 && (
        <div className="space-y-1 rounded-md border border-mk-rouge/50 bg-mk-rouge/10 p-3 text-sm text-red-300">
          <p className="font-semibold">À corriger dans le fichier avant l&apos;import :</p>
          <ul className="max-h-48 list-disc overflow-y-auto pl-5">
            {erreurs.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {infos.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded-md bg-mk-carte2 p-3 pl-7 text-xs text-mk-gris">
          {infos.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}

      {lues.length > 0 && erreurs.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">
            {total} danseurs dans {lues.length} catégories :
          </p>
          <div className="overflow-x-auto rounded-md border border-mk-ligne">
            <table className="w-full text-sm">
              <thead className="bg-mk-carte2 text-left text-xs uppercase tracking-wider text-mk-gris">
                <tr>
                  <th className="p-2">Piste</th>
                  <th className="p-2">Catégorie</th>
                  <th className="p-2">Onglet</th>
                  <th className="p-2 text-center">Danseurs</th>
                  <th className="p-2">Dossards</th>
                </tr>
              </thead>
              <tbody>
                {lues.map((c, i) => {
                  const ds = c.danseurs.map((d) => d.dossard);
                  return (
                    <tr key={i} className="border-t border-mk-ligne">
                      <td className="p-2">
                        <select
                          value={c.piste}
                          onChange={(e) => changerPiste(i, e.target.value as Piste)}
                          className={`rounded-md border bg-mk-noir px-2 py-1 font-bold ${
                            c.piste ? "border-mk-ligne" : "border-amber-500 text-amber-300"
                          }`}
                        >
                          <option value="">À choisir</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                        </select>
                      </td>
                      <td className="p-2 font-bold uppercase">
                        {c.nom}
                        {!existante(c.nom) && (
                          <span className="ml-2 rounded bg-mk-rouge/20 px-1.5 py-0.5 text-[10px] font-semibold normal-case text-red-300">
                            nouvelle
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-xs text-mk-gris">{c.onglet}</td>
                      <td className="p-2 text-center font-semibold">{c.danseurs.length}</td>
                      <td className="whitespace-nowrap p-2 text-xs text-mk-gris">
                        {Math.min(...ds)} → {Math.max(...ds)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {absentes.length > 0 && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={supprimerAbsentes}
                onChange={(e) => setSupprimerAbsentes(e.target.checked)}
                className="mt-1"
              />
              <span>
                Supprimer les {absentes.length} catégorie(s) qui ne sont pas dans le fichier
                <span className="block text-xs text-mk-gris">{absentes.map((c) => c.nom).join(", ")}</span>
              </span>
            </label>
          )}

          {pisteManquante && (
            <p className="text-sm font-semibold text-amber-300">
              ⚠️ Choisis la piste (A ou B) des catégories marquées « À choisir ».
            </p>
          )}

          <button onClick={importer} disabled={enCours || pisteManquante} className="mk-btn bg-ok text-white">
            {enCours ? "Import en cours…" : "Importer et remplacer la liste"}
          </button>
        </div>
      )}

      {message && <p className="text-sm font-semibold">{message}</p>}
    </section>
  );
}