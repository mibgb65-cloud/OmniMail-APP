import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { getProviderIcon } from './ProviderSelection';

it('LINUX DO 使用官网公开的透明 SVG，不含方形底色、外部资源或脚本', () => {
  expect(getProviderIcon('linuxdo')).toBe('/providers/linuxdo.svg');
  const source = readFileSync(resolve('public/providers/linuxdo.svg'), 'utf-8');
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  expect(document.querySelector('parsererror')).toBeNull();
  const svg = document.documentElement;
  expect(svg.getAttribute('viewBox')).toBe('0 0 120 120');
  expect(svg.querySelectorAll('circle')).toHaveLength(2);
  expect(svg.querySelector('clipPath circle')?.getAttribute('r')).toBe('47');
  expect(svg.querySelector(':scope > circle')?.getAttribute('r')).toBe('50');
  const bands = [...svg.querySelectorAll('rect')];
  expect(bands.map((band) => band.getAttribute('fill'))).toEqual(['#1c1c1e', '#f0f0f0', '#ffb003']);
  expect(bands.every((band) => band.getAttribute('clip-path') === 'url(#a)')).toBe(true);
  expect(svg.querySelector('script, foreignObject, image, use')).toBeNull();
  for (const element of [svg, ...svg.querySelectorAll('*')]) {
    for (const attribute of element.attributes) {
      expect(attribute.name.toLowerCase().startsWith('on')).toBe(false);
      expect(['href', 'xlink:href', 'style'].includes(attribute.name)).toBe(false);
    }
  }
});
