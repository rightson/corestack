import { db } from '@/lib/db';

export async function createContext() {
  return {
    db,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
