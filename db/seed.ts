import { db } from './client';
import { categories, settings } from './schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_CATEGORIES } from '@/constants/defaultCategories';

export async function seedDatabase() {
  // Seed default categories if none exist
  const existingCategories = await db.select().from(categories).limit(1);
  if (existingCategories.length === 0) {
    await db.insert(categories).values(DEFAULT_CATEGORIES);
  }

  // Seed settings singleton if not present
  const existingSettings = await db.select().from(settings).where(eq(settings.id, 1));
  if (existingSettings.length === 0) {
    await db.insert(settings).values({ id: 1 });
  }
}
