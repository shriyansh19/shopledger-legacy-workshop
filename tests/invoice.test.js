const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// In-memory fixtures only; these tests never import or touch data/db.json.
function item(overrides) {
  return Object.assign({ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }, overrides);
}

test('invoice totals and GST breakdown match the order billed to the customer', function () {
  const items = [item({ price: 1000 })];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const figures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total, gstPercent: figures.rows[0].gstPercent, lineTax: figures.rows[0].lineTax },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total, gstPercent: billed.lines[0].gstPercent, lineTax: billed.lines[0].tax }
  );
  assert.equal(figures.total, 945);
});

test('invoice uses the HSN slab that determines the billed tax rate', function () {
  const items = [item()];
  const billed = pricing.computeTotals(items, '');
  const figures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.tax, 5);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.total, billed.total);
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice interprets decimal gstRate the same way as order pricing', function () {
  const items = [item({ gstRate: 0.05 })];
  const billed = pricing.computeTotals(items, '');
  const figures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.total, billed.total);
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice applies the same coupon cap and discount calculation as order pricing', function () {
  const items = [item({ price: 1000 })];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const figures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(
    { discount: figures.discount, tax: figures.tax, total: figures.total },
    { discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('invoice renders matching CGST and SGST amounts without a ledger mismatch notice', function () {
  const items = [item()];
  const billed = pricing.computeTotals(items, '');
  const order = { id: 42, items: items, coupon: '', total: billed.total };
  const figures = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.equal(figures.cgst + figures.sgst, billed.tax);
  assert.match(html, /<td>CGST<\/td><td class="r">₹2\.50<\/td>/);
  assert.match(html, /<td>SGST<\/td><td class="r">₹2\.50<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
