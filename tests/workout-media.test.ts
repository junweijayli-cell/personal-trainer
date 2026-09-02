import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWorkout } from '../app/workout-data';

const renderedVideos = [
  'squat.mp4',
  'incline-pushup.mp4',
  'reverse-lunge.mp4',
  'barbell-squat.mp4',
];

describe('movement guide videos', () => {
  it('connects rendered videos to bodyweight and barbell workouts', () => {
    const bodyweight = buildWorkout('full-body', []);
    const barbell = buildWorkout('legs', ['barbell']);

    expect(bodyweight.find((exercise) => exercise.id === 'squat')?.video).toContain('/exercises/videos/squat.mp4');
    expect(bodyweight.find((exercise) => exercise.id === 'incline-pushup')?.video).toContain('/exercises/videos/incline-pushup.mp4');
    expect(bodyweight.find((exercise) => exercise.id === 'reverse-lunge')?.video).toContain('/exercises/videos/reverse-lunge.mp4');
    expect(barbell.find((exercise) => exercise.id === 'barbell-squat')?.video).toContain('/exercises/videos/barbell-squat.mp4');
  });

  it.each(renderedVideos)('ships a non-empty %s file', (fileName) => {
    const path = resolve(process.cwd(), 'public', 'exercises', 'videos', fileName);
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(100_000);
  });

  it('keeps the photo guide when no video is available', () => {
    const birdDog = buildWorkout('back', []).find((exercise) => exercise.id === 'bird-dog');
    expect(birdDog?.video).toBeUndefined();
    expect(birdDog?.phases).toHaveLength(3);
  });
});
