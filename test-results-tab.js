// End-to-end test for openResultsTab: extract the function from the real file,
// call it with 70 sample Diwali items, capture the generated results-tab HTML,
// then run its inline <script> in a fake DOM and check the grid renders cards.
const fs = require('fs');
const src = fs.readFileSync(process.env.HOME + '/workspace/amazon-now-deals-v2/amazon-now-deals.js', 'utf8');

// esc() as defined in the file
function esc(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Extract openResultsTab source: from 'function openResultsTab' to the line before '// Create UI Root Container'
const start = src.indexOf('function openResultsTab');
const end = src.indexOf('// Create UI Root Container');
if (start < 0 || end < 0) throw new Error('could not find openResultsTab');
const fnSrc = src.slice(start, end);
// Evaluate it in this scope (it references esc from outer scope)
eval(fnSrc);

// Fake tab that captures document.write
let capturedHtml = '';
const fakeTab = {
  closed: false,
  document: {
    open() {},
    write(h) { capturedHtml = h; },
    close() {}
  }
};

// 70 sample items like a real "diwali" 70%+ search would return
const items = [];
for (let i = 0; i < 70; i++) {
  items.push({
    t: 'Diwali Diya Set ' + (i + 1) + ' "Festive" Decorative Lights',
    a: 'B0TEST' + String(i).padStart(4, '0'),
    bp: 99 + i,
    lp: 329 + i,
    d: 70,
    img: 'https://example.com/img' + i + '.jpg',
    pz: 'Pack of 10',
    b: 'TestBrand',
    c: ['Snacks, Sweets & Treats']
  });
}

openResultsTab('Search: "diwali" (70%+ Off)', items, fakeTab, '');

console.log('Captured HTML length:', capturedHtml.length);
console.log('Header shows 70 items?', capturedHtml.includes('70 items'));
console.log('Header title?', capturedHtml.includes('Search: &quot;diwali&quot;') || capturedHtml.includes('diwali'));

// Extract inner <script> ... </script> (the last script block)
const m = capturedHtml.match(/<script>([\s\S]*?)<\/script>/);
if (!m) throw new Error('no inner script found in generated HTML');
const innerScript = m[1];
console.log('Inner script length:', innerScript.length);

// Fake DOM for the inner script
function makeEl(id) {
  return {
    id,
    value: '',
    style: { display: '' },
    textContent: '',
    innerHTML: '',
    appendChild() {},
    addEventListener() {}
  };
}
const els = {};
['searchInput', 'sortSelect', 'priceSelect', 'brandSelect', 'brandSelectWrap', 'grid', 'noResults', 'countBadge'].forEach(id => { els[id] = makeEl(id); });
els.sortSelect.value = 'discount-desc';
els.priceSelect.value = '';
els.brandSelect.value = '';
const fakeDocument = {
  getElementById(id) { return els[id] || makeEl(id); },
  createElement(tag) {
    return { tag, value: '', textContent: '', style: {}, appendChild() {} };
  }
};

// Run the inner script with `document` faked. It calls update() at the end, which renders the grid.
try {
  const run = new Function('document', innerScript);
  run(fakeDocument);
  console.log('INNER SCRIPT PARSE + RUN: OK (no SyntaxError)');
} catch (err) {
  console.log('INNER SCRIPT FAILED:', err.message);
  process.exit(1);
}

const gridHtml = els.grid.innerHTML || '';
console.log('Grid HTML length:', gridHtml.length);
console.log('Cards rendered:', (gridHtml.match(/<a class=card/g) || []).length);
console.log('Contains first ASIN?', gridHtml.includes('B0TEST0000'));
console.log('Contains 70% badge?', gridHtml.includes('70%'));
console.log('Contains price?', gridHtml.includes('₹99'));
console.log('noResults visible?', els.noResults.style.display);
console.log('countBadge:', els.countBadge.textContent);
if ((gridHtml.match(/<a class=card/g) || []).length === 70) {
  console.log('PASS: all 70 cards render');
} else {
  console.log('FAIL: expected 70 cards');
  process.exit(1);
}
