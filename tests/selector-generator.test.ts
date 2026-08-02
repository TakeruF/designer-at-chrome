import { beforeEach, describe, expect, it } from 'vitest';
import { generateCssSelector } from '../src/content/selector-generator';

describe('CSS selector generator', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('uses a unique id when available', () => {
    document.body.innerHTML = '<main><button id="save-design">Save</button></main>';
    const button = document.querySelector('button');
    expect(button && generateCssSelector(button)).toBe('#save-design');
  });

  it('uses nth-of-type to disambiguate siblings', () => {
    document.body.innerHTML = '<ul><li>One</li><li>Two</li><li>Three</li></ul>';
    const item = document.querySelectorAll('li')[1];
    expect(generateCssSelector(item)).toContain('li:nth-of-type(2)');
  });

  it('uses stable classes without relying on generated css hashes', () => {
    document.body.innerHTML =
      '<div><article class="card css-a1b2c3">A</article><article class="card css-c3d4e5 featured">B</article></div>';
    const featured = document.querySelector('.featured');
    expect(featured && generateCssSelector(featured)).toContain('article.card.featured');
    expect(featured && generateCssSelector(featured)).not.toContain('css-c3d4e5');
  });
});
