// ==UserScript==
// @name         Kittens Game - progress bars & pre-craft buttons
// @namespace    http://lyuhau.com/
// @version      1.3
// @description  try to take over the world! (with kittens)
// @author       Yuhau Lin
// @match        http://kittensgame.com/web/
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  const init = () => {
    // poll every .1 seconds for the game to be initialized
    if (!game.resPool) {
      setTimeout(init, 100);
      return;
    }

    // searches game.tabs recursively to find anything with a .model
    var getButtons = () => {
      var buttons = [game.tabs.find(t => t.tabId == game.ui.activeTabId)]
        .flatMap(t => [...new Set(Object.keys(t).filter(k => /btn|button|panel|children/i.test(k)).flatMap(k => t[k]))]).filter(Boolean);
      while (buttons.some(x => !x.model)) {
        buttons = buttons.flatMap(x => x.model ? x : x.tradeBtn || x.race || x.children).filter(Boolean);
      }
      return buttons;
    }

    // convenience function for calculating state of resources needed
    const extendPrices = prices => prices.map(p => ({
      'name': p.name,
      'have': game.resPool.get(p.name).value,
      'need': p.val
    })).map(p => ({
      ...p,
      'delta': p.need - p.have,
      'percent': p.have / p.need
    }));

    // used for the pre-craft bar
    // recursively flattens the price model to find out the total amount of raw resources needed
    const getRawResPrices = priceModels => {
      var rawResPrices = dojo.clone(priceModels);
      while (rawResPrices.some(pm => pm.children)) {
        rawResPrices = rawResPrices.flatMap(pm => pm.children ? pm.children : pm);
      }
      rawResPrices = Object.entries(rawResPrices.reduce((acc, pm) => ({...acc, [pm.name]: (acc[pm.name] || 0) + pm.val}), {}))
        .map(e => ({'name': [e[0]], 'val': e[1]}));
      return rawResPrices;
    };

    const craftUpTo = (name, count) => game.craft(name, Math.min(count, game.workshop.getCraftAllCount(name)));

    // recursively call pre-craft on craft ingredients
    const preCraft = prices => {
      prices.forEach(e => {
        const delta = e.need - e.have;
        if (delta <= 0) {
          return;
        }
        const ingred = game.workshop.getCraft(e.name);
        if (e.name == 'wood' || !ingred) {
          return;
        }
        const ingredPrices = extendPrices(game.workshop.getCraftPrice(ingred));
        const craftRatio = 1 + game.getResCraftRatio(e.name);
        const craftCount = Math.ceil(delta / craftRatio);
        preCraft(ingredPrices.map(p => ({...p, 'need': p.need * craftCount})));
        craftUpTo(e.name, craftCount);
      });
    };

    // function for initializing the status bars and pre-craft buttons (initially with display: none)
    const initButtonExtension = button => {
      const $button = $(button.buttonContent);
      const statusBar = button.statusBar = $('<div class="statusBar"/>')
      .css({
        'display': 'none',
        'position': 'absolute',
        'bottom': '0',
        'left': '0',
        'height': '2px',
        'width': '100%',
        'border-top': '1px solid #0004',
        'border-radius': '0 0 2px 2px',
        'pointer-events': 'none',
      });
      $button.append(statusBar);

      const progressBar = statusBar.progressBar = $('<div class="progressBar"/>')
      .css({
        'display': 'inline-block',
        'float': 'left',
        'height': '100%',
        'background-color': '#FF0000AA',
      });
      statusBar.append(progressBar);

      const precraftButton = button.precraftButton = $('<div class="precraftBtn" style="display: none; float: right" />');
      const precraftA = precraftButton.precraftA = $('<a href="#" style="display: block; float: right">pc</a>');
      $button.append(precraftButton.append(precraftA));

      const precraftBar = statusBar.precraftBar = $('<div class="precraftBar"/>')
      .css({
        'display': 'inline-block',
        'float': 'left',
        'height': '100%',
      });
      statusBar.append(precraftBar);
    };

    // every .1 seconds, update the buttons
    setInterval(() => {

      // this is supposed to fix the rounded corners, but it also messes up the drop-down menus (the ones for +5, +25, +all, etc.)
//      $('.btn.nosel').css('overflow', 'hidden');

      // set all buttons to hidden
      $('.tabInner .btn.nosel').find('.statusBar:visible, .precraftBtn:visible').css('display', 'none');

      getButtons()
        .filter(b => b.model.visible && !b.model.enabled && b.buttonContent.offsetParent)
        .filter(b => !/\((?:complete|in progress)\)/i.test(b.model.name))
        .forEach(button => {
        const $button = $(button.buttonContent);

        if (!$button.find('.statusBar').length) {
          initButtonExtension(button);
        }

        // don't show the progress/precraft stuff if it's already 100%
        const prices = extendPrices(button.model.prices);
        const minPercent = Math.max(Math.min(1, ...prices.map(p => p.percent)), .01); // the 1% minimum is there so you can tell there is a progress bar
        if (minPercent >= 1) {
          return;
        }

        button.statusBar.css({'display': 'inline-block'});

        // progress bar
        button.statusBar.progressBar.css({'width': minPercent * 100 + '%'});

        // pre-craft button
        // only show if at least some of the ingredients are craftable
        if (prices.some(e => e.name != 'wood' && game.workshop.getCraft(e.name))) {
          button.precraftButton.css('display', '');
          button.precraftButton.precraftA.off('click').on('click', e => { e.stopPropagation(); e.preventDefault(); preCraft(prices); return false; });

          // pre-craft bar
          button.controller.fetchExtendedModel(button.model);
          const rawResPrices = getRawResPrices(button.model.priceModels);
          const rawResMinPercent = Math.min(1, ...extendPrices(rawResPrices).map(p => p.percent));
          button.statusBar.precraftBar.css({
            'display': 'inline-block',
            'width': (rawResMinPercent - minPercent) * 100 + '%',
            // yellow if not 100% pre-craft resources ready, green if it is
            'background-color': rawResMinPercent == 1 ? '#00FF00AA' : '#FFA500AA',
          })
        }

      });
    }, 100);

  };
  setTimeout(function () {
      console.log('Setting timer to load plugin');
      init();
  }, 20000);
})();
