"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCategorie } from "@/lib/useCategorie";
import {
  actifs, repartir, fmt, basculerT1, basculerRep, basculerOr, lettre,
  passagesDuPremierTour, estRetardataire, nbPassages,
  aSelectionner, quotasParPassage, DIVISEURS,
} from "@/lib/competition";
import type { Danseur } from "@/lib/supabase";
import Entete, { Etat } from "@/components/Entete";

type Onglet = "t1" | "rep" | "finale";

const titrePassage = (i: number) => `${i + 1}${i === 0 ? "er" : "e"} passage`;

export default function VueCompetition({ slug, lectureSeule = false }: { slug: string; lectureSeule?: boolean }) {
  const { categorie, danseurs, reglages, chargement, erreur, modifier, demarrer } = useCategorie(slug);
  const [demarrage, setDemarrage] = useState(false);
  const [onglet, setOnglet] = useState<Onglet>("t1");

  // Seuls les danseurs pointés présents participent (absents par défaut)
  const liste = useMemo(() => actifs(danseurs), [danseurs]);
  const demarree = categorie?.demarree ?? false;

  // 1er tour : passages provisoires avant le démarrage, figés après
  const passagesT1 = useMemo(
    () => passagesDuPremierTour(liste, demarree, reglages, categorie?.nb_passages ?? 0),
    [liste, demarree, reglages, categorie?.nb_passages]
  );
  const nbT1 = passagesT1.reduce((a, p) => a + p.length, 0);
  const totalT1 = aSelectionner(nbT1, DIVISEURS.premierTour);
  const quotasT1 = quotasParPassage(passagesT1, totalT1);

  // Repêchage : tous les non-sélectionnés du 1er tour (+ retardataires), découpés en passages
  const retardataires = liste.filter((d) => estRetardataire(d, demarree)).length;
  const repechage = useMemo(() => liste.filter((d) => !d.qualif_t1), [liste]);
  const passagesRep = useMemo(
    () => repartir(repechage, nbPassages(repechage.length, reglages, categorie?.passages_rep ?? 0)),
    [repechage, reglages, categorie?.passages_rep]
  );
  const totalRep = aSelectionner(repechage.length, DIVISEURS.repechage);
  const quotasRep = quotasParPassage(passagesRep, totalRep);

  // Finale : sélectionnés du 1er tour + du repêchage, découpés en passages
  const finale = useMemo(() => liste.filter((d) => d.qualif_t1 || d.qualif_rep), [liste]);
  const passagesFinale = useMemo(
    () => repartir(finale, nbPassages(finale.length, reglages, categorie?.passages_finale ?? 0)),
    [finale, reglages, categorie?.passages_finale]
  );
  const totalOr = aSelectionner(finale.length, DIVISEURS.finale);
  const quotasOr = quotasParPassage(passagesFinale, totalOr);

  if (chargement) return <Etat texte="Chargement…" />;
  if (erreur || !categorie) return <Etat texte={erreur ?? "Erreur"} erreur />;

  const clic = (f: (d: Danseur) => Partial<Danseur>) =>
    lectureSeule ? undefined : (d: Danseur) => modifier(d, f(d));

  // Préparateurs : aucune couleur ni compteur de sélection (seuls le jury et le secrétariat savent)
  const coche = (f: (d: Danseur) => boolean) => (lectureSeule ? () => false : f);

  async function clicDemarrer() {
    const msg =
      `Démarrer « ${categorie!.nom} » ?\n\n` +
      `Les ${passagesT1.length} passages seront figés avec les ${liste.length} danseurs pointés présents.\n\n` +
      `Un danseur pointé présent plus tard ira directement en demi-finale.`;
    if (!confirm(msg)) return;
    setDemarrage(true);
    await demarrer();
    setDemarrage(false);
  }

  const onglets: { id: Onglet; label: string }[] = [
    { id: "t1", label: "1er tour" },
    { id: "rep", label: "Demi-finale" },
    { id: "finale", label: "Finale" },
  ];

  const jury = lettre(categorie.jury);

  return (
    <main className="min-h-screen">
      <Entete
        titre={categorie.nom}
        sousTitre={`${lectureSeule ? "Préparateur" : "Jury"} ${jury} · Piste ${jury} · ${liste.length} présents`}
        droite={
          <Link
            href={`/espace/${lectureSeule ? "preparateur" : "jury"}/${jury.toLowerCase()}`}
            className="mk-btn mk-btn-contour shrink-0 px-3 py-1.5 text-xs"
          >
            ☰ Catégories
          </Link>
        }
      >
        {!demarree ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            <span>
              ⏳ Passages <b>provisoires</b> (suivent le pointage)
              {lectureSeule && " · en attente du démarrage par le jury"}
            </span>
            {!lectureSeule && (
              <button onClick={clicDemarrer} disabled={demarrage || liste.length === 0} className="mk-btn mk-btn-rouge">
                {demarrage ? "Démarrage…" : "▶ Démarrer la catégorie"}
              </button>
            )}
          </div>
        ) : (
          retardataires > 0 && (
            <p className="rounded-md border border-mk-ligne bg-mk-carte px-3 py-2 text-sm text-mk-gris">
              🔒 Passages figés · <b className="text-mk-texte">{retardataires} retardataire(s)</b> ajouté(s) en demi-finale
            </p>
          )
        )}
        <nav className="grid grid-cols-3 gap-2">
          {onglets.map((o) => (
            <button
              key={o.id}
              onClick={() => setOnglet(o.id)}
              className={`mk-onglet ${onglet === o.id ? "mk-onglet-actif" : ""}`}
            >
              {o.label}
            </button>
          ))}
        </nav>
      </Entete>

      <div className="mx-auto max-w-5xl space-y-3 p-3">
        {onglet === "t1" && (
          <>
            <Resume
              danseurs={nbT1}
              passages={passagesT1.length}
              total={totalT1}
              regle="1/3 sélectionnés pour la finale"
              quotas={quotasT1}
              masquer={lectureSeule}
            />
            {passagesT1.map((p, i) => (
              <Passage
                key={i}
                parLigne={reglages.par_ligne}
                titre={titrePassage(i)}
                danseurs={p}
                aRetenir={quotasT1[i]}
                estCoche={coche((d) => d.qualif_t1)}
                compteur={!lectureSeule}
                onClic={demarree ? clic(basculerT1) : undefined}
                consigne={
                  lectureSeule
                    ? "Ordre de passage sur la piste"
                    : !demarree
                      ? "Aperçu · le jury pourra sélectionner une fois la catégorie démarrée"
                      : "Touchez les dossards qualifiés pour la finale · les autres vont en demi-finale"
                }
              />
            ))}
          </>
        )}

        {onglet === "rep" && (
          <>
            <Resume
              danseurs={repechage.length}
              passages={passagesRep.length}
              total={totalRep}
              regle="1/2 sélectionnés pour la finale"
              quotas={quotasRep}
              masquer={lectureSeule}
            />
            {passagesRep.map((p, i) => (
              <Passage
                key={i}
                parLigne={reglages.par_ligne}
                titre={titrePassage(i)}
                danseurs={p}
                aRetenir={quotasRep[i]}
                estCoche={coche((d) => d.qualif_rep)}
                compteur={!lectureSeule}
                onClic={clic(basculerRep)}
                etiquette={retardataires > 0 ? (d) => (estRetardataire(d, demarree) ? "retard" : "") : undefined}
                consigne={
                  lectureSeule
                    ? "Danseurs à préparer pour la demi-finale"
                    : "Touchez les dossards qualifiés pour la finale · les autres = Bronze"
                }
              />
            ))}
          </>
        )}

        {onglet === "finale" && (
          <>
            <Resume
              danseurs={finale.length}
              passages={passagesFinale.length}
              total={totalOr}
              regle="1/2 en médaille d'Or (arrondi au-dessus)"
              quotas={quotasOr}
              libelle="médailles d'Or"
              masquer={lectureSeule}
            />
            {passagesFinale.map((p, i) => (
              <Passage
                key={i}
                parLigne={reglages.par_ligne}
                titre={passagesFinale.length > 1 ? `Finale · ${titrePassage(i)}` : "Finale"}
                danseurs={p}
                aRetenir={quotasOr[i]}
                estCoche={coche((d) => d.or_finale)}
                compteur={!lectureSeule}
                onClic={clic(basculerOr)}
                consigne={lectureSeule ? "Danseurs à préparer pour la finale" : "Doré = médaille d’Or · Non sélectionnés = Argent"}
                coulCoche="bg-or text-black"
                etiquette={lectureSeule ? undefined : (d) => (d.qualif_t1 ? "1T" : "DF")}
              />
            ))}
          </>
        )}
      </div>
    </main>
  );
}

