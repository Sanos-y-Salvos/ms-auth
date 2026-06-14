// Decoradores de TypeORM para mapear a la tabla "refresh_tokens"
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

// Tabla de refresh tokens activos. Cada login emite uno; cada refresh lo rota.
// Índices por credential_id (para contar sesiones activas) y por expires_at
// (para limpieza eficiente de tokens vencidos).
@Entity('refresh_tokens')
@Index('idx_refresh_tokens_credential_id', ['credential_id'])
@Index('idx_refresh_tokens_expires_at', ['expires_at'])
export class RefreshToken {
  // El token (UUID) actúa como clave primaria
  @PrimaryColumn()
  token!: string;

  // FK lógica al credential dueño del token (sin constraint para mantener
  // independencia operativa con la tabla credentials)
  @Column({ type: 'uuid' })
  credential_id!: string;

  // Fecha de expiración con zona horaria (usada por refreshSession para
  // validar vigencia)
  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  // Fecha de emisión, útil para descartar los más antiguos cuando se
  // alcanza el límite de sesiones por usuario
  @CreateDateColumn()
  created_at!: Date;
}
