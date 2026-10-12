import type { Danseur, Reglages } from "./supabase";

// Affiche le dossard sur 2 chiffres : 1 → "01"
export const fmt = (n: number) => String(n).padStart(2, "0");

// Danseurs en compétition : uniquement ceux pointés PRÉSENTS, dans l'ordre des dossards
export function actifs(danseurs: Danseur[]) {
  return danseurs
    .filter((d) => d.present === true)
    .sort((a, b) => a.dossard - b.dossard);
}

// Répartit une liste en "nb" passages de tailles égales (à 1 près)
// ex : 30 danseurs en 4 passages → 8, 8, 7, 7
export function repartir<T>(liste: T[], nb: number): T[][] {
  const n = Math.max(1, nb);
  const base = Math.floor(liste.length / n);
  const reste = liste.length % n;
  const passages: T[][] = [];
  let i = 0;
  for (let p = 0; p < n; p++) {
    const taille = base + (p < reste ? 1 : 0);
    passages.push(liste.slice(i, i + taille));
    i += taille;
  }
  return passages;
}

// Finaliste = présent ET coché au 1er tour ou au repêchage
export const estFinaliste = (d: Danseur) => d.present === true && (d.qualif_t1 || d.qualif_rep);

// Tous les danseurs présents reçoivent une médaille :
// - 1er tour : sélectionné → finale, sinon → repêchage
// - Repêchage : sélectionné → finale, sinon → BRONZE
// - Finale : sélectionné → OR, sinon → ARGENT
export type Medaille = "or" | "argent" | "bronze" | null;
export function medaille(d: Danseur): Medaille {
  if (d.present !== true) return null; // absent ou pas encore pointé
  if (estFinaliste(d)) return d.or_finale ? "or" : "argent";
  return "bronze";
}

// Clics du jury : on garde les données cohérentes
export function basculerT1(d: Danseur): Partial<Danseur> {
  return d.qualif_t1
    ? { qualif_t1: false, or_finale: false }   // décoché → retourne au repêchage
    : { qualif_t1: true, qualif_rep: false };  // coché → qualifié direct
}
export function basculerRep(d: Danseur): Partial<Danseur> {
  return d.qualif_rep
    ? { qualif_rep: false, or_finale: false }
    : { qualif_rep: true };
}
export function basculerOr(d: Danseur): Partial<Danseur> {
  return { or_finale: !d.or_finale };
}

// ───────── Calcul automatique des passages ─────────
// Le nombre de passages découle du nombre de danseurs présents et de la place sur la piste.
// Ce sont les jurys qui décident combien de danseurs ils qualifient.
export const maxParPassage = (r: Reglages) => Math.max(1, r.lignes * r.par_ligne);

// ex : 45 danseurs, 2 lignes de 8 (= 16 max par passage) → 3 passages de 15
export function nbPassagesAuto(n: number, r: Reglages) {
  return Math.max(1, Math.ceil(n / maxParPassage(r)));
}

// ───────── Passages figés ─────────
// Avant le démarrage : passages provisoires recalculés en direct à partir des présents.
// Après le démarrage : chaque danseur garde son n° de passage ; un danseur pointé présent
// après le démarrage n'a pas de passage et va directement au repêchage.
export function passagesDuPremierTour(liste: Danseur[], demarree: boolean, r: Reglages): Danseur[][] {
  if (!demarree) return repartir(liste, nbPassagesAuto(liste.length, r));
  const nb = Math.max(0, ...liste.map((d) => d.passage ?? 0));
  const passages: Danseur[][] = Array.from({ length: nb }, () => []);
  for (const d of liste) if (d.passage) passages[d.passage - 1].push(d);
  return passages.filter((p) => p.length > 0);
}

// Arrivé après le démarrage (présent mais sans passage au 1er tour)
export const estRetardataire = (d: Danseur, demarree: boolean) =>
  demarree && d.present === true && !d.passage;