'use client';

import { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Trash2,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import {
  parseLeadSpreadsheet,
  downloadSampleLeadTemplate,
  type ParsedLead,
  type ImportParseResult,
} from './lead-import';

interface ImportLeadsModalProps {
  open: boolean;
  onClose: () => void;
  onImportSuccess: (count: number) => void;
  availableOwners?: string[];
  refreshData: () => Promise<void>;
}

export default function ImportLeadsModal({
  open,
  onClose,
  onImportSuccess,
  availableOwners = [],
  refreshData,
}: ImportLeadsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [leads, setLeads] = useState<ParsedLead[]>([]);
  const [defaultOwner, setDefaultOwner] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setIsDragging(false);
    setParsing(false);
    setParseResult(null);
    setLeads([]);
    setDefaultOwner('');
    setImporting(false);
    setError('');
  };

  const handleClose = () => {
    if (importing) return;
    resetState();
    onClose();
  };

  const processFile = async (selectedFile: File) => {
    if (!selectedFile) return;
    const isSpreadsheet =
      selectedFile.name.endsWith('.xlsx') ||
      selectedFile.name.endsWith('.xls') ||
      selectedFile.name.endsWith('.csv') ||
      selectedFile.name.endsWith('.tsv');

    if (!isSpreadsheet) {
      setError('Please upload an Excel (.xlsx, .xls) or CSV file.');
      return;
    }

    setFile(selectedFile);
    setParsing(true);
    setError('');

    try {
      const result = await parseLeadSpreadsheet(selectedFile);
      setParseResult(result);
      setLeads(result.leads);
      if (result.leads.length === 0) {
        setError('No lead records found in this file. Please check the header row.');
      }
    } catch (err) {
      console.error('Spreadsheet parse error:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse the file.');
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void processFile(f);
  };

  const handleDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void processFile(f);
  };

  const toggleSelectAll = (checked: boolean) => {
    setLeads((prev) => prev.map((l) => (l.isValid ? { ...l, selected: checked } : l)));
  };

  const toggleSelectLead = (index: number) => {
    setLeads((prev) =>
      prev.map((l, i) => (i === index ? { ...l, selected: !l.selected } : l)),
    );
  };

  const selectedCount = leads.filter((l) => l.selected).length;
  const allValidSelected =
    leads.length > 0 && leads.filter((l) => l.isValid).every((l) => l.selected);

  const handleImport = async () => {
    const toImport = leads.filter((l) => l.selected && l.isValid);
    if (toImport.length === 0) {
      setError('Please select at least one valid lead to import.');
      return;
    }

    setImporting(true);
    setError('');

    try {
      const payload = {
        leads: toImport.map((lead) => ({
          name: lead.name,
          company: lead.company,
          phone: lead.phone,
          email: lead.email,
          city: lead.city,
          owner: lead.owner || defaultOwner,
          service: lead.service,
          status: lead.status,
          source: lead.source,
          platform: lead.platform,
          budget: lead.budget,
          timeline: lead.timeline,
          temperature: lead.temperature,
          remarks: lead.remarks,
          created_at: lead.createdAt ? `${lead.createdAt} 12:00:00` : undefined,
        })),
      };

      const response = await api<{ count: number }>('/leads/bulk', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      await refreshData();
      const count = response.count || toImport.length;
      handleClose();
      onImportSuccess(count);
    } catch (err) {
      console.error('Import error:', err);
      setError(
        err instanceof Error ? err.message : 'Import failed. Please try again.',
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="ws-dialog lx-import-dialog">
        <div className="lx-import-modal-header">
          <div className="lx-import-icon-wrap">
            <FileSpreadsheet size={24} className="text-indigo-600" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Import Leads from Excel
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-0.5">
              Upload your Excel sheet (.xlsx, .xls) or CSV. Column headers like{' '}
              <strong className="text-slate-700">Client&apos;s Name</strong>,{' '}
              <strong className="text-slate-700">Company Name</strong>,{' '}
              <strong className="text-slate-700">Contact</strong>,{' '}
              <strong className="text-slate-700">Place</strong>,{' '}
              <strong className="text-slate-700">Point of Contact</strong>, and{' '}
              <strong className="text-slate-700">Remarks</strong> are mapped automatically.
            </DialogDescription>
          </div>
        </div>

        {error && (
          <div className="lx-import-error-banner">
            <AlertCircle size={16} className="shrink-0 text-red-600" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              className="ml-auto text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {!parseResult ? (
          <div className="lx-import-upload-section">
            <button
              type="button"
              className={`lx-import-dropzone ${isDragging ? 'is-dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv"
                className="hidden"
                onChange={handleFileChange}
              />
              {parsing ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 size={36} className="animate-spin text-indigo-600" />
                  <p className="text-sm font-semibold text-slate-700">
                    Reading and mapping spreadsheet data...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="lx-dropzone-icon">
                    <Upload size={28} />
                  </div>
                  <div>
                    <strong className="text-base font-semibold text-slate-800 block">
                      Click to choose an Excel or CSV file
                    </strong>
                    <span className="text-xs text-slate-500 mt-1 block">
                      or drag and drop your spreadsheet here
                    </span>
                    <div className="lx-dropzone-formats">
                      <span className="lx-format-tag">.XLSX</span>
                      <span className="lx-format-tag">.XLS</span>
                      <span className="lx-format-tag">.CSV</span>
                    </div>
                  </div>
                </div>
              )}
            </button>

            <div className="lx-import-template-box">
              <div className="flex items-center gap-3">
                <div className="lx-template-icon">
                  <Download size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Sample Spreadsheet Template
                  </h4>
                  <p className="text-xs text-slate-500">
                    Need the format? Download the sample Excel sheet with pre-filled headers and sample rows.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadSampleLeadTemplate}
                className="lx-template-btn"
              >
                <Download size={14} className="mr-1.5" />
                Download Template
              </Button>
            </div>

            <div className="lx-import-columns-help">
              <h5 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-600" />
                Supported Column Headers:
              </h5>
              <div className="lx-columns-tags">
                {[
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
                ].map((col) => (
                  <span key={col} className="lx-col-tag">
                    {col}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="lx-import-preview-section">
            <div className="lx-preview-toolbar">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="lx-file-badge">
                  <FileSpreadsheet size={15} />
                  <span>{file?.name}</span>
                </div>
                <span className="lx-count-badge lx-count-total">
                  {leads.length} detected
                </span>
                <span className="lx-count-badge lx-count-valid">
                  {selectedCount} ready to import
                </span>
              </div>
              <div className="flex items-center gap-3">
                {availableOwners.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span>Default POC:</span>
                    <select
                      className="lx-field-select-sm"
                      value={defaultOwner}
                      onChange={(e) => setDefaultOwner(e.target.value)}
                    >
                      <option value="">(Keep as in sheet)</option>
                      {availableOwners.map((owner) => (
                        <option key={owner} value={owner}>
                          {owner}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetState}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  <Trash2 size={13} className="mr-1" />
                  Change file
                </Button>
              </div>
            </div>

            <div className="lx-preview-table-container">
              <table className="lx-preview-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={allValidSelected}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        aria-label="Select all valid leads"
                      />
                    </th>
                    <th>Client Name</th>
                    <th>Company</th>
                    <th>Contact</th>
                    <th>Place</th>
                    <th>Point of Contact</th>
                    <th>Service</th>
                    <th>Progress</th>
                    <th>Source</th>
                    <th>Remarks</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, idx) => (
                    <tr
                      key={idx}
                      className={!lead.isValid ? 'is-invalid' : lead.selected ? 'is-selected' : ''}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={lead.selected}
                          disabled={!lead.isValid}
                          onChange={() => toggleSelectLead(idx)}
                          aria-label={`Select ${lead.name}`}
                        />
                      </td>
                      <td className="font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{lead.name}</span>
                          {lead.validationError && (
                            <span
                              className="text-amber-500"
                              title={lead.validationError}
                            >
                              <AlertCircle size={13} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-slate-600">{lead.company || '—'}</td>
                      <td className="text-slate-600 font-mono text-xs">
                        {lead.phone || '—'}
                      </td>
                      <td className="text-slate-600">{lead.city || '—'}</td>
                      <td className="text-slate-700">
                        {lead.owner || defaultOwner || '—'}
                      </td>
                      <td className="text-slate-600">{lead.service || '—'}</td>
                      <td>
                        <span className={`lx-preview-badge stage-${lead.stage.toLowerCase().replaceAll(/\s+/g, '-')}`}>
                          {lead.stage}
                        </span>
                      </td>
                      <td className="text-slate-600">{lead.source}</td>
                      <td className="text-slate-500 max-w-[180px] truncate" title={lead.remarks}>
                        {lead.remarks || '—'}
                      </td>
                      <td className="text-slate-500 whitespace-nowrap text-xs">
                        {lead.date || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="lx-import-modal-footer">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={importing}
          >
            Cancel
          </Button>

          {parseResult && (
            <Button
              type="button"
              disabled={importing || selectedCount === 0}
              onClick={handleImport}
              className="lx-import-submit-btn"
            >
              {importing ? (
                <>
                  <Loader2 size={15} className="animate-spin mr-2" />
                  Importing {selectedCount} Leads...
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} className="mr-2" />
                  Import {selectedCount} {selectedCount === 1 ? 'Lead' : 'Leads'}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
