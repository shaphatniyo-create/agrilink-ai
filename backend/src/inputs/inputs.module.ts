import { Module } from '@nestjs/common';
import { InputsService } from './inputs.service';
import { InputsController } from './inputs.controller';
import { CommissionsModule } from '../commissions/commissions.module';

@Module({
  imports: [CommissionsModule],
  providers: [InputsService],
  controllers: [InputsController],
  exports: [InputsService],
})
export class InputsModule {}
