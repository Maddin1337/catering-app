import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, toAppError } from '@/lib/errors';
import { dishCost, packageCost, type Cost } from '@/lib/costing';
import { supabase } from '@/lib/supabase';

import { useMembership } from '../company/api';
import type {
  Dish,
  DishIngredientLine,
  DishPrice,
  Ingredient,
  IngredientPrice,
  MenuPackage,
  PackageDishLine,
  PackagePrice,
} from './types';

// Einziger Ort für Supabase-Aufrufe des Katalogs (docs/05 §3.2).
// Preise stehen nur in den Basistabellen und gehen nur an admin (docs/03 §4.3); alle Rollen lesen die
// preisfreien Views kitchen_*.

function client() {
  if (!supabase) throw new AppError('not_configured');
  return supabase;
}

function useCatalogScope() {
  const m = useMembership().data;
  const role = m?.role;
  return {
    companyId: m?.company_id,
    isAdmin: role === 'admin',
    enabled: !!m && (role === 'admin' || role === 'kitchen'),
  };
}

export function useDishes() {
  const { companyId, enabled } = useCatalogScope();
  return useQuery({
    queryKey: ['catalog', 'dishes', companyId],
    enabled,
    queryFn: async (): Promise<Dish[]> => {
      const { data, error } = await client()
        .from('kitchen_dishes')
        .select(
          'id, name, description, category, portion_label, diets, allergens, allergens_reviewed_at, allergens_reviewed_by, archived_at',
        )
        .order('name');
      if (error) throw toAppError(error);
      return (data ?? []) as Dish[];
    },
  });
}

export function useDishPrices() {
  const { companyId, isAdmin } = useCatalogScope();
  return useQuery({
    queryKey: ['catalog', 'dish-prices', companyId],
    enabled: isAdmin,
    queryFn: async (): Promise<DishPrice[]> => {
      const { data, error } = await client()
        .from('dishes')
        .select('id, price_cents, tax_rate_id, markup_bp');
      if (error) throw toAppError(error);
      return (data ?? []) as DishPrice[];
    },
  });
}

export function useIngredients() {
  const { companyId, enabled } = useCatalogScope();
  return useQuery({
    queryKey: ['catalog', 'ingredients', companyId],
    enabled,
    queryFn: async (): Promise<Ingredient[]> => {
      const { data, error } = await client()
        .from('kitchen_ingredients')
        .select('id, name, unit, product_group, archived_at')
        .order('name');
      if (error) throw toAppError(error);
      return (data ?? []) as Ingredient[];
    },
  });
}

export function useIngredientPrices() {
  const { companyId, isAdmin } = useCatalogScope();
  return useQuery({
    queryKey: ['catalog', 'ingredient-prices', companyId],
    enabled: isAdmin,
    queryFn: async (): Promise<IngredientPrice[]> => {
      const { data, error } = await client().from('ingredients').select('id, price_cents');
      if (error) throw toAppError(error);
      return (data ?? []) as IngredientPrice[];
    },
  });
}

/** Alle Zutatenzeilen aller Gerichte (preisfrei; Menge in der Basiseinheit). */
export function useDishIngredientLines() {
  const { companyId, enabled } = useCatalogScope();
  return useQuery({
    queryKey: ['catalog', 'dish-ingredients', companyId],
    enabled,
    queryFn: async (): Promise<DishIngredientLine[]> => {
      const { data, error } = await client()
        .from('dish_ingredients')
        .select('dish_id, ingredient_id, quantity_per_person')
        .order('sort_order');
      if (error) throw toAppError(error);
      return (data ?? []).map((r) => ({
        dish_id: r.dish_id as string,
        ingredient_id: r.ingredient_id as string,
        quantity_per_person: Number(r.quantity_per_person),
      }));
    },
  });
}

