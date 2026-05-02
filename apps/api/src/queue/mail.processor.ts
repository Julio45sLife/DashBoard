import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { JOBS, QUEUES } from './queue.constants';

interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface WelcomeEmailPayload {
  email: string;
  firstName: string;
  tenantName: string;
  loginUrl: string;
}

interface InvoiceEmailPayload {
  to: string;
  invoiceNumber: string;
  tenantName: string;
  totalFormatted: string;
  pdfUrl?: string;
}

@Processor(QUEUES.MAIL)
export class MailProcessor {
  private readonly logger = new Logger(MailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('email.host'),
      port: config.get<number>('email.port', 587),
      auth: {
        user: config.get<string>('email.user'),
        pass: config.get<string>('email.pass'),
      },
    });
  }

  @Process(JOBS.SEND_WELCOME_EMAIL)
  async sendWelcomeEmail(job: Job<WelcomeEmailPayload>) {
    const { email, firstName, tenantName, loginUrl } = job.data;

    await this.send({
      to: email,
      subject: `Bienvenue sur Vilar DS — ${tenantName}`,
      html: `
        <h1>Bienvenue, ${firstName} !</h1>
        <p>Votre compte <strong>${tenantName}</strong> est prêt.</p>
        <p><a href="${loginUrl}" style="background:#1a56db;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">
          Accéder au tableau de bord
        </a></p>
        <p>Votre période d'essai gratuite de 14 jours commence maintenant.</p>
      `,
    });
  }

  @Process(JOBS.SEND_INVOICE_EMAIL)
  async sendInvoiceEmail(job: Job<InvoiceEmailPayload>) {
    const { to, invoiceNumber, tenantName, totalFormatted, pdfUrl } = job.data;

    await this.send({
      to,
      subject: `Facture ${invoiceNumber} — ${tenantName}`,
      html: `
        <h2>Nouvelle facture : ${invoiceNumber}</h2>
        <p>Montant TTC : <strong>${totalFormatted}</strong></p>
        ${pdfUrl ? `<p><a href="${pdfUrl}">Télécharger la facture PDF</a></p>` : ''}
      `,
    });
  }

  @Process(JOBS.SEND_PASSWORD_RESET)
  async sendPasswordReset(job: Job<{ email: string; resetUrl: string }>) {
    const { email, resetUrl } = job.data;

    await this.send({
      to: email,
      subject: 'Réinitialisation de votre mot de passe — Vilar DS',
      html: `
        <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
        <p><a href="${resetUrl}">Réinitialiser mon mot de passe</a></p>
        <p>Ce lien expire dans 2 heures. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
      `,
    });
  }

  private async send(payload: SendEmailPayload): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('email.from'),
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      this.logger.log(`Email sent to ${payload.to}: ${payload.subject}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${payload.to}: ${(err as Error).message}`);
      throw err;
    }
  }
}
