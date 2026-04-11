import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma';

function d(v: any): Decimal {
  return new Decimal(String(v ?? 0));
}

async function getOutletInfo(outletId: number) {
  return prisma.outlet.findUnique({
    where: { id: outletId },
    select: { name: true, gstin: true },
  });
}

// ── GSTR-1 ────────────────────────────────────────────────────────────────────

export async function getGstr1(outletId: number, from: Date, to: Date) {
  const outlet = await getOutletInfo(outletId);

  const orders = await prisma.order.findMany({
    where: { outletId, status: 'COMPLETED', createdAt: { gte: from, lte: to } },
    include: {
      items: { include: { product: { include: { taxGroup: true } } } },
      customer: true,
      invoices: { select: { invoiceNumber: true } },
    },
  });

  // B2B: orders with customers that have a GSTIN
  const b2b = orders
    .filter(o => o.customer?.gstin)
    .map(o => {
      const taxable = d(o.subtotal).minus(d(o.discountAmount));
      const tax = d(o.taxAmount);
      const cgst = tax.div(2).toDecimalPlaces(2);
      const sgst = tax.minus(cgst);
      return {
        gstin: o.customer!.gstin,
        customerName: o.customer!.name,
        invoiceNumber: o.invoices?.[0]?.invoiceNumber ?? o.orderNumber,
        invoiceDate: o.createdAt.toISOString().split('T')[0],
        invoiceValue: d(o.totalAmount),
        taxableValue: taxable,
        cgst,
        sgst,
        igst: new Decimal(0),
      };
    });

  // B2CS: group by tax rate (unregistered customers)
  const b2csMap: Record<string, { taxRate: string; taxableValue: Decimal; cgst: Decimal; sgst: Decimal; igst: Decimal }> = {};
  for (const o of orders.filter(o => !o.customer?.gstin)) {
    for (const item of o.items) {
      const rate = String(Number(item.taxRate));
      const taxable = d(item.quantity).mul(d(item.unitPrice)).minus(d(item.discountAmount));
      const tax = d(item.taxAmount);
      const cgst = tax.div(2).toDecimalPlaces(2);
      const sgst = tax.minus(cgst);
      if (!b2csMap[rate]) b2csMap[rate] = { taxRate: rate, taxableValue: new Decimal(0), cgst: new Decimal(0), sgst: new Decimal(0), igst: new Decimal(0) };
      b2csMap[rate].taxableValue = b2csMap[rate].taxableValue.plus(taxable);
      b2csMap[rate].cgst = b2csMap[rate].cgst.plus(cgst);
      b2csMap[rate].sgst = b2csMap[rate].sgst.plus(sgst);
    }
  }

  // HSN Summary from all order items
  const hsnMap: Record<string, any> = {};
  for (const o of orders) {
    for (const item of o.items) {
      const hsn = item.product?.taxGroup?.hsnCode ?? '';
      const key = hsn || 'NO_HSN';
      const taxable = d(item.quantity).mul(d(item.unitPrice)).minus(d(item.discountAmount));
      const tax = d(item.taxAmount);
      const cgst = tax.div(2).toDecimalPlaces(2);
      const sgst = tax.minus(cgst);
      if (!hsnMap[key]) hsnMap[key] = {
        hsnCode: hsn,
        description: item.product?.name ?? 'Unknown',
        uom: item.product?.unitOfMeasure ?? 'Pcs',
        totalQuantity: new Decimal(0),
        totalValue: new Decimal(0),
        taxableValue: new Decimal(0),
        cgst: new Decimal(0),
        sgst: new Decimal(0),
        igst: new Decimal(0),
        totalTax: new Decimal(0),
      };
      hsnMap[key].totalQuantity = hsnMap[key].totalQuantity.plus(d(item.quantity));
      hsnMap[key].totalValue = hsnMap[key].totalValue.plus(d(item.lineTotal));
      hsnMap[key].taxableValue = hsnMap[key].taxableValue.plus(taxable);
      hsnMap[key].cgst = hsnMap[key].cgst.plus(cgst);
      hsnMap[key].sgst = hsnMap[key].sgst.plus(sgst);
      hsnMap[key].totalTax = hsnMap[key].totalTax.plus(tax);
    }
  }

  const totalTaxableValue = orders.reduce((s, o) => s.plus(d(o.subtotal).minus(d(o.discountAmount))), new Decimal(0));
  const totalTax = orders.reduce((s, o) => s.plus(d(o.taxAmount)), new Decimal(0));
  const totalCgst = totalTax.div(2).toDecimalPlaces(2);
  const totalSgst = totalTax.minus(totalCgst);
  const grandTotal = orders.reduce((s, o) => s.plus(d(o.totalAmount)), new Decimal(0));

  return {
    period: `${from.toISOString().split('T')[0]} to ${to.toISOString().split('T')[0]}`,
    outletGstin: outlet?.gstin ?? null,
    totalInvoices: orders.length,
    totalTaxableValue,
    totalCgst,
    totalSgst,
    totalIgst: new Decimal(0),
    grandTotal,
    b2b,
    b2cs: Object.values(b2csMap),
    hsnSummary: Object.values(hsnMap),
  };
}

