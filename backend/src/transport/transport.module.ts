import { Module } from '@nestjs/common';
import { TransportService } from './transport.service';
import { TransportController } from './transport.controller';
import { CommissionsModule } from '../commissions/commissions.module';

@Module({
  imports: [CommissionsModule],
  providers: [TransportService],
  controllers: [TransportController],
  exports: [TransportService],
})
export class TransportModule {}
