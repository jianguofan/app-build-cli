import { Module } from '@nestjs/common';
import { ExecutorService } from './executor.service';
import { WorkspaceService } from './workspace.service';

@Module({
  providers: [ExecutorService, WorkspaceService],
  exports: [ExecutorService, WorkspaceService],
})
export class ExecutorModule {}
