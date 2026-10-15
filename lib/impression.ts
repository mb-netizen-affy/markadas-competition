import type { Categorie, Danseur } from "./supabase";
import { actifs, fmt, lettre } from "./competition";

// Feuilles de résultats à imprimer (et afficher) pendant la compétition.
// L'Or et l'Argent sont annoncés sur la piste : ils ne sont pas imprimés.
export type TypeImpression = "premier-tour" | "demi-finale";

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function bloc(titre: string, sousTitre: string, liste: Danseur[], accent: boolean) {
  const cartes = liste
    .map(
      (d) => `
      <div class="carte">
        <div class="dossard">${fmt(d.dossard)}</div>
        <div class="nom">${echapper(d.nom)}</div>
        <div class="prenom">${echapper(d.prenom)}</div>
      </div>`
    )
    .join("");
  return `
    <section>
      <h2 class="${accent ? "accent" : ""}">${titre}</h2>
      <p class="sous">${sousTitre}</p>
      <div class="grille">${cartes || '<p class="vide">Aucun danseur</p>'}</div>
    </section>`;
}

export function imprimerResultats(type: TypeImpression, categorie: Categorie, danseurs: Danseur[]) {
  const presents = actifs(danseurs); // déjà triés par dossard
  let titre: string;
  let contenu: string;

  if (type === "premier-tour") {
    const finale = presents.filter((d) => d.qualif_t1);
    const demi = presents.filter((d) => !d.qualif_t1);
    titre = "Résultats du 1er tour";
    contenu =
      bloc("Qualifiés pour la finale", "Directement qualifiés à l'issue du 1er tour", finale, true) +
      bloc("Demi-finale", "Ces danseurs passent en demi-finale", demi, false);
  } else {
    const demi = presents.filter((d) => !d.qualif_t1);
    const finale = demi.filter((d) => d.qualif_rep);
    const bronze = demi.filter((d) => !d.qualif_rep);
    titre = "Résultats de la demi-finale";
    contenu =
      bloc("Qualifiés pour la finale", "Qualifiés à l'issue de la demi-finale", finale, true) +
      bloc("Médaille de bronze", "Félicitations à tous ces danseurs !", bronze, false);
  }

  const jury = lettre(categorie.jury);
  const heure = new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${echapper(categorie.nom)} – ${titre}</title>
<style>
  @page { size: A3 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Open Sans", Arial, sans-serif; color: #111; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end;
           border-bottom: 4px solid #e53935; padding-bottom: 10px; margin-bottom: 18px; }
  .marque { color: #e53935; font-weight: 800; letter-spacing: .08em; font-size: 18px; }
  h1 { margin: 2px 0 0; font-size: 40px; text-transform: uppercase; }
  .titre { font-size: 26px; font-weight: 700; }
  .infos { text-align: right; font-size: 14px; color: #555; }
  section { margin-bottom: 24px; break-inside: auto; }
  h2 { font-size: 26px; text-transform: uppercase; margin: 0; padding: 8px 14px;
       background: #222; color: #fff; }
  h2.accent { background: #e53935; }
  .sous { margin: 6px 0 10px; font-size: 14px; color: #555; }
  .grille { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
  .carte { border: 2px solid #222; border-radius: 8px; padding: 8px 10px; break-inside: avoid; }
  .dossard { font-size: 40px; font-weight: 800; line-height: 1; }
  .nom { font-size: 15px; font-weight: 700; text-transform: uppercase; margin-top: 3px;
         white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prenom { font-size: 14px; color: #444; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vide { color: #777; font-style: italic; grid-column: 1 / -1; }
  .action { position: fixed; top: 10px; right: 10px; }
  .action button { font-size: 14px; padding: 8px 14px; background: #e53935; color: #fff;
                   border: 0; border-radius: 6px; cursor: pointer; }
  @media print { .action { display: none; } }
</style>
</head>
<body>
  <div class="action"><button onclick="window.print()">🖨 Imprimer</button></div>
  <header>
    <div>
      <div class="marque">MARKADAS · COMPÉTITION</div>
      <h1>${echapper(categorie.nom)}</h1>
      <div class="titre">${titre}</div>
    </div>
    <div class="infos">Jury ${jury} · Piste ${jury}<br>Édité le ${heure}</div>
  </header>
  ${contenu}
  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body>
</html>`;

  const fenetre = window.open("", "_blank");
  if (!fenetre) {
    alert("Le navigateur a bloqué la fenêtre d'impression. Autorise les fenêtres pop-up pour ce site, puis réessaie.");
    return;
  }
  fenetre.document.open();
  fenetre.document.write(html);
  fenetre.document.close();
}