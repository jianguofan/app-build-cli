import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageService } from './storage.service';
import {
  BuildTaskEntity,
  PublishRecordEntity,
  BuildOptionGroupEntity,
  PublishingCredentialEntity,
} from './entities';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      BuildTaskEntity,
      PublishRecordEntity,
      BuildOptionGroupEntity,
      PublishingCredentialEntity,
    ]),
  ],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
