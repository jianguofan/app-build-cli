import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('publishing_credentials')
export class PublishingCredentialEntity {
  @PrimaryColumn()
  platform: string;

  @Column()
  enabled: boolean;

  @Column({ type: 'jsonb' })
  credentials: Record<string, string>;

  @Column({ name: 'updated_at' })
  updatedAt: Date;
}
