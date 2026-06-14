// Decoradores de TypeORM para mapear a la tabla "revoked_tokens"
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

// Lista negra (blacklist) de access tokens JWT revocados antes de expirar.
// Consultada por verifyToken en cada request protegida.
// El índice por expires_at facilita la purga periódica de los ya vencidos.
@Entity('revoked_tokens')
@Index('idx_revoked_tokens_expires_at', ['expires_at'])
export class RevokedToken {
  // El propio JWT actúa como clave primaria (tipo text por su largo)
  @PrimaryColumn({ type: 'text' })
  token!: string;

  // Vencimiento original del JWT. Una vez pasada esta fecha, el registro
  // ya no aporta valor y puede eliminarse.
  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  // Cuándo se revocó el token (logout)
  @CreateDateColumn()
  created_at!: Date;
}
