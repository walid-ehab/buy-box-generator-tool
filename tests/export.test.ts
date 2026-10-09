import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildWorkbook, headers, sheetNames } from '../src/lib/exportData';
import { newSpec } from '../src/lib/defaults';
import { sampleDataset } from '../src/lib/sample';
import { boxListings } from '../src/lib/analysis';

describe('workbook export', () => {
  const data = sampleDataset();
  const spec = newSpec(data, { name: 'Test', region: 'OR' });
  spec.boxes.push({ ...JSON.parse(JSON.stringify(spec.boxes[0])), id: 'b2', name: 'Pool: homes/large [x]' });
  spec.boxes[1].regions = [[[44.9, -124.1], [44.9, -123.9], [45.0, -123.9], [45.0, -124.1]]];
  const wb = buildWorkbook(spec, data);

  it('has a market sheet with every listing plus one sheet per buy box', () => {
    expect(wb.SheetNames).toEqual(['Market data', 'Buy Box 1', 'Pool homes large x']);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Market data']);
    expect(rows.length).toBe(data.listings.length);
  });
  it('buy-box sheets hold exactly the listings that match the buy box', () => {
    spec.boxes.forEach((b, i) => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[i + 1]]);
      expect(rows.length).toBe(boxListings(data, b).length);
    });
  });
  it('contains only the embedded columns', () => {
    const h = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Market data'], { header: 1 })[0];
    expect(h).toEqual(headers(data));
    expect(h).not.toContain('Revenue Tier');
    expect(h).toContain('Hot Tub');
    expect(h).toContain('Group trip (% of reviews)');
  });
  it('sanitises and de-duplicates sheet names', () => {
    expect(sheetNames(['A/B', 'A/B', '', 'x'.repeat(40)])).toEqual(['A B', 'A B (2)', 'Buy Box 3', 'x'.repeat(31)]);
  });
});
