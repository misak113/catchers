
export function safeObjectKeys<T extends Record<string, unknown>>(o: T): (keyof T)[] {
	return Object.keys(o);
}

export function omitUndefinedDeep<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((item) => omitUndefinedDeep(item)) as T;
	}
	if (value instanceof Date) {
		return value;
	}
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([, entryValue]) => entryValue !== undefined)
				.map(([key, entryValue]) => [key, omitUndefinedDeep(entryValue)])
		) as T;
	}
	return value;
}
