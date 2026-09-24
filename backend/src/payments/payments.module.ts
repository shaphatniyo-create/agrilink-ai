import { forwardRef, Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { MockPaymentAdapter } from './adapters/mock.adapter';
import { MtnMomoAdapter } from './adapters/mtn-momo.adapter';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [forwardRef(() => SubscriptionsModule)],
  providers: [PaymentsService, MockPaymentAdapter, MtnMomoAdapter],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
