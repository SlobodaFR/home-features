import { InitialSchema1794500000000 } from './1794500000000-InitialSchema';
import { ApiKeyEnvironment1794600000000 } from './1794600000000-ApiKeyEnvironment';

/**
 * Migrations, in order. Listed as classes (no glob) so src/*.ts and dist/*.js cannot diverge.
 * Every entity change needs a new migration here: the migrations spec fails otherwise.
 */
export const MIGRATIONS = [
  InitialSchema1794500000000,
  ApiKeyEnvironment1794600000000,
];
