import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('refresh_tokens')
@Index('idx_refresh_tokens_credential_id', ['credential_id'])
@Index('idx_refresh_tokens_expires_at', ['expires_at'])
export class RefreshToken {
  @PrimaryColumn()
  token!: string;

  @Column({ type: 'uuid' })
  credential_id!: string;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @CreateDateColumn()
  created_at!: Date;
}
