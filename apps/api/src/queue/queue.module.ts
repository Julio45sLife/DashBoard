import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUES } from './queue.constants';
import { MailProcessor } from './mail.processor';
import { InvoiceProcessor } from './invoice.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.MAIL },
      { name: QUEUES.PDF },
      { name: QUEUES.INVOICE },
      { name: QUEUES.AUDIT },
    ),
  ],
  providers: [MailProcessor, InvoiceProcessor],
  exports: [BullModule],
})
export class QueueModule {}
