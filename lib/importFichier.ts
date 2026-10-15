import * as XLSX from "xlsx";
import { normaliser } from "./texte";

// ───────── Lecture du fichier d'inscriptions de l'école ─────────
// Format Markadas : un onglet par catégorie.
//   - nom de l'onglet : « A - HIP-HOP DEBINT », « B- RAGGA INTAV », « U- GIRLY »… (A / B = piste)
//   - en haut : le titre de la catégorie (ex. « HIP-HOP DEB-INTER »)
//   - puis une ligne d'en-têtes : Club | NOM | PRENOM | N° | Présent | …
//   - puis une ligne par danseur ; les lignes avec un dossard mais sans nom (numéros réservés) sont ignorées
// Ancien format accepté aussi : une seule feuille avec les colonnes Catégorie | Dossard | Nom | Prénom.

export type Piste = "A" | "B" | "";

export type DanseurImport = { dossard: number; nom: string; prenom: string };

export type CategorieImport = {
  nom: string;     // nom qui sera utilisé dans l'app
  onglet: string;  // onglet d'origine (pour l'affichage)
  piste: Piste;    // "" = à choisir (onglet « U » ou sans lettre)
  danseurs: DanseurImport[];
};

export type ResultatLecture = {
  categories: CategorieImport[];
  erreurs: string[];   // bloquantes
  infos: string[];     // onglets ignorés, etc.
};

const COL_NOM = ["nom", "nomdefamille"];
const COL_PRENOM = ["prenom", "prenoms"];
const COL_DOSSARD = ["n", "no", "num", "numero", "dossard", "ndossard"];
const COL_CATEGORIE = ["categorie", "categ", "discipline"];

const texte = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const trouver = (entetes: string[], noms: string[]) => entetes.findIndex((e) => noms.includes(e));

function lireDossard(v: unknown): number | null {
  const s = texte(v);
  if (!/^\d+(\.0+)?$/.test(s)) return null;
  return parseInt(s, 10);
}

// « A - STAR KIDS » → A ; « B- RAGGA » → B ; « U- GIRLY » → "" (à choisir)
function pisteDepuisOnglet(onglet: string): { piste: Piste; lettre: string } {
  const m = onglet.match(/^\s*([A-Za-z])\s*[-–—_:]/);
  const lettre = m ? m[1].toUpperCase() : "";
  return { piste: lettre === "A" || lettre === "B" ? lettre : "", lettre };
}

