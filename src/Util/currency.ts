import { composeIBAN } from 'ibantools';

export const CurrencyMap: { [currencyCode: string]: string } = {
	CZK: 'Kč',
	EUR: '€',
	USD: '$',
};

type AmountOptions = {
	amount: string | number;
	decimals?: number;
};

type CurrencyAmountOptions = AmountOptions & {
	currencyCode: string;
};

export function formatCurrencyAmount({ amount, decimals = 0 }: AmountOptions): string {
	return parseFloat(`${amount}`).toFixed(decimals);
}

export function formatCurrencyAmountHumanized({ amount, currencyCode, decimals = 0 }: CurrencyAmountOptions): string {
	const humanizedCurrency = CurrencyMap[currencyCode] ?? currencyCode;
	return `${formatCurrencyAmount({ amount, decimals })} ${humanizedCurrency}`;
}

export function toIBAN(bankAccount: string): string | null {
	const bankAccountWithoutSpaces = bankAccount.replace(/\s+/g, '');
	const matches = bankAccountWithoutSpaces.match(/^((\d{2,6})-)?(\d{2,10})\/(\d{4,4})$/);
	if (!matches) {
		return null;
	}

	const [, , prefix, accountNumber, bankCode] = matches;
	const bban = `${bankCode}${(prefix ?? '').padStart(6, '0')}${accountNumber.padStart(10, '0')}`;
	const iban = composeIBAN({
		countryCode: 'CZ',
		bban,
	});
	return iban;
}

export function generateQrCode({ bankAccount, amount, name }: { bankAccount: string; name: string; amount: number; }) {
	try {
		const iban = toIBAN(bankAccount);
		if (!iban) {
			return null;
		}
		const amountRounded = formatCurrencyAmount({ amount, decimals: 2 });
		const spdQrCode = `SPD*1.0*ACC:${iban}*AM:${amountRounded}*CC:CZK`;
		return spdQrCode;
	} catch (error) {
		console.warn('Error generating QR code', error);
		return null;
	}
}
