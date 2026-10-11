"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase, type Categorie } from "@/lib/supabase";
import { normaliser } from "@/lib/texte";

type Ligne = { categorie: string; dossard: number; nom: string; prenom: string };

// Noms de colonnes acceptés (sans accents, majuscules ni espaces)
const COLONNES: Record<keyof Ligne, string[]> = {
  categorie: ["categorie", "categ", "danse", "discipline"],
  dossard: ["dossard", "numero", "num", "no", "n"],
  nom: ["nom", "nomdefamille"],
  prenom: ["prenom"],
};

async function lireFichier(fichier: File) {
  const wb = XLSX.read(await fichier.arrayBuffer());
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  if (rows.length === 0) throw new Error("Le fichier est vide.");

  const entetes = Object.keys(rows[0]);
  const col = Object.fromEntries(
    (Object.keys(COLONNES) as (keyof Ligne)[]).map((k) => [
      k,
      entetes.find((e) => COLONNES[k].includes(normaliser(e))),
    ])
  ) as Record<keyof Ligne, string | undefined>;

  const manquantes = Object.entries(col).filter(([, v]) => !v).map(([k]) => k);
  if (manquantes.length) {
    throw new Error(
      `Colonne(s) introuvable(s) : ${manquantes.join(", ")}. ` +
      `La 1re ligne du fichier doit contenir : Catégorie, Dossard, Nom, Prénom.`
    );
  }

  const lignes: Ligne[] = [];
  const erreurs: string[] = [];
  rows.forEach((r, i) => {
    const num = i + 2; // +2 : ligne d'en-tête + numérotation Excel
    const categorie = String(r[col.categorie!]).trim();
    const dossardTxt = String(r[col.dossard!]).trim();
    const dossard = parseInt(dossardTxt, 10);
    const nom = String(r[col.nom!]).trim();
    const prenom = String(r[col.prenom!]).trim();

    if (!categorie && !dossardTxt && !nom && !prenom) return; // ligne vide ignorée
    if (!categorie) erreurs.push(`Ligne ${num} : catégorie manquante`);
    else if (isNaN(dossard)) erreurs.push(`Ligne ${num} : dossard invalide (« ${dossardTxt} »)`);
    else if (!nom) erreurs.push(`Ligne ${num} : nom manquant`);
    else lignes.push({ categorie, dossard, nom, prenom });
  });

  const vus = new Set<string>();
  for (const l of lignes) {
    const cle = `${normaliser(l.categorie)}|${l.dossard}`;
    if (vus.has(cle)) erreurs.push(`Dossard ${l.dossard} en double dans « ${l.categorie} »`);
    vus.add(cle);
  }

  return { lignes, erreurs };
}

