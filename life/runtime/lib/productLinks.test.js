import { describe, expect, it } from 'vitest';
import { fallbackProductPreview, suggestShoppingList } from './productLinks.js';
const lists = [
    { id: '1', space_id: 's', created_by: 'u', name: 'Lingerie/Panties', created_at: '' },
    { id: '2', space_id: 's', created_by: 'u', name: 'Heels', created_at: '' },
];
describe('product list suggestions', () => {
    it('routes lingerie products', () => {
        const result = suggestShoppingList({ url: 'https://shop.test/lace-thong', title: 'Lace thong panty', category: 'Intimates', confidence: .9, source: 'edge' }, lists);
        expect(result.list?.name).toBe('Lingerie/Panties');
    });
    it('routes heels', () => {
        const result = suggestShoppingList({ url: 'https://shop.test/p/black-stiletto', title: 'Black stiletto platform heels', confidence: .9, source: 'edge' }, lists);
        expect(result.list?.name).toBe('Heels');
    });
    it('builds a useful fallback from a url slug', () => {
        expect(fallbackProductPreview('https://example.com/products/red-platform-heels').title).toContain('Red');
    });
});
