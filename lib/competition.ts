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

// Or = coché en finale ; Argent = finaliste du 1er tour ; Bronze = finaliste du repêchage
export type Medaille = "or" | "argent" | "bronze" | null;
export function medaille(d: Danseur): Medaille {
  if (!estFinaliste(d)) return null;
  if (d.or_finale) return "or";
  return d.qualif_t1 ? "argent" : "bronze";
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