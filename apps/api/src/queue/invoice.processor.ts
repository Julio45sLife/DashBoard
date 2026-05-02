import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../database/prisma.service';
import { JOBS, QUEUES } from './queue.constants';
import { InvoiceStatus, InvoiceType } from '@prisma/client';

interface GeneratePdfPayload {
  invoiceId: string;
  tenantId: string;
}

@Processor(QUEUES.INVOICE)
export class InvoiceProcessor {
  private readonly logger = new Logger(InvoiceProcessor.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue(QUEUES.INVOICE) private invoiceQueue: Queue,
  ) {}

  @Process(JOBS.GENERATE_INVOICE_PDF)
  async generatePdf(job: Job<GeneratePdfPayload>) {
    const { invoiceId, tenantId } = job.data;

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        contact: true,
        lineItems: { orderBy: { position: 'asc' } },
        tenant: true,
      },
    });

    if (!invoice) {
      this.logger.warn(`Invoice ${invoiceId} not found for PDF generation`);
      return;
    }

    const pdf = await this.buildPdf(invoice);

    // In production: upload to S3 via @aws-sdk/client-s3
    // For now: store base64 reference and log
    const pdfBase64 = pdf.toString('base64');
    const pdfUrl = `data:application/pdf;base64,${pdfBase64.substring(0, 50)}...`; // placeholder

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdfGeneratedAt: new Date(), pdfUrl },
    });

    this.logger.log(`PDF generated for invoice ${invoice.number}`);
  }

  @Cron('0 2 * * *') // every day at 2am
  async markOverdueInvoices() {
    const now = new Date();

    const result = await this.prisma.invoice.updateMany({
      where: {
        type: InvoiceType.INVOICE,
        status: InvoiceStatus.SENT,
        dueAt: { lt: now },
      },
      data: { status: InvoiceStatus.OVERDUE },
    });

    if (result.count > 0) {
      this.logger.log(`Marked ${result.count} invoice(s) as OVERDUE`);
    }
  }

  private async buildPdf(invoice: {
    number: string;
    issuedAt: Date;
    dueAt: Date | null;
    totalCents: number;
    subtotalCents: number;
    taxCents: number;
    taxRate: number;
    currency: string;
    notes: string | null;
    contact: { companyName: string | null; firstName: string | null; lastName: string | null; address: string | null; city: string | null; postalCode: string | null } | null;
    lineItems: { description: string; quantity: number; unitPriceCents: number; totalCents: number }[];
    tenant: { name: string; address: string | null; siren: string | null; vatNumber: string | null };
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text(invoice.tenant.name, 50, 50);
      doc.fontSize(9).font('Helvetica').fillColor('#666')
        .text(invoice.tenant.address ?? '', 50, 75)
        .text(`SIREN: ${invoice.tenant.siren ?? 'N/A'}`, 50, 87);

      // Invoice title
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a56db')
        .text(`FACTURE N° ${invoice.number}`, 350, 50);
      doc.fontSize(9).font('Helvetica').fillColor('#333')
        .text(`Date: ${invoice.issuedAt.toLocaleDateString('fr-FR')}`, 350, 72)
        .text(`Échéance: ${invoice.dueAt?.toLocaleDateString('fr-FR') ?? 'À réception'}`, 350, 84);

      // Client
      if (invoice.contact) {
        doc.moveTo(50, 120).lineTo(545, 120).strokeColor('#e5e7eb').stroke();
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#333').text('FACTURÉ À:', 50, 130);
        doc.fontSize(9).font('Helvetica')
          .text(invoice.contact.companyName ?? `${invoice.contact.firstName} ${invoice.contact.lastName}`, 50, 145)
          .text(`${invoice.contact.postalCode ?? ''} ${invoice.contact.city ?? ''}`, 50, 157);
      }

      // Table header
      const tableTop = 200;
      doc.rect(50, tableTop, 495, 20).fill('#f3f4f6');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151')
        .text('DESCRIPTION', 55, tableTop + 6)
        .text('QTÉ', 330, tableTop + 6)
        .text('P.U. HT', 380, tableTop + 6)
        .text('TOTAL HT', 445, tableTop + 6);

      let y = tableTop + 25;
      for (const item of invoice.lineItems) {
        doc.fontSize(8).font('Helvetica').fillColor('#374151')
          .text(item.description, 55, y, { width: 265 })
          .text(item.quantity.toString(), 330, y)
          .text(`${(item.unitPriceCents / 100).toFixed(2)} €`, 380, y)
          .text(`${(item.totalCents / 100 / (1 + invoice.taxRate / 100)).toFixed(2)} €`, 445, y);
        y += 20;
      }

      // Totals
      y += 10;
      doc.moveTo(350, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();
      y += 8;
      doc.fontSize(9).font('Helvetica')
        .text('Sous-total HT:', 350, y).text(`${(invoice.subtotalCents / 100).toFixed(2)} €`, 480, y);
      y += 14;
      doc.text(`TVA (${invoice.taxRate}%):`, 350, y).text(`${(invoice.taxCents / 100).toFixed(2)} €`, 480, y);
      y += 14;
      doc.font('Helvetica-Bold').fontSize(11)
        .text('TOTAL TTC:', 350, y).text(`${(invoice.totalCents / 100).toFixed(2)} €`, 480, y);

      if (invoice.notes) {
        y += 40;
        doc.fontSize(8).font('Helvetica').fillColor('#666').text(`Notes: ${invoice.notes}`, 50, y);
      }

      doc.end();
    });
  }
}
