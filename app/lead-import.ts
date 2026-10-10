import * as XLSX from 'xlsx';

export type ParsedLead = {
  selected: boolean;
  name: string;
  company: string;
  phone: string;
  email: string;
  city: string;
  owner: string;
  service: string;
  progress: string;
  status: string;
  stage: string;
  source: string;
  platform: string;
  remarks: string;
  date: string;
  createdAt?: string;
  budget: string;
  timeline: string;
  temperature: string;
  isValid: boolean;
  validationError?: string;
  raw: Record<string, unknown>;
};

export type ImportParseResult = {
  leads: ParsedLead[];
  headers: string[];
  totalRows: number;
  validCount: number;
  warnings: string[];
};

export function safeString(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint') {
    return String(val);
  }
  return '';
}

/**
 * Normalizes stage / progress string from spreadsheets into CRM status & stage
 */
export function normalizeProgress(value: unknown): { status: string; stage: string } {
  const str = safeString(value).trim();
  const lower = str.toLowerCase();

  if (!str) return { status: 'New leads', stage: 'New' };
  if (/closed|won|converted|completed/i.test(lower)) {
    return { status: 'Closed', stage: 'Won' };
  }
  if (/proposal|quote|quotation|packages? sent/i.test(lower)) {
    return { status: 'Proposal', stage: 'Proposal Sent' };
  }
  if (/interested|warm|hot/i.test(lower)) {
    return { status: 'Interested', stage: 'Interested' };
  }
  if (/contacted|called|reach(?:ed)? out|discovery|talked/i.test(lower)) {
    return { status: 'Contacted', stage: 'Contacted' };
  }
  if (/ringing|no ans(?:wer)?|busy|callback|call back/i.test(lower)) {
    return { status: 'Ringing', stage: 'Ringing' };
  }
  if (/delayed|on hold|hold|postponed|pending|future/i.test(lower)) {
    return { status: 'Contacted', stage: 'Contacted' };
  }
  if (/lost|drop(?:ped)?|junk|not interested|rejected|dead/i.test(lower)) {
    return { status: 'Lost', stage: 'Lost' };
  }
  if (/new/i.test(lower)) {
    return { status: 'New leads', stage: 'New' };
  }

  return { status: 'New leads', stage: 'New' };
}

/**
 * Parses diverse date formats: Excel serial numbers, DD/MM/YY, DD/MM/YYYY, YYYY-MM-DD, etc.
 */
export function parseSpreadsheetDate(value: unknown): { dateStr: string; sqlDate: string } {
  if (value === null || value === undefined || value === '') {
    const today = new Date().toISOString().slice(0, 10);
    return { dateStr: today, sqlDate: today };
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const iso = value.toISOString().slice(0, 10);
    return { dateStr: iso, sqlDate: iso };
  }

  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(date.getTime())) {
      const iso = date.toISOString().slice(0, 10);
      return { dateStr: iso, sqlDate: iso };
    }
  }

  const str = safeString(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const match = str.slice(0, 10);
    return { dateStr: match, sqlDate: match };
  }

  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmyMatch) {
    let day = Number(dmyMatch[1]);
    let month = Number(dmyMatch[2]);
    let year = Number(dmyMatch[3]);

    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) {
      const tmp = day;
      day = month;
      month = tmp;
    }

    const yStr = String(year);
    const mStr = String(month).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const formatted = `${yStr}-${mStr}-${dStr}`;
    return { dateStr: str, sqlDate: formatted };
  }

  return { dateStr: str, sqlDate: new Date().toISOString().slice(0, 10) };
}

/**
 * Cleans and formats phone numbers
 */
