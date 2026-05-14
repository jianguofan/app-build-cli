import { Entity, Column, PrimaryColumn } from 'typeorm';
import { BuildOptionValue } from '../models';

@Entity('build_option_groups')
export class BuildOptionGroupEntity {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  key: string;

  @Column()
  label: string;

  @Column({ type: 'jsonb' })
  values: BuildOptionValue[];

  @Column()
  required: boolean;

  @Column({ name: 'is_standard' })
  isStandard: boolean;

  @Column({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at' })
  updatedAt: Date;
}
