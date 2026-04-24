import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('revoked_tokens')
@Index('idx_revoked_tokens_expires_at', ['expires_at'])
export class RevokedToken {
  @PrimaryColumn({ type: 'text' })
  token!: string;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @CreateDateColumn()
  created_at!: Date;
}