// ── GSTR-3B ───────────────────────────────────────────────────────────────────

export async function getGstr3b(outletId: number, from: Date, to: Date) {
  const outlet = await getOutletInfo(outletId);

  const orders = await prisma.order.findMany({
    where: { outletId, status: 'COMPLETED', createdAt: { gte: from, lte: to } },
  });

  const grossSales = orders.reduce((s, o) => s.plus(d(o.totalAmount)), new Decimal(0));
  const totalDiscount = orders.reduce((s, o) => s.plus(d(o.discountAmount)), new Decimal(0));
  const taxable = orders.reduce((s, o) => s.plus(d(o.subtotal).minus(d(o.discountAmount))), new Decimal(0));
  const outputTax = orders.reduce((s, o) => s.plus(d(o.taxAmount)), new Decimal(0));
  const cgstOut = outputTax.div(2).toDecimalPlaces(2);
  const sgstOut = outputTax.minus(cgstOut);

  // ITC from purchase bills in the period
  const bills = await prisma.purchaseBill.findMany({
    where: { outletId, billDate: { gte: from, lte: to } },
  });
  const itcIgst = bills.reduce((s, b) => s.plus(d(b.igstAmount)), new Decimal(0));
  const itcCgst = bills.reduce((s, b) => s.plus(d(b.cgstAmount)), new Decimal(0));
  const itcSgst = bills.reduce((s, b) => s.plus(d(b.sgstAmount)), new Decimal(0));

  const netCgst = cgstOut.minus(itcCgst);
  const netSgst = sgstOut.minus(itcSgst);
  const netIgst = new Decimal(0).minus(itcIgst);
  const clamp = (v: Decimal) => (v.lessThan(0) ? new Decimal(0) : v);

  const excessCgst = netCgst.lessThan(0) ? netCgst.abs() : new Decimal(0);
  const excessSgst = netSgst.lessThan(0) ? netSgst.abs() : new Decimal(0);
  const excessIgst = netIgst.lessThan(0) ? netIgst.abs() : new Decimal(0);

  return {
    period: `${from.toISOString().split('T')[0]} to ${to.toISOString().split('T')[0]}`,
    outletGstin: outlet?.gstin ?? null,
    outletName: outlet?.name ?? '',
    grossSales,
    totalDiscount,
    billCount: bills.length,
    section3_1_taxable: {
      taxableValue: taxable,
      igst: new Decimal(0),
      cgst: cgstOut,
      sgst: sgstOut,
      cess: new Decimal(0),
    },
    section4_itc: {
      igst: itcIgst,
      cgst: itcCgst,
      sgst: itcSgst,
      cess: new Decimal(0),
    },
    netTaxPayable: {
      igst: clamp(netIgst),
      cgst: clamp(netCgst),
      sgst: clamp(netSgst),
      cess: new Decimal(0),
      total: clamp(netCgst).plus(clamp(netSgst)).plus(clamp(netIgst)),
    },
    itcCarryForward: {
      cgst: excessCgst,
      sgst: excessSgst,
      igst: excessIgst,
      total: excessCgst.plus(excessSgst).plus(excessIgst),
    },
  };
}

// ── HSN Summary (Sales) ───────────────────────────────────────────────────────

