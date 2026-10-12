import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Categorie = {
  id: string;
  nom: string;
  slug: string;
  jury: 1 | 2;
  nb_passages: number;           // plus utilisé : les passages sont calculés automatiquement
  retenus_par_passage: number[]; // plus utilisé : le jury qualifie librement
  retenus_repechage: number;     // plus utilisé
  ordre: number;
  demarree: boolean;             // true = 1er tour démarré, passages figés
};

export type Danseur = {
  id: string;
  categorie_id: string;
  dossard: number;
  nom: string;
  prenom: string;
  present: boolean | null;
  qualif_t1: boolean;
  qualif_rep: boolean;
  or_finale: boolean;
  passage: number | null;        // n° de passage figé au démarrage (null = pas encore placé)
};

// Réglages généraux de la compétition (une seule ligne, id = 1)
export type Reglages = {
  id: number;
  lignes: number;    // lignes de danseurs sur la piste pendant un passage
  par_ligne: number; // danseurs maximum par ligne
};

export const REGLAGES_DEFAUT: Reglages = { id: 1, lignes: 2, par_ligne: 8 };