function telechargerModele() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Catégorie", "Dossard", "Nom", "Prénom"],
    ["Hip Hop", 1, "GENSEL", "Yoan"],
    ["Hip Hop", 2, "DIAZ", "Cynthia"],
    ["Ragga", 1, "LAGOUTTE", "Karim"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inscriptions");
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
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);

  const trouverCategorie = (nom: string) =>
    categories.find((c) => normaliser(c.nom) === normaliser(nom) || c.slug === normaliser(nom));

  // Aperçu : nombre de danseurs par catégorie du fichier
  const apercu = useMemo(() => {
    const groupes = new Map<string, { nom: string; nb: number }>();
    for (const l of lignes) {
      const cle = normaliser(l.categorie);
      const g = groupes.get(cle) ?? { nom: l.categorie, nb: 0 };
      g.nb++;
      groupes.set(cle, g);
    }
    return [...groupes.values()].map((g) => ({ ...g, existe: !!trouverCategorie(g.nom) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes, categories]);

  async function choisirFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // permet de rechoisir le même fichier
    if (!f) return;
    setMessage("");
    setNomFichier(f.name);
    try {
      const res = await lireFichier(f);
      setLignes(res.lignes);
      setErreurs(res.erreurs);
    } catch (err) {
      setLignes([]);
      setErreurs([(err as Error).message]);
    }
  }

  async function importer() {
    if (!confirm(
      "Remplacer TOUTE la liste des danseurs par ce fichier ?\n\n" +
      "Les présences et les sélections du jury actuelles seront effacées."
    )) return;

    setEnCours(true);
    setMessage("");
    try {
      // 1. Créer les catégories qui n'existent pas encore
      const ids = new Map<string, string>();
      for (const c of categories) {
        ids.set(normaliser(c.nom), c.id);
        ids.set(c.slug, c.id);
      }
      const slugsPris = new Set(categories.map((c) => c.slug));
      const aCreer = apercu.filter((g) => !g.existe);
      if (aCreer.length) {
        const ordreMax = Math.max(0, ...categories.map((c) => c.ordre));
        const nouvelles = aCreer.map((g, i) => {
          let slug = normaliser(g.nom) || "categorie";
          let n = 2;
          while (slugsPris.has(slug)) slug = `${normaliser(g.nom)}${n++}`;
          slugsPris.add(slug);
          return {
            nom: g.nom, slug, jury: 1, nb_passages: 1,
            retenus_par_passage: [0], retenus_repechage: 0, ordre: ordreMax + i + 1,
          };
        });
        const { data, error } = await supabase.from("categories").insert(nouvelles).select();
        if (error) throw error;
        for (const c of data ?? []) ids.set(normaliser(c.nom), c.id);
      }

      // 2. Vider la liste actuelle des danseurs
      const { error: errSuppr } = await supabase.from("danseurs").delete().not("id", "is", null);
      if (errSuppr) throw errSuppr;

      // 3. Insérer les nouveaux danseurs (par paquets de 500)
      const rows = lignes.map((l) => ({
        categorie_id: ids.get(normaliser(l.categorie))!,
        dossard: l.dossard,
        nom: l.nom,
        prenom: l.prenom,
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("danseurs").insert(rows.slice(i, i + 500));
        if (error) throw error;
      }

      setMessage(
        `✅ ${rows.length} danseurs importés` +
        (aCreer.length ? ` · ${aCreer.length} catégorie(s) créée(s), pense à régler leurs passages` : "")
      );
      setLignes([]);
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
      <p className="text-sm text-mk-gris">
        Fichier Excel avec, sur la 1re ligne, les colonnes <b className="text-mk-texte">Catégorie</b>,{" "}
        <b className="text-mk-texte">Dossard</b>, <b className="text-mk-texte">Nom</b> et{" "}
        <b className="text-mk-texte">Prénom</b>. L&apos;import remplace toute la liste actuelle.
      </p>

      {/* Exemple du tableau attendu, présenté comme dans Excel */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-mk-gris">Exemple de fichier attendu</p>
        <div className="overflow-x-auto rounded-md border border-mk-ligne">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-mk-noir text-xs text-mk-gris">
                <th className="w-8 border-r border-mk-ligne p-1"></th>
                {["A", "B", "C", "D"].map((l) => (
                  <th key={l} className="border-r border-mk-ligne p-1 font-semibold last:border-r-0">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Catégorie", "Dossard", "Nom", "Prénom"],
                ["Hip Hop", "1", "GENSEL", "Yoan"],
                ["Ragga", "1", "GENSEL", "Léa"],
                ["Hip Hop", "2", "DIAZ", "Cynthia"],
                ["Hip Hop", "3", "MAUGER", "Martin"],
                ["Ragga", "1", "LAROCHE", "Chloé"],
              ].map((ligne, i) => (
                <tr key={i} className={`border-t border-mk-ligne ${i === 0 ? "bg-mk-carte2 font-bold" : ""}`}>
                  <td className="border-r border-mk-ligne bg-mk-noir p-1 text-center text-xs text-mk-gris">{i + 1}</td>
                  {ligne.map((cellule, j) => (
                    <td key={j} className="border-r border-mk-ligne px-2 py-1 last:border-r-0">{cellule}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-mk-gris">
          <li>Une ligne = un danseur, à partir de la ligne 2.</li>
          <li>Les dossards peuvent repartir à 1 dans chaque catégorie, mais pas de doublon dans une même catégorie.</li>
          <li>Le nom de la catégorie doit être identique pour tous ses danseurs (majuscules et accents sont ignorés).</li>
          <li>Seule la 1re feuille du fichier est lue ; l&apos;ordre des colonnes n&apos;a pas d&apos;importance.</li>
        </ul>
      </div>

      <label className="mk-btn mk-btn-rouge cursor-pointer">
        Choisir un fichier Excel
        <input type="file" accept=".xlsx,.xls,.csv" onChange={choisirFichier} className="hidden" />
      </label>
      {nomFichier && <span className="ml-3 text-sm text-mk-gris">{nomFichier}</span>}

      {erreurs.length > 0 && (
        <div className="space-y-1 rounded-md border border-mk-rouge/50 bg-mk-rouge/10 p-3 text-sm text-red-300">
          <p className="font-semibold">À corriger dans le fichier avant l&apos;import :</p>
          <ul className="list-disc pl-5 max-h-48 overflow-y-auto">
            {erreurs.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {lignes.length > 0 && erreurs.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">{lignes.length} danseurs trouvés :</p>
          <ul className="divide-y divide-mk-ligne rounded-md border border-mk-ligne text-sm">
            {apercu.map((g) => (
              <li key={g.nom} className="flex justify-between px-3 py-2">
                <span>
                  {g.nom}
                  {!g.existe && (
                    <span className="ml-2 rounded bg-mk-rouge/20 px-2 py-0.5 text-xs font-semibold text-red-300">
                      nouvelle catégorie
                    </span>
                  )}
                </span>
                <span className="font-semibold">{g.nb}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={importer}
            disabled={enCours}
            className="mk-btn bg-ok text-white"
          >
            {enCours ? "Import en cours…" : "Importer et remplacer la liste"}
          </button>
        </div>
      )}

      {message && <p className="text-sm font-semibold">{message}</p>}
    </section>
  );
}