export async function getHsnSummary(outletId: number, from: Date, to: Date) {
  const orders = await prisma.order.findMany({
    where: { outletId, status: 'COMPLETED', createdAt: { gte: from, lte: to } },
    include: { items: { include: { product: { include: { taxGroup: true } } } } },
  });

  const hsnMap: Record<string, any> = {};
  for (const o of orders) {
    for (const item of o.items) {
      const hsn = item.product?.taxGroup?.hsnCode ?? '';
      const key = hsn || 'NO_HSN';
      const taxable = d(item.quantity).mul(d(item.unitPrice)).minus(d(item.discountAmount));
      const tax = d(item.taxAmount);
      const cgst = tax.div(2).toDecimalPlaces(2);
      const sgst = tax.minus(cgst);
      if (!hsnMap[key]) hsnMap[key] = {
        hsnCode: hsn,
        description: item.product?.name ?? 'Unknown',
        uom: item.product?.unitOfMeasure ?? 'Pcs',
        totalQuantity: new Decimal(0),
        totalValue: new Decimal(0),
        taxableValue: new Decimal(0),
        cgst: new Decimal(0),
        sgst: new Decimal(0),
        igst: new Decimal(0),
        totalTax: new Decimal(0),
      };
      hsnMap[key].totalQuantity = hsnMap[key].totalQuantity.plus(d(item.quantity));
      hsnMap[key].totalValue = hsnMap[key].totalValue.plus(d(item.lineTotal));
      hsnMap[key].taxableValue = hsnMap[key].taxableValue.plus(taxable);
      hsnMap[key].cgst = hsnMap[key].cgst.plus(cgst);
      hsnMap[key].sgst = hsnMap[key].sgst.plus(sgst);
      hsnMap[key].totalTax = hsnMap[key].totalTax.plus(tax);
    }
  }
  return Object.values(hsnMap);
}

// ── HSN Summary (Purchases) ───────────────────────────────────────────────────

export async function getHsnPurchaseSummary(outletId: number, from: Date, to: Date) {
  const bills = await prisma.purchaseBill.findMany({
    where: { outletId, billDate: { gte: from, lte: to } },
    include: { items: { include: { product: { include: { taxGroup: true } } } } },
  });

  const hsnMap: Record<string, any> = {};
  for (const bill of bills) {
    const isIntra = bill.supplyType === 'INTRA_STATE';
    for (const item of bill.items) {
      const hsn = item.product?.taxGroup?.hsnCode ?? '';
      const key = hsn || 'NO_HSN';
      const taxable = d(item.quantity).mul(d(item.unitCost));
      const tax = taxable.mul(d(item.taxRate)).div(100).toDecimalPlaces(2);
      const cgst = isIntra ? tax.div(2).toDecimalPlaces(2) : new Decimal(0);
      const sgst = isIntra ? tax.minus(cgst) : new Decimal(0);
      if (!hsnMap[key]) hsnMap[key] = {
        hsnCode: hsn,
        description: item.product?.name ?? 'Unknown',
        uom: item.product?.unitOfMeasure ?? 'Pcs',
        totalOrderedQty: new Decimal(0),
        totalReceivedQty: new Decimal(0),
        totalValue: new Decimal(0),
        taxableValue: new Decimal(0),
        cgst: new Decimal(0),
        sgst: new Decimal(0),
        totalTax: new Decimal(0),
      };
      hsnMap[key].totalOrderedQty = hsnMap[key].totalOrderedQty.plus(d(item.quantity));
      hsnMap[key].totalReceivedQty = hsnMap[key].totalReceivedQty.plus(d(item.quantity));
      hsnMap[key].totalValue = hsnMap[key].totalValue.plus(d(item.lineTotal));
      hsnMap[key].taxableValue = hsnMap[key].taxableValue.plus(taxable);
      hsnMap[key].cgst = hsnMap[key].cgst.plus(cgst);
      hsnMap[key].sgst = hsnMap[key].sgst.plus(sgst);
      hsnMap[key].totalTax = hsnMap[key].totalTax.plus(tax);
    }
  }
  return Object.values(hsnMap);
}

// ── CSV Exports ───────────────────────────────────────────────────────────────