// Bandeau récapitulatif d'un tour : ex. « 30 danseurs · 3 passages · 10 à sélectionner (4 / 3 / 3) »
function Resume({
  danseurs, passages, total, regle, quotas, libelle = "à sélectionner", masquer = false,
}: {
  masquer?: boolean;
  danseurs: number;
  passages: number;
  total: number;
  regle: string;
  quotas: number[];
  libelle?: string;
}) {
  if (danseurs === 0) {
    return <p className="mk-carte text-center text-mk-gris">Aucun danseur pour l&apos;instant</p>;
  }
  return (
    <div className="mk-carte flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span><b className="text-lg">{danseurs}</b> <span className="text-mk-gris">danseurs</span></span>
      <span><b className="text-lg">{passages}</b> <span className="text-mk-gris">passage{passages > 1 ? "s" : ""}</span></span>
      {!masquer && (
        <>
          <span>
            <b className="text-lg text-mk-rouge">{total}</b> <span className="text-mk-gris">{libelle}</span>
            {quotas.length > 1 && <span className="text-mk-gris"> ({quotas.join(" / ")})</span>}
          </span>
          <span className="w-full text-xs text-mk-gris sm:ml-auto sm:w-auto">Règle : {regle}</span>
        </>
      )}
    </div>
  );
}

