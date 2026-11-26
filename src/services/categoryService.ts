import { BASE_CATEGORIES, defaultColorFor } from "@/domain/categoryColors";
import { prisma } from "@/lib/db";

/** Categorías del usuario: crea las predeterminadas si no tiene ninguna y asigna color a las que no lo tengan. */
export async function listCategories(userId: string) {
  if ((await prisma.category.count({ where: { userId } })) === 0)
    for (const c of BASE_CATEGORIES)
      await prisma.category.upsert({ where: { userId_name: { userId, name: c.name } }, update: {}, create: { ...c, userId } });

  for (const c of await prisma.category.findMany({ where: { userId, color: null } }))
    await prisma.category.update({ where: { id: c.id }, data: { color: defaultColorFor(c.name) } });

  return prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } });
}

/** Añade a cada elemento el `color` de su categoría (se relaciona por nombre; "Sin categoría" usa el color por defecto). */
export async function withCategoryColor<T extends { category: string }>(userId: string, items: T[]) {
  const categories = await prisma.category.findMany({ where: { userId }, select: { name: true, color: true } });
  const colors = new Map(categories.map((c) => [c.name, c.color]));
  return items.map((item) => ({ ...item, color: colors.get(item.category) ?? defaultColorFor(item.category) }));
}
