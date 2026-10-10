import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import {
  parseSpreadsheetDate,
  normalizeProgress,
  formatPhoneNumber,
  parseLeadSpreadsheet,
} from '../../app/lead-import.ts';

void test('normalizes status and stage correctly', () => {
  assert.deepEqual(normalizeProgress('Closed'), { status: 'Closed', stage: 'Won' });
  assert.deepEqual(normalizeProgress('Delayed'), { status: 'Contacted', stage: 'Contacted' });
  assert.deepEqual(normalizeProgress('New'), { status: 'New leads', stage: 'New' });
  assert.deepEqual(normalizeProgress('Proposal Sent'), { status: 'Proposal', stage: 'Proposal Sent' });
  assert.deepEqual(normalizeProgress('Lost'), { status: 'Lost', stage: 'Lost' });
  assert.deepEqual(normalizeProgress('Dead'), { status: 'Lost', stage: 'Lost' });
  assert.deepEqual(normalizeProgress('Discovery Call'), { status: 'Contacted', stage: 'Contacted' });
  assert.deepEqual(normalizeProgress('Future Case'), { status: 'Contacted', stage: 'Contacted' });
  assert.deepEqual(normalizeProgress('Ringing'), { status: 'Ringing', stage: 'Ringing' });
});

void test('parses spreadsheet date formats', () => {
  const d1 = parseSpreadsheetDate('08/03/26');
  assert.equal(d1.sqlDate, '2026-03-08');

  const d2 = parseSpreadsheetDate('2026-10-15');
  assert.equal(d2.sqlDate, '2026-10-15');
});

void test('formats phone numbers properly', () => {
  assert.equal(formatPhoneNumber('919871107544'), '919871107544');
  assert.equal(formatPhoneNumber('+91 98711 07544'), '+91 98711 07544');
});

void test('parses an Excel workbook with user sample columns and banner rows', async () => {
  // Simulate the spreadsheet in the user prompt:
  // Row 1-2: Banner LEADS
  // Row 3: Header
  // Row 4-5: Data
  const sheetData = [
    ['LEADS'],
    [],
    ['Date', "Client's Name", 'Company Name', 'Contact', 'Place', 'Point of Contact', 'Service', 'Progress', 'Source', 'Remarks'],
    ['08/03/26', 'soshal', 'real estate', '919871107544', 'Delhi', 'Divyansh', 'Full Stack', 'Closed', 'Paid Ads', 'Start from 17th August'],
    ['08/03/26', 'Prakhar singh', 'cafe noida', '919818897128', 'Delhi', 'Shaurya', 'social media', 'Delayed', 'Paid Ads', 'Book discovery -- wants to start in October'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const result = await parseLeadSpreadsheet(buffer);

  assert.equal(result.totalRows, 2);
  assert.equal(result.validCount, 2);

  const [lead1, lead2] = result.leads;
  assert.equal(lead1.name, 'soshal');
  assert.equal(lead1.company, 'real estate');
  assert.equal(lead1.phone, '919871107544');
  assert.equal(lead1.city, 'Delhi');
  assert.equal(lead1.owner, 'Divyansh');
  assert.equal(lead1.service, 'Full Stack');
  assert.equal(lead1.status, 'Closed');
  assert.equal(lead1.stage, 'Won');
  assert.equal(lead1.source, 'Paid Ads');
  assert.equal(lead1.remarks, 'Start from 17th August');

  assert.equal(lead2.name, 'Prakhar singh');
  assert.equal(lead2.company, 'cafe noida');
  assert.equal(lead2.phone, '919818897128');
  assert.equal(lead2.city, 'Delhi');
  assert.equal(lead2.owner, 'Shaurya');
  assert.equal(lead2.service, 'social media');
  assert.equal(lead2.remarks, 'Book discovery -- wants to start in October');
});

void test('correctly parses user sheet with duplicate remarks columns and Dead as Lost', async () => {
  const csvData = `LEADS ,,,,,,,,,,,,
,,,,,,,,,,,,
Sno,Date,Client's Name,Company Name,Contact ,Place,Point of Contact,Service,Progress,Source,Remarks,Remarks,Remarks
1,2026-08-03,soshal,real estate ,919871107544,Delhi,Divyansh,Full Stack,Closed,Paid Ads,Start from 17th August,,
2,2026-08-03,Prakhar singh,cafe noida ,919818897128,Delhi,Shaurya,social media ,Delayed,Paid Ads,Book discovery -- wants to start in October,,
3,2026-08-03,Urvi,d2c cosmetics ,919911002599,Gurugram,Divyansh,Full Stack,Dead,Paid Ads,BUILDING HER IN HOUSE TEAM RN.,,
4,2026-08-03,pooja omveer,skincare ,9871667422,Delhi,Divyansh,Paid Ads,Future Case,Paid Ads,"BUDGET TOO LOW RN 20K PER MONTH , FUTURE EXPECTION OF HIGH BUDGET.",,
5,2026-08-03, namit jain ,Ratnaya silver,919310065553,Delhi,Divyansh,social media ,Discovery Call,Paid Ads,"discovery done, delayed for now followed up muliple times ",,
`;

  const wb = XLSX.read(csvData, { type: 'string' });
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const result = await parseLeadSpreadsheet(buffer);

  assert.equal(result.totalRows, 5);
  assert.equal(result.validCount, 5);

  const [l1, l2, l3, l4, l5] = result.leads;

  // Row 1: Closed -> Won
  assert.equal(l1.name, 'soshal');
  assert.equal(l1.company, 'real estate');
  assert.equal(l1.phone, '919871107544');
  assert.equal(l1.status, 'Closed');
  assert.equal(l1.stage, 'Won');
  assert.equal(l1.remarks, 'Start from 17th August');

  // Row 2: Delayed -> Contacted
  assert.equal(l2.name, 'Prakhar singh');
  assert.equal(l2.company, 'cafe noida');
  assert.equal(l2.phone, '919818897128');
  assert.equal(l2.status, 'Contacted');
  assert.equal(l2.remarks, 'Book discovery -- wants to start in October');

  // Row 3: Dead -> Lost
  assert.equal(l3.name, 'Urvi');
  assert.equal(l3.company, 'd2c cosmetics');
  assert.equal(l3.phone, '919911002599');
  assert.equal(l3.city, 'Gurugram');
  assert.equal(l3.status, 'Lost');
  assert.equal(l3.stage, 'Lost');
  assert.equal(l3.remarks, 'BUILDING HER IN HOUSE TEAM RN.');

  // Row 4: Future Case -> Contacted
  assert.equal(l4.name, 'pooja omveer');
  assert.equal(l4.company, 'skincare');
  assert.equal(l4.phone, '9871667422');
  assert.equal(l4.status, 'Contacted');
  assert.equal(l4.remarks, 'BUDGET TOO LOW RN 20K PER MONTH , FUTURE EXPECTION OF HIGH BUDGET.');

  // Row 5: Discovery Call -> Contacted
  assert.equal(l5.name, 'namit jain');
  assert.equal(l5.company, 'Ratnaya silver');
  assert.equal(l5.phone, '919310065553');
  assert.equal(l5.status, 'Contacted');
  assert.equal(l5.remarks, 'discovery done, delayed for now followed up muliple times');
});