function Passage({
  titre, danseurs, aRetenir, estCoche, onClic, consigne,
  coulCoche = "bg-mk-rouge text-white", etiquette, parLigne, compteur = true,
}: {
  compteur?: boolean;
  titre: string;
  parLigne: number;
  danseurs: Danseur[];
  aRetenir: number;
  estCoche: (d: Danseur) => boolean;
  onClic?: (d: Danseur) => void;
  consigne: string;
  coulCoche?: string;
  etiquette?: (d: Danseur) => string;
}) {
  const nb = danseurs.filter(estCoche).length;
  const depasse = aRetenir > 0 && nb > aRetenir;
  const complet = aRetenir > 0 && nb === aRetenir;
  // Quota atteint (jury uniquement) : on ne peut plus sélectionner de nouveau dossard,
  // il faut d'abord en désélectionner un
  const verrouille = !!onClic && compteur && aRetenir > 0 && nb >= aRetenir;

  // Lignes équilibrées : 21 danseurs avec 8 max par ligne → 3 lignes de 7 (et non 8 · 8 · 5)
  const nbLignes = Math.max(1, Math.ceil(danseurs.length / Math.max(1, parLigne)));
  const lignes = repartir(danseurs, nbLignes);
  const colonnes = Math.max(1, ...lignes.map((l) => l.length));

  return (
    <section className={`mk-carte space-y-3 transition ${verrouille ? "bg-mk-noir/60" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={`mk-titre text-lg ${verrouille ? "text-mk-gris" : ""}`}>{titre}</h2>
        <span className="text-xs font-semibold uppercase text-mk-gris">{danseurs.length} danseurs</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-mk-gris">{consigne}</p>
        {compteur && (
          <span
            className={`rounded-md px-3 py-1 text-sm font-bold ${
              depasse ? "bg-mk-rouge text-white" : complet ? "bg-ok text-white" : "bg-mk-carte2 text-white"
            }`}
          >
            {verrouille && !depasse && "✔ "}
            {nb}{aRetenir > 0 && ` / ${aRetenir}`} sélectionné{nb > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {/* Lignes affichées de bas en haut : les plus petits dossards sont sur la ligne du bas
            (chaque ligne se lit toujours de gauche à droite) */}
        {danseurs.length > 0 && lignes.map((ligne, li) => ({ ligne, li })).reverse().map(({ ligne, li }) => (
          <div key={li} className="flex items-center gap-2">
            {nbLignes > 1 && (
              <span className="w-5 shrink-0 text-center text-[10px] font-bold uppercase text-mk-gris">L{li + 1}</span>
            )}
            <div
              className="grid flex-1 gap-1.5 sm:gap-2"
              style={{ gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))` }}
            >
              {ligne.map((d) => {
                const bloque = verrouille && !estCoche(d); // non sélectionné alors que le quota est atteint
                const style = `rounded-md py-3 text-center text-base font-extrabold tabular-nums transition sm:text-xl ${
                  estCoche(d) ? coulCoche : "bg-mk-carte2 text-white"
                } ${bloque ? "cursor-not-allowed opacity-35" : onClic ? "active:scale-95" : ""}`;
                const contenu = (
                  <>
                    {fmt(d.dossard)}
                    {etiquette && <div className="text-[10px] font-semibold opacity-70">{etiquette(d)}</div>}
                  </>
                );
                return onClic ? (
                  <button key={d.id} onClick={() => onClic(d)} disabled={bloque} className={style}>{contenu}</button>
                ) : (
                  <div key={d.id} className={style}>{contenu}</div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {danseurs.length === 0 && <p className="text-sm text-mk-gris">Aucun danseur</p>}
    </section>
  );
}