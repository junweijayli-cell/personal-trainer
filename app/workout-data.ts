export type CameraMode = 'knee' | 'elbow' | 'hip' | 'extension' | 'hold';

export type Exercise = {
  id: string;
  name: string;
  image: string;
  video: string;
  sets: number;
  target: number;
  targetLabel: string;
  rest: number;
  cameraMode: CameraMode;
  view: string;
  intro: string;
  tips: string[];
  muscles: string;
};

export const workout: Exercise[] = [
  {
    id: 'squat',
    name: 'Bodyweight squat',
    image: '/exercises/squat-realistic.png',
    video: '/videos/squat.mp4',
    sets: 3,
    target: 10,
    targetLabel: '10 reps',
    rest: 45,
    cameraMode: 'knee',
    view: 'Face the phone at a slight angle',
    intro: 'Sit down between your hips, then stand tall.',
    tips: [
      'Feet just wider than your hips; toes turned slightly out.',
      'Let your knees travel in the same direction as your toes.',
      'Keep your whole foot planted as you stand.',
    ],
    muscles: 'Quads · glutes · core',
  },
  {
    id: 'reverse-lunge',
    name: 'Reverse lunge',
    image: '/exercises/reverse-lunge-realistic.png',
    video: '/videos/reverse-lunge.mp4',
    sets: 3,
    target: 8,
    targetLabel: '8 / side',
    rest: 50,
    cameraMode: 'knee',
    view: 'Show your full body from the side',
    intro: 'Step back softly and lower straight down.',
    tips: [
      'Keep most of your pressure through the front foot.',
      'Lower both knees without tipping your chest forward.',
      'Push the floor away to return to standing.',
    ],
    muscles: 'Glutes · quads · balance',
  },
  {
    id: 'incline-pushup',
    name: 'Incline push-up',
    image: '/exercises/incline-pushup-realistic.png',
    video: '/videos/incline-pushup.mp4',
    sets: 3,
    target: 8,
    targetLabel: '8 reps',
    rest: 45,
    cameraMode: 'elbow',
    view: 'Place the phone side-on',
    intro: 'Move your chest toward the bench as one strong unit.',
    tips: [
      'Hands slightly wider than shoulders on a stable surface.',
      'Keep a straight line from ears through hips to heels.',
      'Aim elbows back at roughly 45 degrees.',
    ],
    muscles: 'Chest · shoulders · triceps',
  },
  {
    id: 'glute-bridge',
    name: 'Glute bridge',
    image: '/exercises/glute-bridge-realistic.png',
    video: '/videos/glute-bridge.mp4',
    sets: 3,
    target: 12,
    targetLabel: '12 reps',
    rest: 40,
    cameraMode: 'hip',
    view: 'Place the phone side-on at floor height',
    intro: 'Drive through your feet and finish with your hips tall.',
    tips: [
      'Set feet flat and close enough to touch heels with fingertips.',
      'Lift until shoulders, hips, and knees form one line.',
      'Finish with your glutes, not an arched lower back.',
    ],
    muscles: 'Glutes · hamstrings · core',
  },
  {
    id: 'plank-rotation',
    name: 'High-plank rotation',
    image: '/exercises/plank-rotation-realistic.png',
    video: '/videos/plank-rotation.mp4',
    sets: 2,
    target: 6,
    targetLabel: '6 / side',
    rest: 35,
    cameraMode: 'extension',
    view: 'Place the phone side-on at floor height',
    intro: 'Turn from a strong plank and reach one arm toward the ceiling.',
    tips: [
      'Start in a high plank with hands directly under shoulders.',
      'Rotate your chest and hips together instead of twisting your lower back.',
      'Stack the reaching shoulder over the supporting shoulder.',
    ],
    muscles: 'Core · shoulders · balance',
  },
  {
    id: 'forearm-plank',
    name: 'Forearm plank',
    image: '/exercises/forearm-plank-realistic.png',
    video: '/videos/forearm-plank.mp4',
    sets: 2,
    target: 30,
    targetLabel: '30 sec',
    rest: 35,
    cameraMode: 'hold',
    view: 'Place the phone side-on at floor height',
    intro: 'Build one long line and breathe behind the brace.',
    tips: [
      'Stack elbows directly below your shoulders.',
      'Squeeze glutes gently and keep ribs tucked.',
      'End the set if your back starts to sag or pinch.',
    ],
    muscles: 'Core · shoulders · glutes',
  },
];

export const totalSets = workout.reduce((sum, exercise) => sum + exercise.sets, 0);
