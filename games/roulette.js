// SpinBet Casino · RouletteGame — loaded on demand by games/impl/index.js (index.html), after games/rltable.js.
// ---- games/impl/roulette.js ----
__mods['games/impl/roulette.js'] = (() => {
// La Roulette : roulette européenne classique sur la table en 3D commune (games/rltable.js, RlTableGame).
// Paiements classiques (plein 35 pour 1…) : retour 97,3 %.

const { RlTableGame } = __mods['games/impl/rltable.js'];
const { buildDefs } = __mods['core/roulette.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];

/* ===ENGINE */
const L = buildDefs(35); // plein 35, cheval 17, transversale 11, carré 8, sixain 5, douzaines / colonnes 2, chances 1
/* ===END ENGINE */

class RouletteGame extends RlTableGame {
  constructor(root, game) {
    super(root, game, { music: EXTRA_THEMES.roulette || EXTRA_THEMES.doublespin }, { L });
  }
  info() {
    return this.rules(`<h4>Roulette européenne</h4><p>Un seul zéro, 37 numéros. Les cases du bas pour les douzaines et les chances simples, « 2 pour 1 » pour une colonne.</p>
      <ul class="rules"><li>Plein : 35 pour 1 · Cheval : 17 · Transversale : 11 · Carré et 0-1-2-3 : 8 · Sixain : 5</li><li>Douzaines et colonnes : 2 pour 1 · Rouge/Noir, Pair/Impair, 1-18/19-36 : 1 pour 1</li><li><b>Lancer</b> sans jeton sur la table rejoue les mises du tour d’avant.</li></ul>${this.tableRules()}`);
  }
}

return { RouletteGame };
})();
