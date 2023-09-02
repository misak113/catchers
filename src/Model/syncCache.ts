
class SyncCache {
	public getItem(key: string) {
		if (typeof localStorage === 'undefined') {
			return null;
		}
		return localStorage.getItem(key);
	}

	public setItem(key: string, value: string) {
		if (typeof localStorage === 'undefined') {
			return;
		}
		localStorage.setItem(key, value);
	}
}

export const syncCache = new SyncCache();
