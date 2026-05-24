import { singularize } from '../src/utils/singularize';

describe('singularize', () => {
    it('removes trailing -s', () => {
        expect(singularize('pets')).toBe('pet');
        expect(singularize('users')).toBe('user');
    });

    it('converts -ies to -y', () => {
        expect(singularize('categories')).toBe('category');
        expect(singularize('queries')).toBe('query');
    });

    it('strips -es for sibilant endings', () => {
        expect(singularize('boxes')).toBe('box');
        expect(singularize('quizzes')).toBe('quizz'); // naive: -zes -> drop 2
        expect(singularize('classes')).toBe('class');
    });

    it('preserves words ending in -ss', () => {
        expect(singularize('class')).toBe('class');
        expect(singularize('boss')).toBe('boss');
    });

    it('preserves words ending in -us', () => {
        expect(singularize('status')).toBe('status');
        expect(singularize('bus')).toBe('bus');
    });

    it('leaves short words untouched', () => {
        expect(singularize('as')).toBe('as');
        expect(singularize('us')).toBe('us');
    });

    it('leaves non-plural words untouched', () => {
        expect(singularize('data')).toBe('data');
        expect(singularize('media')).toBe('media');
    });
});
