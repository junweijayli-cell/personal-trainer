import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWorkout, exerciseCatalog } from '../app/workout-data';
import videos from '../app/exercise-videos.json';
import approved from '../docs/approved-exercise-videos.json';

const renderedVideos = Object.values(videos).map((path) => path.split('/').at(-1)!);

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

  it('connects the approved bird dog video and preserves its photo guide', () => {
    const birdDog = buildWorkout('back', []).find((exercise) => exercise.id === 'bird-dog');
    expect(birdDog?.video).toContain('/exercises/videos/bird-dog.mp4');
    expect(birdDog?.phases).toHaveLength(3);
  });

  it.each(['plank-rotation', 'dead-bug', 'chin-tuck', 'side-neck-isometric'])('keeps %s on its photo guide', (id) => {
    expect(exerciseCatalog[id].video).toBeUndefined();
    expect(exerciseCatalog[id].phases).toHaveLength(3);
  });

  it.each(Object.entries(videos))('connects %s to its MP4 at either deployment base path', (id, video) => {
    expect(exerciseCatalog[id].video).toContain(`${video}?v=20260907-approved-motion`);
    expect(readFileSync(resolve('public', video.slice(1))).subarray(4, 8).toString()).toBe('ftyp');
  });

  it.each(Object.entries(approved))('ships the unchanged reviewed %s candidate', (id, evidence) => {
    const path = resolve('public', videos[id as keyof typeof videos].slice(1));
    expect(evidence.review.accepted).toBe(true);
    expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(evidence.sha256);
  });

  it.each(Object.values(exerciseCatalog))('$id preserves its three existing reference images', (exercise) => {
    expect(exercise.phases.map((phase) => phase.id)).toEqual(['start', 'middle', 'finish']);
    for (const phase of exercise.phases) {
      const file = phase.image.split('?')[0].replace(process.env.NEXT_PUBLIC_BASE_PATH ?? '', '');
      expect(existsSync(resolve('public', file.slice(1)))).toBe(true);
    }
  });

  it('ships exactly the 22 available videos and maps every file', () => {
    expect(Object.keys(exerciseCatalog)).toHaveLength(26);
    expect(Object.keys(videos)).toHaveLength(22);
    expect(Object.keys(approved)).toHaveLength(18);
    const files = readdirSync(resolve('public/exercises/videos')).filter((file) => file.endsWith('.mp4'));
    expect(files.sort()).toEqual([...renderedVideos].sort());
  });
});
