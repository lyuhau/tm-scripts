// ==UserScript==
// @name         Kittens Game - progress bars & pre-craft buttons
// @namespace    http://lyuhau.com/
// @version      0.6
// @description  try to take over the world! (with kittens)
// @author       Yuhau Lin
// @match        http://bloodrizer.ru/games/kittens/
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  const $ = jQuery;

  $.fn.x = function(xpath) {
    const result = [];
    this.each((i, e) => {
      const xpathResult = document.evaluate(xpath, e, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);

      var elem;
      while (elem = xpathResult.iterateNext()) {
        result.push(elem);
      }
    });
    return $(result);
  };

  $(document).ready(() => setTimeout(() => {

    const mergeObjectList = list => list.reduce((acc, obj) => ({...acc, ...obj}), {});
    const mergeEntryList = list => list.reduce((acc, entry) => ({...acc, [entry[0]]: entry[1]}), {});

    const infoLists = {
      'resource': game.resPool.resources,
      'building': game.bld.buildingsData,
      'science':  Object.values(game.science.metaCache),
      'upgrade':  game.workshop.upgrades,
      'craft':    game.workshop.crafts,
      'trade':    game.diplomacy.races,
      'unicorn':  game.religion.meta[0].meta,
      'solar':    game.religion.meta[1].meta,
      'black':    game.religion.meta[2].meta,
    };
    const infoMaps = mergeEntryList(Object.entries(infoLists).map(entry => [entry[0], mergeEntryList(entry[1].map(e => [e.name, e]))]));
    // non-resource only
    const typeLookup = mergeEntryList(Object.entries(infoLists).filter(entry => entry[0] != 'resource').flatMap(entry => entry[1].map(info => [info.name, entry[0]])));
    const priceFunctionsMap = {
      'building': x => game.bld.getPrices(x),
      'science':  x => game.science.getPrices(game.science.get(x)),
      'upgrade':  x => game.workshop.get(x).prices,
      'craft':    x => game.workshop.getCraftPrice(game.workshop.getCraft(x)),
      'trade':    x => [{ 'name': 'manpower', 'val': 50 }, { 'name': 'gold', 'val': 15 }].concat(game.diplomacy.get(x).buys),
      'unicorn':  x => [game.religion.getZU(x)].flatMap(info => info.prices.map(p => ({...p, 'val': p.val * info.priceRatio ** info.val}))),
      'solar':    x => [game.religion.getRU(x)].flatMap(info => info.prices.map(p => ({...p, 'val': p.val * info.priceRatio ** info.val}))),
      'black':    x => [game.religion.getTU(x)].flatMap(info => info.prices.map(p => ({...p, 'val': p.val * info.priceRatio ** info.val}))),
    };

    // arbitrary info lookup (by name, title, or label)
    const getInfo = (...args) => {
      const vlen = args.length;
      var infos = Array.isArray(args[0]) ? args[0] : infoLists[args[0]],
        by = ['name', 'title', 'label'],
        value = args[(-1 % vlen + vlen) % vlen];
      switch (vlen) {
        case 1: infos = [].concat(Object.values(infoLists)); break;
        case 2: break;
        case 3: by = args[1]; break;
      }
      const valueRegexp = new RegExp(`^${value}$`, 'i');
      return infos.find(e => [e, ...(e.stages || [])].find(e => by.some(b => valueRegexp.test(e[b]))));
    };
    const getNonResourceInfo = (() => {
      const getNonResourceInfos = [].concat.apply([], Object.keys(infoLists)
        .filter(k => k != 'resource')
        .map(k => infoLists[k]));
      return value => getInfo(getNonResourceInfos, value);
    })();

    // crafting prices, percentages
    const getPrices = name => {
      const priceGetter = priceFunctionsMap[typeLookup[name]];
      if (!priceGetter) {
        return undefined;
      }
      const prices = priceGetter(name);

      return prices.map(e => ({
        'name': e.name,
        'have': game.resPool.get(e.name).value,
        'need': e.val
      }));
    };
    const craftUpTo = (name, count) => game.craft(name, Math.min(count, game.workshop.getCraftAllCount(name)));
    const preCraft = prices => {
      prices.forEach(e => {
        const delta = e.need - e.have;
        const craftRatio = 1 + game.getResCraftRatio(e.name);
        const craftCount = Math.ceil(delta / craftRatio);
        const ingredPrices = getPrices(e.name);
        if (craftCount > 0 && ingredPrices) {
          preCraft(ingredPrices);
          craftUpTo(e.name, craftCount);
        }
      });
    };

    setInterval(() => {
      const activeTab = $('#gameContainerId > .tabsContainer .activeTab').text();

      $('.tabInner .btn.nosel:not(.disabled)').find('.progressBar, .precraftBtn').remove();

      $('.tabInner .disabled[style*="display: block"]').each((i, e) => {
        const $e = $(e);
        const label = activeTab != 'Trade'
          ? $e.find('span').text().replace(/ \(.*$/, '')
          : $e.x('ancestor::*[@class="panelContainer"]/div[@class="title"]/text()').text().trim();
        const info = getNonResourceInfo(label);
        if (!info) {
          return;
        }

        const prices = getPrices(info.name);
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
        // only show the pre-craft button if at least some of the ingredients are craftable
        if (!precraftBtn.length && prices.some(e => game.workshop.getCraft(e.name))) {
          const a = $('<a href="#" style="display: block; float: right">pc</a>');
          precraftBtn = $('<div class="precraftBtn" style="float: right" />').append(a);
          $e.find('> .btnContent').append(precraftBtn);
        }
        precraftBtn.find('a').off('click').on('click', e => { e.stopPropagation(); e.preventDefault(); preCraft(prices); return false; });
        progressBar.css('width', `${minPercent * 100}%`);
      });
    }, 100);

  }, 1500));
})();