export function usePackages() {
  const { companyId, enabled } = useCatalogScope();
  return useQuery({
    queryKey: ['catalog', 'packages', companyId],
    enabled,
    queryFn: async (): Promise<MenuPackage[]> => {
      const { data, error } = await client()
        .from('kitchen_menu_packages')
        .select('id, name, description, archived_at, dish_count, allergens, diets')
        .order('name');
      if (error) throw toAppError(error);
      return (data ?? []) as MenuPackage[];
    },
  });
}

export function usePackagePrices() {
  const { companyId, isAdmin } = useCatalogScope();
  return useQuery({
    queryKey: ['catalog', 'package-prices', companyId],
    enabled: isAdmin,
    queryFn: async (): Promise<PackagePrice[]> => {
      const { data, error } = await client()
        .from('menu_packages')
        .select('id, price_per_person_cents, tax_rate_id, markup_bp');
      if (error) throw toAppError(error);
      return (data ?? []) as PackagePrice[];
    },
  });
}

export function usePackageDishLines() {
  const { companyId, enabled } = useCatalogScope();
  return useQuery({
    queryKey: ['catalog', 'package-dishes', companyId],
    enabled,
    queryFn: async (): Promise<PackageDishLine[]> => {
      const { data, error } = await client()
        .from('menu_package_dishes')
        .select('menu_package_id, dish_id, portion_factor, sort_order')
        .order('sort_order');
      if (error) throw toAppError(error);
      return (data ?? []).map((r) => ({
        menu_package_id: r.menu_package_id as string,
        dish_id: r.dish_id as string,
        portion_factor: Number(r.portion_factor),
        sort_order: r.sort_order as number,
      }));
    },
  });
}

/**
 * Wareneinsatz je Person für jedes Gericht (nur admin, sonst leer). Zutaten ohne Preis machen das
 * Gericht „unvollständig“.
 */
export function useDishCosts(): Map<string, Cost> {
  const lines = useDishIngredientLines().data;
  const ingredients = useIngredients().data;
  const prices = useIngredientPrices().data;
  const costs = new Map<string, Cost>();
  if (!lines || !ingredients || !prices) return costs;
  const unit = new Map(ingredients.map((i) => [i.id, i.unit]));
  const price = new Map(prices.map((p) => [p.id, p.price_cents]));
  const byDish = new Map<string, DishIngredientLine[]>();
  for (const l of lines) byDish.set(l.dish_id, [...(byDish.get(l.dish_id) ?? []), l]);
  for (const [dishId, dl] of byDish) {
    costs.set(
      dishId,
      dishCost(
        dl.map((l) => ({
          quantityHundredths: Math.round(l.quantity_per_person * 100),
          unit: unit.get(l.ingredient_id) ?? 'g',
          priceCents: price.get(l.ingredient_id) ?? null,
        })),
      ),
    );
  }
  return costs;
}

/** Wareneinsatz je Person für ein Paket aus den Gerichtskosten und Portionsfaktoren. */
export function packageCostFor(
  lines: { dishId: string; factor: number }[],
  dishCosts: Map<string, Cost>,
): Cost {
  return packageCost(
    lines.map((l) => ({
      cost: dishCosts.get(l.dishId) ?? { micro: 0, complete: false },
      factorHundredths: Math.round(l.factor * 100),
    })),
  );
}

async function rpc<T>(name: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(name, { p: payload });
  if (error) throw toAppError(error);
  return data as T;
}

function useCatalogMutation<V>(fn: (v: V) => Promise<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog'] }),
  });
}

export const useSaveDish = () =>
  useCatalogMutation((payload: Record<string, unknown>) => rpc<string>('save_dish', payload));
export const useSaveIngredient = () =>
  useCatalogMutation((payload: Record<string, unknown>) => rpc<string>('save_ingredient', payload));
export const useSaveMenuPackage = () =>
  useCatalogMutation((payload: Record<string, unknown>) =>
    rpc<string>('save_menu_package', payload),
  );
