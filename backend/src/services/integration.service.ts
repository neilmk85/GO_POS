import nodemailer from 'nodemailer';
import prisma from '../utils/prisma';

export interface IntegrationConfig {
  email?: {
    enabled: boolean;
    fromEmail?: string;
    fromName?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
  };
  sms?: {
    enabled: boolean;
    apiKey?: string;
    senderId?: string;
  };
  whatsapp?: {
    enabled: boolean;
    apiUrl?: string;
    token?: string;
    phoneNumberId?: string;
  };
}

function createTransporter(config?: IntegrationConfig['email']) {
  return nodemailer.createTransport({
    host: config?.smtpHost || process.env.MAIL_HOST || 'smtp.gmail.com',
    port: config?.smtpPort || parseInt(process.env.MAIL_PORT || '587'),
    secure: false,
    auth: {
      user: config?.smtpUser || process.env.MAIL_USER || '',
      pass: config?.smtpPass || process.env.MAIL_PASS || '',
    },
  });
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

export async function getConfig(outletId: number) {
  return prisma.integrationConfig.findUnique({ where: { outletId } });
}

export async function upsertConfig(outletId: number, channelConfig: unknown, templates: unknown) {
  return prisma.integrationConfig.upsert({
    where: { outletId },
    update: { channelConfig: channelConfig as never, templates: templates as never },
    create: { outletId, channelConfig: channelConfig as never, templates: templates as never },
  });
}

export async function upsertChannelConfig(outletId: number, channelConfig: unknown) {
  const existing = await getConfig(outletId);
  return prisma.integrationConfig.upsert({
    where: { outletId },
    update: { channelConfig: channelConfig as never },
    create: { outletId, channelConfig: channelConfig as never, templates: (existing?.templates ?? {}) as never },
  });
}

export async function upsertTemplates(outletId: number, templates: unknown) {
  const existing = await getConfig(outletId);
  return prisma.integrationConfig.upsert({
    where: { outletId },
    update: { templates: templates as never },
    create: { outletId, channelConfig: (existing?.channelConfig ?? {}) as never, templates: templates as never },
  });
}

export async function sendInvoiceEmail(invoiceId: number, email: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true, outlet: true, items: true },
  });
  if (!invoice) throw new Error('Invoice not found');

  const config = await getConfig(invoice.outletId);
  const emailConfig = config?.channelConfig ? (config.channelConfig as Record<string, unknown>)['email'] as IntegrationConfig['email'] : undefined;
  const templates = config?.templates as Record<string, unknown> | null;
  const invoiceTemplate = templates?.['invoice'] as string | undefined;

  const vars = {
    invoiceName: invoice.invoiceNumber,
    customerName: invoice.customer?.name ?? '',
    amount: invoice.totalAmount.toString(),
    dueDate: invoice.dueDate?.toLocaleDateString() ?? '',
    outletName: invoice.outlet.name,
  };

  const subject = `Invoice ${invoice.invoiceNumber} from ${invoice.outlet.name}`;
  const html = invoiceTemplate ? interpolate(invoiceTemplate, vars)
    : `<h2>Invoice ${invoice.invoiceNumber}</h2><p>Amount: ${invoice.totalAmount}</p>`;

  const transporter = createTransporter(emailConfig);
  const fromEmail = emailConfig?.fromEmail || process.env.MAIL_FROM_EMAIL || 'receipts@posapp.com';
  const fromName = emailConfig?.fromName || process.env.MAIL_FROM_NAME || 'POS System';

  await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to: email,
    subject,
    html,
  });

  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'SENT' } });
}

export async function sendQuotationEmail(quotationId: number, email: string) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { customer: true, outlet: true, items: true },
  });
  if (!quotation) throw new Error('Quotation not found');

  const config = await getConfig(quotation.outletId);
  const emailConfig = config?.channelConfig ? (config.channelConfig as Record<string, unknown>)['email'] as IntegrationConfig['email'] : undefined;

  const subject = `Quotation ${quotation.quotationNumber} from ${quotation.outlet.name}`;
  const html = `<h2>Quotation ${quotation.quotationNumber}</h2>
    <p>Dear ${quotation.customer?.name ?? 'Customer'},</p>
    <p>Please find attached our quotation for ₹${quotation.totalAmount}.</p>
    <p>Valid until: ${quotation.validUntil?.toLocaleDateString() ?? 'N/A'}</p>`;

  const transporter = createTransporter(emailConfig);
  const fromEmail = emailConfig?.fromEmail || process.env.MAIL_FROM_EMAIL || 'receipts@posapp.com';
  const fromName = emailConfig?.fromName || process.env.MAIL_FROM_NAME || 'POS System';

  await transporter.sendMail({ from: `${fromName} <${fromEmail}>`, to: email, subject, html });
  await prisma.quotation.update({ where: { id: quotationId }, data: { status: 'SENT' } });
}

export async function testEmail(outletId: number, testEmail: string) {
  const config = await getConfig(outletId);
  const emailConfig = config?.channelConfig ? (config.channelConfig as Record<string, unknown>)['email'] as IntegrationConfig['email'] : undefined;

  const transporter = createTransporter(emailConfig);
  await transporter.sendMail({
    from: `${process.env.MAIL_FROM_NAME || 'POS System'} <${process.env.MAIL_FROM_EMAIL || 'receipts@posapp.com'}>`,
    to: testEmail,
    subject: 'POS System - Test Email',
    html: '<h2>Test Email</h2><p>Your email integration is working correctly.</p>',
  });
}
