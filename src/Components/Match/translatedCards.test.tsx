import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import FieldCard from './FieldCard';
import TournamentCard from './TournamentCard';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });

function translateTextNodes(container: HTMLElement) {
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
	const textNodes: Node[] = [];
	while (walker.nextNode()) {
		textNodes.push(walker.currentNode);
	}
	for (const text of textNodes) {
		if (!text.textContent?.trim()) {
			continue;
		}
		const wrapper = document.createElement('font');
		const translated = document.createElement('font');
		translated.textContent = text.textContent;
		wrapper.appendChild(translated);
		text.parentNode?.replaceChild(wrapper, text);
	}
}

describe('translated match cards', () => {
	let root: Root;
	let container: HTMLDivElement;
	let errors: unknown[];

	beforeEach(() => {
		container = document.createElement('div');
		errors = [];
		root = createRoot(container, { onUncaughtError: error => errors.push(error) });
	});

	afterEach(async () => {
		await act(async () => root.unmount());
	});

	it('loads and clears a field after translation replaces its text nodes', async () => {
		await act(async () => root.render(<FieldCard field={undefined} />));
		translateTextNodes(container);
		await act(async () => root.render(<FieldCard field="TEST" />));
		expect(container.querySelector('a')?.textContent).toContain('TEST');
		translateTextNodes(container);
		await act(async () => root.render(<FieldCard field={undefined} />));
		expect(container.textContent).toContain('Neuvedeno');
		expect(errors).toEqual([]);
	});

	it('loads and clears a tournament and group after translation replaces their text nodes', async () => {
		await act(async () => root.render(<TournamentCard tournament={undefined} group={undefined} />));
		translateTextNodes(container);
		await act(async () => root.render(<TournamentCard tournament="TEST" group="A" />));
		expect(container.querySelectorAll('a')).toHaveLength(2);
		translateTextNodes(container);
		await act(async () => root.render(<TournamentCard tournament={undefined} group={undefined} />));
		expect(container.textContent).toContain('Neuvedena');
		expect(errors).toEqual([]);
	});
});
