import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('publish_records')
export class PublishRecordEntity {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'build_id' })
  buildId: string;

  @Column()
  platform: string;

  @Column()
  status: string;

  @Column({ nullable: true, name: 'download_url' })
  downloadUrl: string;

  @Column({ nullable: true, name: 'review_url' })
  reviewUrl: string;

  @Column({ nullable: true })
  error: string;

  @Column({ nullable: true, name: 'published_at' })
  publishedAt: Date;
}
