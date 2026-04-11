import prisma from './prisma';

// Mirrors NumberGenerator.java
// Uses DB to find max sequence to survive restarts

let orderSeq = -1;
let invoiceSeq = -1;

function dateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function nanoLike(): string {
  return String(Date.now() % 100000).padStart(5, '0');
}

async function nextOrderSeq(): Promise<number> {
  if (orderSeq < 0) {
    const today = dateStr();
    // Find the highest sequence for today's orders
    const result = await prisma.$queryRaw<{ max_seq: number | null }[]>`
      SELECT MAX(CAST(SPLIT_PART(order_number, '-', 4) AS INTEGER)) as max_seq
      FROM orders
      WHERE order_number LIKE ${'ORD-%-' + today + '-%'}
    `.catch(() => [{ max_seq: null }]);
    const maxSeq = result[0]?.max_seq ?? 0;
    orderSeq = maxSeq + 1;
  }
  return orderSeq++;
}

async function nextInvoiceSeq(prefix: string): Promise<number> {
  if (invoiceSeq < 0) {
    const result = await prisma.$queryRaw<{ max_seq: number | null }[]>`
      SELECT MAX(CAST(SPLIT_PART(invoice_number, '-', 3) AS INTEGER)) as max_seq
      FROM invoices
      WHERE invoice_number LIKE ${prefix + '%'}
    `.catch(() => [{ max_seq: null }]);
    const maxSeq = result[0]?.max_seq ?? 0;
    invoiceSeq = maxSeq + 1;
  }
  return invoiceSeq++;
}

function getFiscalYearPrefix(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-based
  const startYear = month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return String(startYear % 100).padStart(2, '0') + String((startYear + 1) % 100).padStart(2, '0');
}

export async function generateOrderNumber(outletCode: string): Promise<string> {
  const date = dateStr();
  const seq = await nextOrderSeq();
  return `ORD-${outletCode}-${date}-${String(seq).padStart(5, '0')}`;
}

export async function generateInvoiceNumber(): Promise<string> {
  const fy = getFiscalYearPrefix();
  const prefix = `INV-${fy}-`;
  const seq = await nextInvoiceSeq(prefix);
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

export function generateTransferNumber(): string {
  return `TRF-${dateStr()}-${nanoLike()}`;
}

export function generateCreditNoteNumber(): string {
  return `CN-${dateStr()}-${nanoLike()}`;
}

export function generatePONumber(): string {
  return `PO-${dateStr()}-${nanoLike()}`;
}

export function generatePurchaseReturnNumber(): string {
  return `PRN-${dateStr()}-${nanoLike()}`;
}

export function generateQuotationNumber(): string {
  return `QT-${dateStr()}-${nanoLike()}`;
}

export function generateSONumber(): string {
  return `SO-${dateStr()}-${nanoLike()}`;
}

export function generateBulkPurchaseNumber(): string {
  return `BP-${dateStr()}-${nanoLike()}`;
}

export function generateBillNumber(): string {
  return `BILL-${dateStr()}-${nanoLike()}`;
}

export function generateBarcode(): string {
  const partial = '890' + String(Math.abs(Date.now() % 1_000_000_000)).padStart(9, '0');
  const weights = [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(partial[i]) * weights[i];
  }
  const check = (10 - (sum % 10)) % 10;
  return partial + check;
}

// Reset sequences (for testing)
export function resetSequences(): void {
  orderSeq = -1;
  invoiceSeq = -1;
}
