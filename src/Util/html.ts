
export function stripHtmlEntities(html: string) {
	return html.replace(/<[^>]*>?/gm, '');
}
