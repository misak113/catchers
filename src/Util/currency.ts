
export function formatCurrencyAmount(amount: string | number): string {
	return parseFloat(`${amount}`).toFixed(0);
}
