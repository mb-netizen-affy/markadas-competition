"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCategorie } from "@/lib/useCategorie";
import { actifs, repartir, fmt, basculerT1, basculerRep, basculerOr, nbPassagesAuto } from "@/lib/competition";
import type { Danseur } from "@/lib/supabase";
import Entete, { Etat } from "@/components/Entete";

type Onglet = "t1" | "rep" | "finale";

export default function VueCompetition({ slug, lectureSeule = false }: { slug: string; lectureSeule?: boolean }) {
  const { categorie, danseurs, reglages, chargement, erreur, modifier } = useCategorie(slug);
  const [onglet, setOnglet] = useState<Onglet>("t1");

  const liste = useMemo(() => actifs(danseurs), [danseurs]);
  const nonPointes = danseurs.filter((d) => d.present === null).length;
  // Nombre de passages calculé automatiquement selon les présents et la place sur la piste
  const passagesT1 = useMemo(
    () => repartir(liste, nbPassagesAuto(liste.length, reglages)),
    [liste, reglages]
  );
  const repechage = useMemo(() => liste.filter((d) => !d.qualif_t1), [liste]);
  const finale = useMemo(() => liste.filter((d) => d.qualif_t1 || d.qualif_rep), [liste]);

  if (chargement) return <Etat texte="Chargement…" />;
  if (erreur || !categorie) return <Etat texte={erreur ?? "Erreur"} erreur />;

  const clic = (f: (d: Danseur) => Partial<Danseur>) =>
    lectureSeule ? undefined : (d: Danseur) => modifier(d, f(d));

  const onglets: { id: Onglet; label: string }[] = [
    { id: "t1", label: "1er tour" },
    { id: "rep", label: "Repêchage" },
    { id: "finale", label: "Finale" },
  ];

  return (
    <main className="min-h-screen">
      <Entete
        titre={categorie.nom}
        sousTitre={`${lectureSeule ? "Préparateur" : "Jury"} ${categorie.jury} · ${liste.length} présents · ${passagesT1.length} passage${passagesT1.length > 1 ? "s" : ""}`}
        droite={
          <Link
            href={`/espace/${lectureSeule ? "preparateur" : "jury"}/${categorie.jury}`}
            className="mk-btn mk-btn-contour shrink-0 px-3 py-1.5 text-xs"
          >
            ☰ Catégories
          </Link>
        }
      >
        {nonPointes > 0 && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            ⚠️ {nonPointes} danseur(s) pas encore pointé(s) : ils n&apos;apparaissent pas tant
            qu&apos;ils ne sont pas déclarés présents, et les passages peuvent encore bouger.
          </p>
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
        {onglet === "t1" &&
          passagesT1.map((p, i) => (
            <Passage
              parLigne={reglages.par_ligne}
              key={i}
              titre={`${i + 1}${i === 0 ? "er" : "e"} passage`}
              danseurs={p}
              aRetenir={0}
              estCoche={(d) => d.qualif_t1}
              onClic={clic(basculerT1)}
              consigne={lectureSeule ? "En rouge : qualifiés directement en finale · les autres vont au repêchage" : "Touchez les dossards qualifiés pour la finale · les autres vont au repêchage"}
            />
          ))}

        {onglet === "rep" && (
          <Passage
              parLigne={reglages.par_ligne}
            titre="Passage unique"
            danseurs={repechage}
            aRetenir={0}
            estCoche={(d) => d.qualif_rep}
            onClic={clic(basculerRep)}
            consigne={lectureSeule ? "En rouge : repêchés pour la finale · les autres = Bronze" : "Touchez les dossards repêchés pour la finale · les autres = Bronze"}
          />
        )}

        {onglet === "finale" && (
          <Passage
              parLigne={reglages.par_ligne}
            titre="Finale"
            danseurs={finale}
            aRetenir={0}
            estCoche={(d) => d.or_finale}
            onClic={clic(basculerOr)}
            consigne="Doré = médaille d’Or · Non sélectionnés = Argent"
            coulCoche="bg-or text-black"
            etiquette={(d) => (d.qualif_t1 ? "1T" : "R")}
          />
        )}
      </div>
    </main>
  );
}

function Passage({
  titre, danseurs, aRetenir, estCoche, onClic, consigne,
  coulCoche = "bg-mk-rouge text-white", etiquette, parLigne,
}: {
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

  // Lignes équilibrées : 21 danseurs avec 8 max par ligne → 3 lignes de 7 (et non 8 · 8 · 5)
  const nbLignes = Math.max(1, Math.ceil(danseurs.length / Math.max(1, parLigne)));
  const lignes = repartir(danseurs, nbLignes);
  const colonnes = Math.max(1, ...lignes.map((l) => l.length));

  return (
    <section className="mk-carte space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="mk-titre text-lg">{titre}</h2>
        <span className="text-xs font-semibold uppercase text-mk-gris">{danseurs.length} danseurs</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-mk-gris">{consigne}</p>
        <span
          className={`rounded-md px-3 py-1 text-sm font-bold ${
            depasse ? "bg-mk-rouge text-white" : complet ? "bg-ok text-white" : "bg-mk-carte2 text-white"
          }`}
        >
          {nb}{aRetenir > 0 && ` / ${aRetenir}`} sélectionné{nb > 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {danseurs.length > 0 && lignes.map((ligne, li) => (
          <div key={li} className="flex items-center gap-2">
            {nbLignes > 1 && (
              <span className="w-5 shrink-0 text-center text-[10px] font-bold uppercase text-mk-gris">L{li + 1}</span>
            )}
            <div
              className="grid flex-1 gap-1.5 sm:gap-2"
              style={{ gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))` }}
            >
              {ligne.map((d) => {
                const style = `rounded-md py-3 text-center text-base font-extrabold tabular-nums transition sm:text-xl ${
                  estCoche(d) ? coulCoche : "bg-mk-carte2 text-white"
                } ${onClic ? "active:scale-95" : ""}`;
                const contenu = (
                  <>
                    {fmt(d.dossard)}
                    {etiquette && <div className="text-[10px] font-semibold opacity-70">{etiquette(d)}</div>}
                  </>
                );
                return onClic ? (
                  <button key={d.id} onClick={() => onClic(d)} className={style}>{contenu}</button>
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