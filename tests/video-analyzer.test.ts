import { describe, expect, it } from 'vitest';
import { scoreVideoPlayerCandidate } from '../src/content/video-analyzer';

function rect(width: number, height: number): DOMRect {
  return new DOMRect(0, 0, width, height);
}

describe('video player range scoring', () => {
  it('prefers a nearby wrapper with playback, progress, time, and fullscreen controls', () => {
    const player = document.createElement('div');
    player.innerHTML = `
      <video></video>
      <button aria-label="Play"></button>
      <input type="range" />
      <span>01:24 / 04:32</span>
      <button aria-label="Fullscreen"></button>
    `;
    const video = player.querySelector('video');
    if (!video) throw new Error('Video fixture was not created.');
    video.getBoundingClientRect = () => rect(640, 360);
    player.getBoundingClientRect = () => rect(660, 400);
    expect(scoreVideoPlayerCandidate(player, video)).toBeGreaterThanOrEqual(7);
  });

  it('rejects a page-sized ancestor around a small video', () => {
    const page = document.createElement('main');
    const video = document.createElement('video');
    page.append(video);
    video.getBoundingClientRect = () => rect(320, 180);
    page.getBoundingClientRect = () => rect(1600, 1200);
    expect(scoreVideoPlayerCandidate(page, video)).toBe(-1);
  });
});
