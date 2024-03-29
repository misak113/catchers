import moment from 'moment-timezone';
import { IMatch } from "./collections";
import { DEFAULT_CURRENCY_CODE } from "./settleUpFacade";
import config from '../config.json';

export interface IFineDefinition {
	label: string;
	detail: string;
	amount: number;
	currencyCode: string;
}

export const UNRESPONDED_LATE_FINE: IFineDefinition = {
	label: 'Pozdní vyjádření se k účasti',
	detail: '3 dny před zápasem',
	amount: 50,
	currencyCode: DEFAULT_CURRENCY_CODE,
};

export const FINES: IFineDefinition[] = [
	{
		label: 'Pozdní příchod na zápas',
		detail: 'do výkopu, bez omluvy',
		amount: 50,
		currencyCode: DEFAULT_CURRENCY_CODE,
	},
	UNRESPONDED_LATE_FINE,
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
	return moment.tz(match?.startsAt, config.timezone).format('D.M.Y');
}
