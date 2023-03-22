import moment from "moment-timezone";
import config from '../config.json';

export function formatDate(date: Date) {
	return moment.tz(date, config.timezone).format("YYYY-MM-DD");
}

export function formatTime(date: Date) {
	return moment.tz(date, config.timezone).format("HH:mm");
}
