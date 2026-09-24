import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuditModule } from './audit/audit.module';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GeoModule } from './geo/geo.module';
import { CropsModule } from './crops/crops.module';
import { FarmsModule } from './farms/farms.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { InputsModule } from './inputs/inputs.module';
import { TransportModule } from './transport/transport.module';
import { PaymentsModule } from './payments/payments.module';
import { CommissionsModule } from './commissions/commissions.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AdvertisingModule } from './advertising/advertising.module';
import { CommunicationModule } from './communication/communication.module';
import { FinanceModule } from './finance/finance.module';
import { OrgChartModule } from './orgchart/orgchart.module';
import { AdminModule } from './admin/admin.module';
import { EmailModule } from './email/email.module';
import { FarmFinanceModule } from './farm-finance/farm-finance.module';
import { AiAdvisoryModule } from './ai-advisory/ai-advisory.module';
import { IotModule } from './iot/iot.module';
import { SoilIntelModule } from './soil-intel/soil-intel.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    CommonModule,
    AuditModule,

    AuthModule,
    UsersModule,
    GeoModule,
    CropsModule,
    FarmsModule,
    CommissionsModule,
    MarketplaceModule,
    InputsModule,
    TransportModule,
    PaymentsModule,
    SubscriptionsModule,
    AdvertisingModule,
    CommunicationModule,
    FinanceModule,
    OrgChartModule,
    EmailModule,
    AdminModule,
    FarmFinanceModule,
    AiAdvisoryModule,
    IotModule,
    SoilIntelModule,
  ],
  controllers: [AppController],
  providers: [
    // Global throttling (basic API abuse protection).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Every route requires a valid JWT unless annotated @Public(); RolesGuard
    // then enforces @Roles(...) where present. Both run on every request --
    // RBAC is enforced here at the API layer, never left to the frontend.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
