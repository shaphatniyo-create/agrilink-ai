import { Global, Module } from '@nestjs/common';
import { GeoScopeService } from './geo-scope.service';
import { RolesGuard } from './guards/roles.guard';
import { GeoScopeGuard } from './guards/geo-scope.guard';

@Global()
@Module({
  providers: [GeoScopeService, RolesGuard, GeoScopeGuard],
  exports: [GeoScopeService, RolesGuard, GeoScopeGuard],
})
export class CommonModule {}
