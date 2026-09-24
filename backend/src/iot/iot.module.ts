import { Module } from '@nestjs/common';
import { IotService } from './iot.service';
import { IotController } from './iot.controller';
import { FarmsModule } from '../farms/farms.module';

@Module({
  imports: [FarmsModule],
  providers: [IotService],
  controllers: [IotController],
})
export class IotModule {}
