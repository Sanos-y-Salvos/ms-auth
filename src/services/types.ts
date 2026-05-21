// Tipos de eventos que ms-users emite hacia ms-auth vía Bull/Redis.
// Deben mantenerse sincronizados con ms-users/src/events/event-emitter.service.ts

export interface UserRegisteredPayload {
  event: 'user.registered';
  userId: string;
  email: string;
  passwordHash: string;
  role: string;
  permissions: string[];
  name: string;
  avatarUrl?: string;
  tipo: 'ciudadano' | 'institucion';
  telefono: string;
  region: string;
  comuna: string;
  // Ciudadano
  primer_nombre?: string;
  segundo_nombre?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  run?: string;
  direccion?: string;
  // Institución
  razon_social?: string;
  rut?: string;
  tipo_institucion?: string;
  timestamp: Date;
}

export interface UserUpdatedPayload {
  event: 'user.updated';
  userId: string;
  email?: string;
  role?: string;
  permissions?: string[];
  name?: string;
  avatarUrl?: string;
  status?: 'active' | 'inactive';
  telefono?: string;
  region?: string;
  comuna?: string;
  primer_nombre?: string;
  segundo_nombre?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  direccion?: string;
  razon_social?: string;
  timestamp: Date;
}

export interface UserDeletedPayload {
  event: 'user.deleted';
  userId: string;
  timestamp: Date;
}

export interface UserPasswordChangedPayload {
  event: 'user.password.changed';
  userId: string;
  passwordHash: string;
  timestamp: Date;
}
