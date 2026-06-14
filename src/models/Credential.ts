// Decoradores de TypeORM para mapear esta clase a la tabla "credentials"
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Estructura de los datos de perfil cacheados directamente en la fila
// de la credencial (para evitar tener que consultar ms-users en cada login)
export interface CachedUserData {
  name: string;
  avatarUrl?: string;
  tipo?: 'ciudadano' | 'institucion';
  lastUpdated: Date;
}

// Entidad principal: réplica de credenciales sincronizada desde ms-users
@Entity('credentials')
export class Credential {
  // UUID generado por la BD (puede ser sobrescrito al consumir user.registered)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Email único por credencial (login)
  @Column({ unique: true })
  email!: string;

  // Hash bcrypt de la contraseña (nunca la contraseña en claro)
  @Column()
  password_hash!: string;

  // Rol del usuario (ciudadano, veterinaria, moderador, etc.)
  @Column({ default: 'ciudadano' })
  role!: string;

  // Array de permisos replicado desde ms-users vía eventos
  @Column({ type: 'simple-array', nullable: true, default: null })
  permissions!: string[] | null;

  // Datos de perfil cacheados para evitar consultas a ms-users
  @Column({ type: 'jsonb', nullable: true, default: null })
  cached_data!: CachedUserData | null;

  // Estado sincronizado desde ms-users. Fuente de verdad para bloqueos.
  @Column({ default: 'active' })
  status!: 'active' | 'inactive';

  // Flag operacional local (se baja en desactivación y en user.deleted)
  @Column({ default: true })
  is_active!: boolean;

  // Timestamps automáticos administrados por TypeORM
  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
