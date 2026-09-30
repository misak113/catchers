// @ts-nocheck
import { omitUndefinedDeep } from './object';

describe('omitUndefinedDeep', () => {
	it('removes undefined values recursively and preserves arrays', () => {
		expect(omitUndefinedDeep({
			top: 'value',
			skip: undefined,
			nested: {
				keep: 1,
				skip: undefined,
				deeper: {
					keep: true,
					skip: undefined,
				},
			},
			list: [
				{
					keep: 'a',
					skip: undefined,
				},
				'raw',
			],
		})).toEqual({
			top: 'value',
			nested: {
				keep: 1,
				deeper: {
					keep: true,
				},
			},
			list: [
				{
					keep: 'a',
				},
				'raw',
			],
		});
	});
});