export async function exportGstr1Csv(outletId: number, from: Date, to: Date): Promise<string> {
  const data = await getGstr1(outletId, from, to);
  const lines = ['Type,GSTIN,Customer,Invoice #,Date,Invoice Value,Taxable Value,CGST,SGST,IGST'];
  for (const r of data.b2b) {
    lines.push(`B2B,${r.gstin},"${r.customerName}",${r.invoiceNumber},${r.invoiceDate},${r.invoiceValue},${r.taxableValue},${r.cgst},${r.sgst},${r.igst}`);
  }
  for (const r of data.b2cs) {
    lines.push(`B2CS,,,"GST ${r.taxRate}%",,,${r.taxableValue},${r.cgst},${r.sgst},${r.igst}`);
  }
  return '\uFEFF' + lines.join('\n');
}

export async function exportGstr3bCsv(outletId: number, from: Date, to: Date): Promise<string> {
  const data = await getGstr3b(outletId, from, to);
  const lines = [
    'Section,Description,IGST,CGST,SGST,Cess',
    `3.1(a),Outward Taxable Supplies,${data.section3_1_taxable.igst},${data.section3_1_taxable.cgst},${data.section3_1_taxable.sgst},0`,
    `4(A)(5),Eligible ITC from Purchase Bills,${data.section4_itc.igst},${data.section4_itc.cgst},${data.section4_itc.sgst},0`,
    `Net,Net Tax Payable,${data.netTaxPayable.igst},${data.netTaxPayable.cgst},${data.netTaxPayable.sgst},0`,
  ];
  return '\uFEFF' + lines.join('\n');
}

export async function exportHsnCsv(outletId: number, from: Date, to: Date): Promise<string> {
  const rows = await getHsnSummary(outletId, from, to);
  const lines = ['HSN Code,Description,UOM,Qty,Total Value,Taxable Value,CGST,SGST,IGST,Total Tax'];
  for (const r of rows) {
    lines.push(`${r.hsnCode},"${r.description}",${r.uom},${r.totalQuantity},${r.totalValue},${r.taxableValue},${r.cgst},${r.sgst},${r.igst},${r.totalTax}`);
  }
  return '\uFEFF' + lines.join('\n');
}

export async function exportHsnPurchaseCsv(outletId: number, from: Date, to: Date): Promise<string> {
  const rows = await getHsnPurchaseSummary(outletId, from, to);
  const lines = ['HSN Code,Description,UOM,Ordered Qty,Received Qty,Total Value,Taxable Value,CGST,SGST,Total Tax'];
  for (const r of rows) {
    lines.push(`${r.hsnCode},"${r.description}",${r.uom},${r.totalOrderedQty},${r.totalReceivedQty},${r.totalValue},${r.taxableValue},${r.cgst},${r.sgst},${r.totalTax}`);
  }
  return '\uFEFF' + lines.join('\n');
}

export async function tallyExport(outletId: number, from: Date, to: Date): Promise<string> {
  const outlet = await getOutletInfo(outletId);
  const orders = await prisma.order.findMany({
    where: { outletId, status: 'COMPLETED', createdAt: { gte: from, lte: to } },
    include: { items: true, customer: true },
  });

  const vouchers = orders.map(o => {
    const cgst = d(o.taxAmount).div(2).toDecimalPlaces(2);
    const sgst = d(o.taxAmount).minus(cgst);
    const taxableValue = d(o.subtotal).minus(d(o.discountAmount));
    return `
      <VOUCHER VCHTYPE="Sales" ACTION="Create">
        <DATE>${o.createdAt.toISOString().split('T')[0].replace(/-/g, '')}</DATE>
        <PARTYLEDGERNAME>${o.customer?.name ?? 'Cash'}</PARTYLEDGERNAME>
        <VOUCHERNUMBER>${o.orderNumber}</VOUCHERNUMBER>
        <AMOUNT>${Number(o.totalAmount)}</AMOUNT>
        <TAXABLEVALUE>${taxableValue}</TAXABLEVALUE>
        <CGST>${cgst}</CGST>
        <SGST>${sgst}</SGST>
      </VOUCHER>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${outlet?.name ?? ''}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${vouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}
