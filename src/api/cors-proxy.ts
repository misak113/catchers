import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = [
	'https://www.psmf.cz',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const url = req.query.url;

	if (!url || typeof url !== 'string') {
		res.status(400).json({ error: 'Missing url query parameter' });
		return;
	}

	// Validate that the URL is from an allowed origin
	const isAllowed = ALLOWED_ORIGINS.some((origin) => url.startsWith(origin));
	if (!isAllowed) {
		res.status(403).json({ error: 'URL origin not allowed' });
		return;
	}

	try {
		const response = await fetch(url, {
			method: req.method,
			headers: {
				'User-Agent': 'CatchersApp/1.0',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			},
		});

		const contentType = response.headers.get('content-type') ?? 'text/plain';
		const body = await response.text();

		// Set CORS headers to allow the frontend to access this endpoint
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		res.setHeader('Content-Type', contentType);

		res.status(response.status).send(body);
	} catch (error) {
		console.error('CORS proxy error:', error);
		res.status(500).json({ error: 'Failed to fetch the requested URL' });
	}
}
