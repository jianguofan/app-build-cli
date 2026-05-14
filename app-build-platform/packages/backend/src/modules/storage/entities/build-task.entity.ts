import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity('build_tasks')
export class BuildTaskEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  platform: string;

  @Column()
  flavor: string;

  @Column({ name: 'build_mode' })
  buildMode: string;

  @Column()
  env: string;

  @Column()
  branch: string;

  @Column({ nullable: true })
  language: string;

  @Column({ nullable: true })
  region: string;

  @Column({ nullable: true, name: 'pgyer_account_type' })
  pgyerAccountType: string;

  @Column({ nullable: true, name: 'custom_params', type: 'jsonb' })
  customParams: Record<string, string>;

  @Column({ nullable: true, name: 'publish_targets', type: 'jsonb' })
  publishTargets: string[];

  @Column({ nullable: true, name: 'commit_id' })
  commitId: string;

  @Column({ nullable: true, name: 'bundle_id' })
  bundleId: string;

  @Column()
  status: string;

  @Column({ nullable: true, type: 'jsonb' })
  artifacts: { ipa?: string; apk?: string };

  @Column({ nullable: true, name: 'log_file' })
  logFile: string;

  @Column({ nullable: true })
  error: string;

  @Column({ name: 'created_at' })
  createdAt: Date;

  @Column({ nullable: true, name: 'started_at' })
  startedAt: Date;

  @Column({ nullable: true, name: 'completed_at' })
  completedAt: Date;

  @Column({ nullable: true })
  duration: number;
}