export function lireClasseur(wb: XLSX.WorkBook): ResultatLecture {
  const categories: CategorieImport[] = [];
  const erreurs: string[] = [];
  const infos: string[] = [];

  for (const onglet of wb.SheetNames) {
    const ws = wb.Sheets[onglet];
    if (!ws || !ws["!ref"]) {
      infos.push(`Onglet « ${onglet} » vide : ignoré`);
      continue;
    }
    const debut = XLSX.utils.decode_range(ws["!ref"]).s.r; // pour retrouver les n° de ligne Excel
    const lignes = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", blankrows: true, raw: true });

    // Ligne d'en-têtes : dans les 15 premières lignes
    let iEntete = -1;
    let cols = { nom: -1, prenom: -1, dossard: -1, categorie: -1 };
    for (let i = 0; i < Math.min(15, lignes.length); i++) {
      const entetes = (lignes[i] ?? []).map((c) => normaliser(texte(c)));
      const c = {
        nom: trouver(entetes, COL_NOM),
        prenom: trouver(entetes, COL_PRENOM),
        dossard: trouver(entetes, COL_DOSSARD),
        categorie: trouver(entetes, COL_CATEGORIE),
      };
      if (c.nom >= 0 && c.dossard >= 0) {
        iEntete = i;
        cols = c;
        break;
      }
    }
    if (iEntete < 0) {
      infos.push(`Onglet « ${onglet} » : pas de colonnes NOM et N° → ignoré`);
      continue;
    }

    const numLigne = (i: number) => debut + i + 1;

    // ── Ancien format : une colonne Catégorie sur chaque ligne ──
    if (cols.categorie >= 0) {
      const parCategorie = new Map<string, CategorieImport>();
      for (let i = iEntete + 1; i < lignes.length; i++) {
        const r = lignes[i] ?? [];
        const nom = texte(r[cols.nom]);
        const cat = texte(r[cols.categorie]);
        if (!nom) continue;
        const dossard = lireDossard(r[cols.dossard]);
        if (!cat) { erreurs.push(`« ${onglet} », ligne ${numLigne(i)} : catégorie manquante`); continue; }
        if (dossard === null) { erreurs.push(`« ${onglet} », ligne ${numLigne(i)} : dossard invalide (« ${texte(r[cols.dossard])} »)`); continue; }
        const cle = normaliser(cat);
        if (!parCategorie.has(cle)) parCategorie.set(cle, { nom: cat, onglet, piste: "", danseurs: [] });
        parCategorie.get(cle)!.danseurs.push({ dossard, nom, prenom: cols.prenom >= 0 ? texte(r[cols.prenom]) : "" });
      }
      categories.push(...parCategorie.values());
      continue;
    }

    // ── Format Markadas : un onglet = une catégorie ──
    // Titre : première cellule non vide au-dessus des en-têtes ; sinon le nom de l'onglet sans la lettre
    let titre = "";
    for (let i = 0; i < iEntete && !titre; i++) {
      titre = texte((lignes[i] ?? []).find((c) => texte(c)));
    }
    const { piste, lettre } = pisteDepuisOnglet(onglet);
    if (!titre) titre = texte(onglet.replace(/^\s*[A-Za-z]\s*[-–—_:]\s*/, ""));
    if (lettre && !piste) infos.push(`Onglet « ${onglet} » : piste « ${lettre} » → à choisir (A ou B) avant l'import`);

    const danseurs: DanseurImport[] = [];
    for (let i = iEntete + 1; i < lignes.length; i++) {
      const r = lignes[i] ?? [];
      const nom = texte(r[cols.nom]);
      if (!nom) continue; // ligne vide ou dossard réservé sans danseur
      const dossard = lireDossard(r[cols.dossard]);
      if (dossard === null) {
        erreurs.push(`« ${onglet} », ligne ${numLigne(i)} (${nom}) : dossard manquant ou invalide`);
        continue;
      }
      danseurs.push({ dossard, nom, prenom: cols.prenom >= 0 ? texte(r[cols.prenom]) : "" });
    }
    if (!danseurs.length) {
      infos.push(`Onglet « ${onglet} » : aucun danseur → ignoré`);
      continue;
    }
    categories.push({ nom: titre, onglet, piste, danseurs });
  }

  // Deux onglets avec le même titre (ex. STAR KIDS 5-8 ANS sur la piste A et sur la piste B)
  // → on ajoute la piste au nom pour les distinguer
  const compte = new Map<string, number>();
  for (const c of categories) compte.set(normaliser(c.nom), (compte.get(normaliser(c.nom)) ?? 0) + 1);
  for (const c of categories) {
    if ((compte.get(normaliser(c.nom)) ?? 0) > 1) c.nom = `${c.nom} · ${c.piste ? `Piste ${c.piste}` : c.onglet}`;
  }

  // Dossards en double dans une même catégorie
  for (const c of categories) {
    const vus = new Set<number>();
    for (const d of c.danseurs) {
      if (vus.has(d.dossard)) erreurs.push(`« ${c.nom} » : dossard ${d.dossard} en double`);
      vus.add(d.dossard);
    }
  }

  if (!categories.length && !erreurs.length) {
    erreurs.push("Aucun danseur trouvé. Chaque onglet doit contenir une ligne d'en-têtes avec NOM, PRENOM et N°.");
  }
  return { categories, erreurs, infos };
}