import moment from 'moment-timezone';
import { IMatch } from "./collections";
import { DEFAULT_CURRENCY_CODE } from "./settleUpFacade";

export interface IFineDefinition {
	label: string;
	detail: string;
	amount: number;
	currencyCode: string;
}

export const UNRESPONDED_LATE_FINE: IFineDefinition = {
	label: 'Pozdní vyjádření se k účasti',
	detail: '3 dny před zápasem',
	amount: 100,
	currencyCode: DEFAULT_CURRENCY_CODE,
};

export const FINES: IFineDefinition[] = [
	{
		label: 'Pozdní příchod na zápas',
		detail: 'do výkopu',
		amount: 50,
		currencyCode: DEFAULT_CURRENCY_CODE,
	},
	UNRESPONDED_LATE_FINE,
	{
		label: 'Nevyjádření se k účasti',
		detail: 'do výkopu',
		amount: 200,
		currencyCode: DEFAULT_CURRENCY_CODE,
	},
	{
		label: 'Nedostavení se na přijatý zápas',
		detail: 'bez omluvy',
		amount: 300,
		currencyCode: DEFAULT_CURRENCY_CODE,
	},
];

export const FINE_MEMBER_NAME = 'SC Catchers';

export function createFineTransactionPurpose(fine: IFineDefinition, match: IMatch | null) {
	return `${fine.label}: ${match?.opponent} ${formatMatchDateOnly(match)}`;
}

export function formatMatchDateOnly(match: IMatch | null) {
	return moment(match?.startsAt).format('D.M.Y');
}
