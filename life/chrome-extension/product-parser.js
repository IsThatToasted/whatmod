(() => {
  const HOST = location.hostname.toLowerCase().replace(/^www\./, '');

  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const first = (...values) => values.map(clean).find(Boolean) || '';
  const text = selector => clean(document.querySelector(selector)?.textContent);
  const attr = (selector, name = 'content') => clean(document.querySelector(selector)?.getAttribute(name));
  const absolute = value => {
    if (!value) return '';
    try { return new URL(value, location.href).href; } catch { return clean(value); }
  };
  const uniq = values => [...new Set(values.map(clean).filter(Boolean))];
  const texts = selector => uniq([...document.querySelectorAll(selector)].map(node => node.textContent));
  const attrs = (selector, name) => uniq([...document.querySelectorAll(selector)].map(node => node.getAttribute(name)));

  function numberPrice(raw) {
    if (raw == null || raw === '') return null;
    let value = clean(raw).replace(/\u00a0/g, ' ');
    // Keep the first plausible monetary value and ignore percentages / strike-through prose.
    const match = value.match(/(?:US\$|CA\$|AU\$|£|€|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2})?)/);
    if (!match) return null;
    const n = Number(match[1].replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function currencyFrom(raw, fallback = 'USD') {
    const value = clean(raw).toUpperCase();
    if (/\bUSD\b|US\$|\$/.test(value)) return 'USD';
    if (/\bCAD\b|CA\$/.test(value)) return 'CAD';
    if (/\bAUD\b|AU\$/.test(value)) return 'AUD';
    if (/\bGBP\b|£/.test(value)) return 'GBP';
    if (/\bEUR\b|€/.test(value)) return 'EUR';
    return clean(fallback || 'USD').toUpperCase();
  }

  function firstString(value) {
    if (typeof value === 'string' || typeof value === 'number') return clean(value);
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = firstString(item);
        if (found) return found;
      }
      return '';
    }
    if (value && typeof value === 'object') {
      return firstString(value.url) || firstString(value.contentUrl) || firstString(value.name) || firstString(value.value);
    }
    return '';
  }

  function collectProducts(node, output = []) {
    if (!node) return output;
    if (Array.isArray(node)) {
      for (const item of node) collectProducts(item, output);
      return output;
    }
    if (typeof node !== 'object') return output;
    const type = node['@type'];
    if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) output.push(node);
    for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
      if (node[key]) collectProducts(node[key], output);
    }
    return output;
  }

  function jsonLdProduct() {
    const products = [];
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      const source = script.textContent || '';
      if (!source.trim()) continue;
      try {
        collectProducts(JSON.parse(source), products);
      } catch {
        // Some stores emit multiple JSON objects or invalid trailing characters. Do not let that
        // prevent the site-specific DOM adapter from working.
      }
    }
    if (!products.length) return null;
    return products.sort((a, b) => {
      const score = p => Number(Boolean(firstString(p?.name))) + Number(Boolean(p?.offers)) + Number(Boolean(firstString(p?.image)));
      return score(b) - score(a);
    })[0];
  }

  function imageFromDynamicAmazon(node) {
    const raw = node?.getAttribute?.('data-a-dynamic-image');
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      const choices = Object.entries(parsed).map(([url, dims]) => ({ url, area: Array.isArray(dims) ? Number(dims[0] || 0) * Number(dims[1] || 0) : 0 }));
      choices.sort((a, b) => b.area - a.area);
      return choices[0]?.url || '';
    } catch { return ''; }
  }

  function splitPrice(container) {
    if (!container) return '';
    const whole = clean(container.querySelector('.a-price-whole')?.textContent).replace(/[^0-9,]/g, '');
    const fraction = clean(container.querySelector('.a-price-fraction')?.textContent).replace(/[^0-9]/g, '');
    const symbol = clean(container.querySelector('.a-price-symbol')?.textContent) || '$';
    if (!whole) return '';
    return `${symbol}${whole}${fraction ? `.${fraction.slice(0, 2)}` : ''}`;
  }

  function firstVisiblePrice(selectors) {
    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        const offscreen = clean(node.querySelector?.('.a-offscreen')?.textContent);
        const split = splitPrice(node);
        const direct = clean(node.textContent);
        for (const candidate of [offscreen, split, direct]) {
          const n = numberPrice(candidate);
          if (n != null && n > 0) return { price: n, raw: candidate };
        }
      }
    }
    return { price: null, raw: '' };
  }

  function genericBreadcrumb() {
    const candidates = [
      'nav[aria-label*="breadcrumb" i] a',
      '[aria-label*="breadcrumb" i] a',
      '.breadcrumb a',
      '.breadcrumbs a',
      '[data-testid*="breadcrumb" i] a',
      '[data-automation-id*="breadcrumb" i] a'
    ];
    for (const selector of candidates) {
      const values = texts(selector).filter(value => !/^home$/i.test(value));
      if (values.length) return values.slice(-4).join(' > ');
    }
    return '';
  }

  function genericProduct() {
    const product = jsonLdProduct();
    const offers = Array.isArray(product?.offers) ? product.offers.find(Boolean) : product?.offers;
    const canonical = attr('link[rel="canonical"]', 'href') || location.href;
    const rawPrice = firstString(offers?.price) || firstString(offers?.lowPrice) || attr('meta[property="product:price:amount"]') || attr('meta[itemprop="price"]') || attr('[itemprop="price"]', 'content') || text('[itemprop="price"]');
    const image = firstString(product?.image) || attr('meta[property="og:image"]') || attr('meta[name="twitter:image"]') || attr('meta[itemprop="image"]');
    return {
      title: firstString(product?.name) || attr('meta[property="og:title"]') || attr('meta[name="twitter:title"]') || text('h1') || clean(document.title),
      url: absolute(canonical),
      imageUrl: absolute(image),
      price: numberPrice(rawPrice),
      currency: currencyFrom(firstString(offers?.priceCurrency) || attr('meta[property="product:price:currency"]') || attr('meta[itemprop="priceCurrency"]') || rawPrice),
      store: HOST,
      category: firstString(product?.category) || attr('meta[property="product:category"]') || attr('meta[name="category"]') || genericBreadcrumb(),
      brand: firstString(product?.brand) || attr('meta[name="brand"]'),
      productId: firstString(product?.sku) || firstString(product?.productID) || firstString(product?.mpn) || attr('meta[property="product:retailer_item_id"]'),
      description: firstString(product?.description) || attr('meta[property="og:description"]') || attr('meta[name="description"]'),
      parser: product ? 'structured-data' : 'generic-meta'
    };
  }

  function amazonProduct() {
    const hero = document.querySelector('#landingImage, img[data-a-image-name="landingImage"], #imgTagWrapperId img');
    const priceResult = firstVisiblePrice([
      '.priceToPay.a-price',
      '.priceToPay',
      '#corePrice_feature_div .a-price',
      '#corePriceDisplay_desktop_feature_div .a-price',
      '#apex_desktop .a-price',
      '#price_inside_buybox',
      '#newBuyBoxPrice'
    ]);
    const breadcrumbs = uniq([
      ...texts('#wayfinding-breadcrumbs_feature_div a.a-link-normal.a-color-tertiary'),
      ...texts('#wayfinding-breadcrumbs_container a.a-link-normal'),
      ...texts('a.a-link-normal.a-color-tertiary')
    ]).filter(value => !/^back to/i.test(value));
    const byline = first(text('#bylineInfo'), text('#brand'));
    const brand = byline
      .replace(/^visit the\s+/i, '')
      .replace(/\s+store$/i, '')
      .replace(/^brand:\s*/i, '')
      .trim();
    const asin = first(
      attr('#ASIN', 'value'),
      location.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1] || '',
      attr('[data-csa-c-item-id]', 'data-csa-c-item-id')
    );
    const image = first(
      hero?.getAttribute?.('data-old-hires'),
      imageFromDynamicAmazon(hero),
      hero?.currentSrc,
      hero?.getAttribute?.('src'),
      attr('meta[property="og:image"]')
    );
    const description = first(
      text('#productDescription'),
      text('#feature-bullets'),
      attr('meta[name="description"]')
    );
    return {
      title: first(text('#productTitle'), text('#title'), attr('meta[property="og:title"]')),
      url: absolute(attr('link[rel="canonical"]', 'href') || location.href),
      imageUrl: absolute(image),
      price: priceResult.price,
      currency: currencyFrom(priceResult.raw, 'USD'),
      store: 'Amazon',
      category: breadcrumbs.slice(-4).join(' > '),
      brand,
      productId: asin,
      description,
      parser: 'amazon-dom'
    };
  }

  function walmartProduct() {
    const rawPrice = first(
      attr('meta[itemprop="price"]'),
      attr('[itemprop="price"]', 'content'),
      text('[data-automation-id="product-price"]'),
      text('[itemprop="price"]')
    );
    const imageNode = document.querySelector('img[data-testid="hero-image"], [data-testid="hero-image"] img, [data-automation-id="product-image"] img, img[fetchpriority="high"]');
    const productId = first(
      attr('[data-item-id]', 'data-item-id'),
      location.pathname.match(/\/ip\/(?:[^/]+\/)?([0-9]{5,})(?:[/?]|$)/i)?.[1] || ''
    );
    return {
      title: first(text('[data-automation-id="product-title"]'), text('h1[itemprop="name"]'), text('h1')),
      url: absolute(attr('link[rel="canonical"]', 'href') || location.href),
      imageUrl: absolute(first(imageNode?.currentSrc, imageNode?.getAttribute?.('src'), attr('meta[property="og:image"]'))),
      price: numberPrice(rawPrice),
      currency: currencyFrom(rawPrice, 'USD'),
      store: 'Walmart',
      category: first(genericBreadcrumb(), attr('meta[property="product:category"]')),
      brand: first(attr('[itemprop="brand"]', 'content'), text('[itemprop="brand"]')),
      productId,
      description: first(attr('meta[property="og:description"]'), attr('meta[name="description"]')),
      parser: 'walmart-dom'
    };
  }

  function targetProduct() {
    const priceRaw = first(text('[data-test="product-price"]'), text('[data-test="current-price"]'), attr('meta[property="product:price:amount"]'));
    const imageNode = document.querySelector('[data-test="hero-image"] img, img[data-test="product-image"], picture img[fetchpriority="high"]');
    return {
      title: first(text('[data-test="product-title"]'), text('h1')),
      url: absolute(attr('link[rel="canonical"]', 'href') || location.href),
      imageUrl: absolute(first(imageNode?.currentSrc, imageNode?.getAttribute?.('src'), attr('meta[property="og:image"]'))),
      price: numberPrice(priceRaw),
      currency: currencyFrom(priceRaw, 'USD'),
      store: 'Target',
      category: genericBreadcrumb(),
      brand: first(text('[data-test="product-brand"]'), attr('meta[name="brand"]')),
      productId: location.pathname.match(/\/A-(\d+)/i)?.[1] || '',
      description: first(attr('meta[property="og:description"]'), attr('meta[name="description"]')),
      parser: 'target-dom'
    };
  }

  function etsyProduct() {
    const priceRaw = first(text('[data-buy-box-region="price"]'), text('p[data-buy-box-region="price"]'), attr('meta[property="product:price:amount"]'));
    const imageNode = document.querySelector('[data-carousel-first-image] img, img[data-src-zoom-image], .listing-page-image-carousel img');
    return {
      title: first(text('h1[data-buy-box-listing-title]'), text('h1')),
      url: absolute(attr('link[rel="canonical"]', 'href') || location.href),
      imageUrl: absolute(first(imageNode?.getAttribute?.('data-src-zoom-image'), imageNode?.currentSrc, imageNode?.getAttribute?.('src'), attr('meta[property="og:image"]'))),
      price: numberPrice(priceRaw),
      currency: currencyFrom(priceRaw, attr('meta[property="product:price:currency"]') || 'USD'),
      store: 'Etsy',
      category: genericBreadcrumb(),
      brand: first(text('[data-shop-name]'), attr('meta[name="author"]')),
      productId: location.pathname.match(/\/listing\/(\d+)/i)?.[1] || '',
      description: first(attr('meta[property="og:description"]'), attr('meta[name="description"]')),
      parser: 'etsy-dom'
    };
  }

  function bestBuyProduct() {
    const priceRaw = first(text('.priceView-customer-price span[aria-hidden="true"]'), text('.priceView-layout-large .priceView-customer-price'), attr('meta[property="product:price:amount"]'));
    const imageNode = document.querySelector('img.primary-image, .primary-image img, .shop-media-gallery img');
    return {
      title: first(text('.sku-title h1'), text('h1')),
      url: absolute(attr('link[rel="canonical"]', 'href') || location.href),
      imageUrl: absolute(first(imageNode?.currentSrc, imageNode?.getAttribute?.('src'), attr('meta[property="og:image"]'))),
      price: numberPrice(priceRaw),
      currency: currencyFrom(priceRaw, 'USD'),
      store: 'Best Buy',
      category: genericBreadcrumb(),
      brand: first(text('.shop-product-title .brand'), attr('meta[name="brand"]')),
      productId: first(text('.sku.product-data-value'), location.pathname.match(/\.p\?skuId=(\d+)/i)?.[1] || ''),
      description: first(attr('meta[property="og:description"]'), attr('meta[name="description"]')),
      parser: 'bestbuy-dom'
    };
  }

  function merge(primary, fallback) {
    const merged = { ...fallback };
    for (const [key, value] of Object.entries(primary || {})) {
      if (value !== '' && value != null) merged[key] = value;
    }
    return merged;
  }

  function adapter() {
    if (/(^|\.)amazon\.(com|ca|co\.uk|com\.au|de|fr|it|es|co\.jp)$/.test(HOST)) return amazonProduct;
    if (/(^|\.)walmart\.com$/.test(HOST)) return walmartProduct;
    if (/(^|\.)target\.com$/.test(HOST)) return targetProduct;
    if (/(^|\.)etsy\.com$/.test(HOST)) return etsyProduct;
    if (/(^|\.)bestbuy\.com$/.test(HOST)) return bestBuyProduct;
    return null;
  }

  function storeName(host) {
    const known = {
      'amazon.com': 'Amazon', 'walmart.com': 'Walmart', 'target.com': 'Target', 'etsy.com': 'Etsy', 'bestbuy.com': 'Best Buy'
    };
    return known[host] || host.replace(/\.[a-z]{2,}$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function scrape() {
    const generic = genericProduct();
    const specific = adapter()?.() || {};
    const result = merge(specific, generic);
    result.store = first(specific.store, result.store && storeName(HOST), storeName(HOST));
    result.url = absolute(first(result.url, location.href));
    result.imageUrl = absolute(result.imageUrl);
    result.currency = clean(result.currency || 'USD').toUpperCase();
    result.title = clean(result.title || document.title || HOST);
    result.category = clean(result.category);
    result.brand = clean(result.brand);
    result.productId = clean(result.productId);
    result.description = clean(result.description);
    result.parser = first(specific.parser, generic.parser, 'generic');
    result.detected = {
      title: Boolean(result.title),
      image: Boolean(result.imageUrl),
      price: result.price != null,
      category: Boolean(result.category),
      brand: Boolean(result.brand),
      productId: Boolean(result.productId)
    };
    result.confidence = Object.values(result.detected).filter(Boolean).length / Object.keys(result.detected).length;
    return result;
  }

  globalThis.JustGlanceProductParser = { scrape, numberPrice, currencyFrom };
})();
