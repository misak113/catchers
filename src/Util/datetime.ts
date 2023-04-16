import moment from "moment-timezone";
import config from '../config.json';

export function formatDate(date: Date) {
	return moment.tz(date, config.timezone).format("YYYY-MM-DD");
}

export function formatTime(date: Date) {
	return moment.tz(date, config.timezone).format("HH:mm");
}

export function formatDateHumanized(date: Date) {
	return moment.tz(date, config.timezone).format('LL');
}

export function formatWeekdayHumanized(date: Date) {
	return moment.tz(date, config.timezone).format('ddd');
}

export function formatTimeHumanized(date: Date) {
	return moment.tz(date, config.timezone).format('LT');
}

export function formatDateTimeHumanized(date: Date) {
	return `${formatDateHumanized(date)}, ${formatWeekdayHumanized(date)} - ${formatTimeHumanized(date)}`;
}
