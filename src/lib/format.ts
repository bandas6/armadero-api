/** Pesos colombianos, enteros: "$ 1.850.000". Nunca usar float para dinero. */
export function formatCOP(value: number): string {
  return `$ ${Math.round(value).toLocaleString('es-CO')}`;
}