export function formatPhoneNumber(value: unknown): string {
  if (!value) return '';
  const str = safeString(value).trim();
  if (/^\d+(\.\d+)?e\+\d+$/i.test(str)) {
    try {
      const num = Number(str);
      return String(BigInt(Math.floor(num)));
    } catch {
      return str;
    }
  }
  return str;
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replaceAll(/['"`’]/g, '')
    .replaceAll(/[^a-z0-9]/g, '');
}

function matchColumn(header: string): string | null {
  const norm = normalizeHeader(header);
  if (!norm) return null;

  if (['clientsname', 'clientname', 'client', 'name', 'leadname', 'customername', 'fullname', 'contactperson'].includes(norm)) {
    return 'name';
  }
  if (['companyname', 'company', 'brand', 'brandname', 'business', 'organization', 'org'].includes(norm)) {
    return 'company';
  }
  if (['contact', 'phone', 'phonenumber', 'contactnumber', 'mobile', 'mobilenumber', 'tel', 'cell'].includes(norm)) {
    return 'phone';
  }
  if (['email', 'emailaddress', 'mail'].includes(norm)) {
    return 'email';
  }
  if (['place', 'city', 'location', 'address', 'state', 'region'].includes(norm)) {
    return 'city';
  }
  if (['pointofcontact', 'poc', 'owner', 'assignedto', 'assignee', 'representative', 'agent', 'salesrep'].includes(norm)) {
    return 'owner';
  }
  if (['service', 'services', 'serviceinterested', 'interestedin', 'projecttype', 'requirement', 'domain'].includes(norm)) {
    return 'service';
  }
  if (['progress', 'stage', 'status', 'leadstatus', 'pipelinestage', 'state'].includes(norm)) {
    return 'progress';
  }
  if (['source', 'leadsource', 'channel', 'platform', 'campaign', 'medium'].includes(norm)) {
    return 'source';
  }
  if (['remarks', 'remark', 'notes', 'note', 'comments', 'comment', 'description', 'activity', 'details'].includes(norm)) {
    return 'remarks';
  }
  if (['date', 'createddate', 'leaddate', 'creationdate', 'entrydate', 'addeddate', 'timestamp'].includes(norm)) {
    return 'date';
  }
  if (['budget', 'estimatedvalue', 'amount', 'projectbudget', 'dealvalue', 'value'].includes(norm)) {
    return 'budget';
  }
  if (['timeline', 'projecttimeline', 'duration', 'starttimeline'].includes(norm)) {
    return 'timeline';
  }
  if (['priority', 'temperature', 'leadpriority', 'urgency'].includes(norm)) {
    return 'temperature';
  }

  return null;
}
/**
 * Parse an Excel (.xlsx, .xls) or CSV array buffer / file
 */
export async function parseLeadSpreadsheet(bufferOrFile: ArrayBuffer | File): Promise<ImportParseResult> {
  const buffer = bufferOrFile instanceof File ? await bufferOrFile.arrayBuffer() : bufferOrFile;
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The workbook contains no sheets.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('The spreadsheet is empty.');
  }

  let headerRowIndex = -1;
  let matchedHeaders: { index: number; original: string; field: string }[] = [];

  for (let r = 0; r < Math.min(rawRows.length, 12); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    const matches: { index: number; original: string; field: string }[] = [];
    row.forEach((cell, colIdx) => {
      const cellStr = safeString(cell).trim();
      if (!cellStr) return;
      const field = matchColumn(cellStr);
      if (field) {
        matches.push({ index: colIdx, original: cellStr, field });
      }
    });

    const hasNameOrContact = matches.some((m) => ['name', 'phone', 'company'].includes(m.field));
    if (matches.length >= 2 && hasNameOrContact) {
      headerRowIndex = r;
      matchedHeaders = matches;
      break;
    }
  }

  if (headerRowIndex === -1) {
    for (let r = 0; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (Array.isArray(row) && row.some((c) => safeString(c).trim())) {
        headerRowIndex = r;
        matchedHeaders = row.map((c, colIdx) => {
          const str = safeString(c).trim();
          return {
            index: colIdx,
            original: str || `Column ${colIdx + 1}`,
            field: matchColumn(str) || `col_${colIdx}`,
          };
        });
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Could not find a valid table header in the uploaded file.');
  }

  const dataRows = rawRows.slice(headerRowIndex + 1);
  const leads: ParsedLead[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!Array.isArray(row) || !row.some((cell) => safeString(cell).trim())) {
      continue;
    }

    const rowObj: Record<string, unknown> = {};
    const remarksParts: string[] = [];

    for (const { index, field, original } of matchedHeaders) {
      const cellValue = row[index];
      const cellStr = safeString(cellValue).trim();

      if (field === 'remarks' && cellStr) {
        remarksParts.push(cellStr);
      }

      if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
        rowObj[field] = cellValue;
        rowObj[original] = cellValue;
      } else if (rowObj[field] === undefined) {
        rowObj[field] = cellValue;
        rowObj[original] = cellValue;
      }
    }

    const rawName = safeString(rowObj.name).trim();
    const rawCompany = safeString(rowObj.company).trim();
    const rawPhone = formatPhoneNumber(rowObj.phone);
    const rawEmail = safeString(rowObj.email).trim();
    const rawCity = safeString(rowObj.city).trim();
    const rawOwner = safeString(rowObj.owner).trim();
    const rawService = safeString(rowObj.service).trim();
    const rawProgress = safeString(rowObj.progress).trim();
    const rawSource = safeString(rowObj.source).trim();
    const rawRemarks = remarksParts.join(' | ') || safeString(rowObj.remarks).trim();
    const rawDate = rowObj.date;
    const rawBudget = safeString(rowObj.budget).trim();
    const rawTimeline = safeString(rowObj.timeline).trim();
    const rawTemp = safeString(rowObj.temperature).trim();

    const { status, stage } = normalizeProgress(rawProgress);
    const { dateStr, sqlDate } = parseSpreadsheetDate(rawDate);

    let platform = 'Website';
    if (/facebook|fb/i.test(rawSource)) platform = 'Facebook';
    else if (/instagram|insta|ig/i.test(rawSource)) platform = 'Instagram';

    const isValid = Boolean(rawName || rawCompany || rawPhone);
    let validationError: string | undefined;

    if (!rawName) {
      if (rawCompany) {
        validationError = 'Name empty; using Company.';
      } else if (rawPhone) {
        validationError = 'Name empty; using Contact.';
      } else {
        validationError = 'Missing client name.';
      }
    }

    leads.push({
      selected: isValid,
      name: rawName || rawCompany || (rawPhone ? `Lead ${rawPhone}` : 'Unknown Lead'),
      company: rawCompany,
      phone: rawPhone,
      email: rawEmail,
      city: rawCity,
      owner: rawOwner,
      service: rawService,
      progress: rawProgress || stage,
      status,
      stage,
      source: rawSource || 'Excel Import',
      platform,
      remarks: rawRemarks,
      date: dateStr,
      createdAt: sqlDate,
      budget: rawBudget,
      timeline: rawTimeline,
      temperature: rawTemp,
      isValid,
      validationError,
      raw: rowObj,
    });
  }

  const validCount = leads.filter((l) => l.isValid).length;
  if (leads.length === 0) {
    warnings.push('No data rows found below the header row.');
  }

  return {
    leads,
    headers: matchedHeaders.map((m) => m.original),
    totalRows: leads.length,
    validCount,
    warnings,
  };
}

/**
 * Generates and downloads a sample Excel (.xlsx) file with pre-configured headers
 */
export function downloadSampleLeadTemplate() {
  const headers = [
    'Date',
    "Client's Name",
    'Company Name',
    'Contact',
    'Place',
    'Point of Contact',
    'Service',
    'Progress',
    'Source',
    'Remarks',
  ];

  const sampleRows = [
    [
      '08/03/26',
      'soshal',
      'real estate',
      '919871107544',
      'Delhi',
      'Divyansh',
      'Full Stack',
      'Closed',
      'Paid Ads',
      'Start from 17th August',
    ],
    [
      '08/03/26',
      'Prakhar singh',
      'cafe noida',
      '919818897128',
      'Delhi',
      'Shaurya',
      'social media',
      'Delayed',
      'Paid Ads',
      'Book discovery -- wants to start in October',
    ],
    [
      '10/03/26',
      'Aarav Sharma',
      'Luxe Living',
      '+91 98112 34567',
      'Mumbai',
      'Kartik',
      'Branding & Web',
      'Proposal',
      'Website',
      'Shared commercial quotation for 3 months',
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 38 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'LEADS');

  XLSX.writeFile(workbook, 'sort-crm-leads-template.xlsx');
}
