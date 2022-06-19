
export function safeObjectKeys<T extends Record<string, unknown>>(o: T): (keyof T)[] {
	return Object.keys(o);
}
