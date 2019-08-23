// ==UserScript==
// @name         Kittens Game - progress bars & pre-craft buttons
// @namespace    http://lyuhau.com/
// @version      1.0
// @description  try to take over the world! (with kittens)
// @author       Yuhau Lin
// @match        http://bloodrizer.ru/games/kittens/
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  const init = () => {
    if (!game.resPool) {
      setTimeout(init, 100);
      return;
    }

    const extendPrices = prices => prices.map(e => ({
        'name': e.name,
        'have': game.resPool.get(e.name).value,
        'need': e.val
      }));
    const craftUpTo = (name, count) => game.craft(name, Math.min(count, game.workshop.getCraftAllCount(name)));
    const preCraft = prices => {
      prices.forEach(e => {
        const delta = e.need - e.have;
        if (delta <= 0) {
          return;
        }
        const ingred = game.workshop.getCraft(e.name);
        if (!ingred) {
          return;
        }
        const ingredPrices = extendPrices(game.workshop.getCraftPrice(ingred));
        const craftRatio = 1 + game.getResCraftRatio(e.name);
        const craftCount = Math.ceil(delta / craftRatio);
        preCraft(ingredPrices.map(p => ({...p, 'need': p.need * craftCount})));
        craftUpTo(e.name, craftCount);
      });
    };

    setInterval(() => {
      $('.tabInner .btn.nosel:not(.disabled)').find('.progressBar, .precraftBtn').remove();

      const buttonsWithPrices = [game.tabs.find(t => t.tabId == game.ui.activeTabId)]
        .flatMap(t => [...new Set(Object.keys(t).filter(k => /button|panel|children/i.test(k)).flatMap(k => t[k]))]).filter(Boolean)
        .flatMap(x => x.model ? x : x.tradeBtn || x.children).filter(Boolean)
        .flatMap(x => x.model ? x : x.tradeBtn || x.children).filter(Boolean)
        .flatMap(x => x.model ? x : x.tradeBtn || x.children).filter(Boolean);

      buttonsWithPrices.forEach(b => {
        const $e = $(b.buttonContent.parentElement);

        const prices = extendPrices(b.model.prices);
        const percents = prices.map(e => e.have / e.need);
        const minPercent = Math.min(...percents);

        var progressBar = $e.find('.progressBar').first();
        var precraftBtn = $e.find('.precraftBtn').first();
        if (minPercent >= 1) {
          progressBar.remove();
          precraftBtn.remove();
          return;
        }

        if (!progressBar.length) {
          progressBar = $('<div class="progressBar"/>');
          progressBar.css({
            'display': 'inline-block',
            'position': 'absolute',
            'bottom': '0',
            'left': '0',
            'height': '3px',
            'background-color': '#F00',
            'border-radius': '0 0 0 2px'
          });
          $e.append(progressBar);
        }
        progressBar.css('width', `${minPercent * 100}%`);

        // only show the pre-craft button if at least some of the ingredients are craftable
        if (!precraftBtn.length && prices.some(e => game.workshop.getCraft(e.name))) {
          const a = $('<a href="#" style="display: block; float: right">pc</a>');
          precraftBtn = $('<div class="precraftBtn" style="float: right" />').append(a);
          $e.find('> .btnContent').append(precraftBtn);
        }
        precraftBtn.find('a').off('click').on('click', e => { e.stopPropagation(); e.preventDefault(); preCraft(prices); return false; });
      });
    }, 100);

  };

  $(document).ready(init);
})();
