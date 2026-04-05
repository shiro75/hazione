/**
 * utils/price.ts
 * Utilitaires de conversion de prix et calcul de marge.
 * Convention : la base de données stocke toujours les prix en HT.
 */

/** Convertit un prix HT en TTC */
export function htToTtc(priceHT: number, vatRate: number): number {
  return Math.round(priceHT * (1 + vatRate / 100) * 100) / 100;
}

/** Convertit un prix TTC en HT */
export function ttcToHt(priceTTC: number, vatRate: number): number {
  return Math.round((priceTTC / (1 + vatRate / 100)) * 100) / 100;
}

/** Calcule la marge en montant (HT) et en pourcentage */
export function calcMargin(
  purchasePriceHT: number,
  salePriceHT: number,
): { amount: number; percent: string } | null {
  if (purchasePriceHT <= 0 || salePriceHT <= 0) return null;
  const amount = salePriceHT - purchasePriceHT;
  const percent = ((1 - purchasePriceHT / salePriceHT) * 100).toFixed(1);
  return { amount, percent };
}