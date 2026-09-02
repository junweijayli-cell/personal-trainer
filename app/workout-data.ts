export type CameraMode = 'knee' | 'elbow' | 'hip' | 'extension' | 'hold';
export type FocusId = 'legs' | 'chest' | 'back' | 'neck' | 'core' | 'mobility' | 'cardio' | 'full-body';
export type EquipmentId = 'dumbbells' | 'resistance-band' | 'bench' | 'kettlebell' | 'barbell' | 'cable-machine' | 'leg-press' | 'suspension-trainer' | 'stability-ball' | 'medicine-ball' | 'stationary-bike';

export type ExercisePhase = {
  id: 'start' | 'middle' | 'finish';
  label: string;
  image: string;
  cue: string;
};

export type Exercise = {
  id: string;
  name: string;
  image: string;
  video?: string;
  phases: ExercisePhase[];
  sets: number;
  target: number;
  targetLabel: string;
  rest: number;
  cameraMode: CameraMode;
  view: string;
  intro: string;
  tips: string[];
  muscles: string;
  equipment: 'bodyweight' | EquipmentId;
};

export type FocusOption = { id: FocusId; label: string; shortLabel: string; description: string };
export type EquipmentOption = { id: EquipmentId; label: string; shortLabel: string; icon: string };

const mediaVersion = '20260903-higgsfield-video';
const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const media = (path: string) => `${publicBasePath}${path}?v=${mediaVersion}`;

const exerciseVideos: Record<string, string> = {
  squat: '/exercises/videos/squat.mp4',
  'incline-pushup': '/exercises/videos/incline-pushup.mp4',
  'reverse-lunge': '/exercises/videos/reverse-lunge.mp4',
  'barbell-squat': '/exercises/videos/barbell-squat.mp4',
};

export const focusOptions: FocusOption[] = [
  { id: 'legs', label: 'Legs & glutes', shortLabel: 'Legs', description: 'Squat, hinge and single-leg strength' },
  { id: 'chest', label: 'Chest & push', shortLabel: 'Chest', description: 'Chest, shoulders and triceps' },
  { id: 'back', label: 'Back & pull', shortLabel: 'Back', description: 'Upper back, lats and posture' },
  { id: 'neck', label: 'Neck & posture', shortLabel: 'Neck', description: 'Gentle neck strength and alignment' },
  { id: 'core', label: 'Core & stability', shortLabel: 'Core', description: 'Trunk control and resilient movement' },
  { id: 'mobility', label: 'Mobility & recovery', shortLabel: 'Mobility', description: 'Easy movement for recovery days' },
  { id: 'cardio', label: 'Cardio & stamina', shortLabel: 'Cardio', description: 'Low-impact conditioning and stamina' },
  { id: 'full-body', label: 'Full body', shortLabel: 'Full', description: 'A balanced head-to-toe session' },
];

export const equipmentOptions: EquipmentOption[] = [
  { id: 'dumbbells', label: 'Dumbbells', shortLabel: 'Dumbbells', icon: 'DB' },
  { id: 'resistance-band', label: 'Resistance band', shortLabel: 'Band', icon: 'RB' },
  { id: 'bench', label: 'Bench or step', shortLabel: 'Bench', icon: 'BN' },
  { id: 'kettlebell', label: 'Kettlebell', shortLabel: 'Kettlebell', icon: 'KB' },
  { id: 'barbell', label: 'Barbell & rack', shortLabel: 'Barbell', icon: 'BB' },
  { id: 'cable-machine', label: 'Cable machine', shortLabel: 'Cable', icon: 'CB' },
  { id: 'leg-press', label: 'Leg press', shortLabel: 'Leg press', icon: 'LP' },
  { id: 'suspension-trainer', label: 'Suspension trainer', shortLabel: 'Straps', icon: 'TR' },
  { id: 'stability-ball', label: 'Stability ball', shortLabel: 'Ball', icon: 'SB' },
  { id: 'medicine-ball', label: 'Medicine ball', shortLabel: 'Med ball', icon: 'MB' },
  { id: 'stationary-bike', label: 'Stationary bike', shortLabel: 'Bike', icon: 'BK' },
];

// Sunday through Saturday: recovery, legs, chest, back, posture, full body, cardio.
export const weeklyRotation: FocusId[] = ['mobility', 'legs', 'chest', 'back', 'neck', 'full-body', 'cardio'];

export function getRecommendedFocus(date = new Date()): FocusId {
  return weeklyRotation[date.getDay()];
}

export function getFocusOption(focus: FocusId) {
  return focusOptions.find((option) => option.id === focus) ?? focusOptions[7];
}

type ExerciseInput = Omit<Exercise, 'image' | 'video' | 'phases'> & {
  phaseCues: [string, string, string];
  finishLabel?: string;
};

function makeExercise({ phaseCues, finishLabel = 'Finish', ...exercise }: ExerciseInput): Exercise {
  const phaseImage = (phase: ExercisePhase['id']) => media(`/exercises/phase-guides/${exercise.id}-${phase}.webp`);
  const phases: ExercisePhase[] = [
    { id: 'start', label: 'Set up', image: phaseImage('start'), cue: phaseCues[0] },
    { id: 'middle', label: 'Move', image: phaseImage('middle'), cue: phaseCues[1] },
    { id: 'finish', label: finishLabel, image: phaseImage('finish'), cue: phaseCues[2] },
  ];
  const video = exerciseVideos[exercise.id] ? media(exerciseVideos[exercise.id]) : undefined;
  return { ...exercise, phases, image: phases[1].image, video };
}

const exerciseList: Exercise[] = [
  makeExercise({
    id: 'squat', name: 'Bodyweight squat', sets: 3, target: 10, targetLabel: '10 reps', rest: 45, cameraMode: 'knee', equipment: 'bodyweight',
    view: 'Face the phone at a slight angle', intro: 'Sit down between your hips, then stand tall.', muscles: 'Quads · glutes · core',
    tips: ['Set feet just wider than your hips.', 'Track knees in the same direction as toes.', 'Keep your whole foot planted.'],
    phaseCues: ['Stand tall with feet just wider than hip-width.', 'Sit between your hips while knees track over toes.', 'Push through the whole foot and finish tall.'],
  }),
  makeExercise({
    id: 'reverse-lunge', name: 'Reverse lunge', sets: 3, target: 8, targetLabel: '8 / side', rest: 50, cameraMode: 'knee', equipment: 'bodyweight',
    view: 'Show your full body from the side', intro: 'Step back softly and lower straight down.', muscles: 'Glutes · quads · balance',
    tips: ['Keep pressure through the front foot.', 'Lower both knees without tipping forward.', 'Control every step back.'],
    phaseCues: ['Stand tall with feet under your hips.', 'Step back and lower both knees under control.', 'Drive through the front foot to return tall.'],
  }),
  makeExercise({
    id: 'incline-pushup', name: 'Incline push-up', sets: 3, target: 8, targetLabel: '8 reps', rest: 45, cameraMode: 'elbow', equipment: 'bodyweight',
    view: 'Place the phone side-on', intro: 'Move your chest toward the bench as one strong unit.', muscles: 'Chest · shoulders · triceps',
    tips: ['Use a stable surface.', 'Keep one line from ears to heels.', 'Aim elbows back at about 45 degrees.'],
    phaseCues: ['Set hands on a stable surface and make one long line.', 'Bend elbows back as your chest approaches the support.', 'Press the support away without letting hips sag.'],
  }),
  makeExercise({
    id: 'glute-bridge', name: 'Glute bridge', sets: 3, target: 12, targetLabel: '12 reps', rest: 40, cameraMode: 'hip', equipment: 'bodyweight',
    view: 'Place the phone side-on at floor height', intro: 'Drive through your feet and finish with your hips tall.', muscles: 'Glutes · hamstrings · core',
    tips: ['Plant feet close to your hips.', 'Lift shoulders, hips and knees into one line.', 'Do not arch the lower back.'],
    phaseCues: ['Lie down with knees bent and feet planted.', 'Drive through your heels and lift the hips.', 'Squeeze glutes at the top without arching your back.'],
  }),
  makeExercise({
    id: 'plank-rotation', name: 'High-plank rotation', sets: 2, target: 6, targetLabel: '6 / side', rest: 35, cameraMode: 'extension', equipment: 'bodyweight',
    view: 'Place the phone side-on at floor height', intro: 'Turn from a strong plank and reach one arm toward the ceiling.', muscles: 'Core · shoulders · balance',
    tips: ['Hands stay directly under shoulders.', 'Rotate chest and hips together.', 'Stack the reaching shoulder.'],
    phaseCues: ['Build a strong high plank with hands under shoulders.', 'Rotate chest and hips together as one arm opens.', 'Stack shoulders and pause before returning.'],
  }),
  makeExercise({
    id: 'forearm-plank', name: 'Forearm plank', sets: 2, target: 30, targetLabel: '30 sec', rest: 35, cameraMode: 'hold', equipment: 'bodyweight', finishLabel: 'Hold',
    view: 'Place the phone side-on at floor height', intro: 'Build one long line and breathe behind the brace.', muscles: 'Core · shoulders · glutes',
    tips: ['Stack elbows below shoulders.', 'Keep ribs tucked and glutes gently active.', 'End if your back sags or pinches.'],
    phaseCues: ['Set elbows below shoulders and extend one leg at a time.', 'Brace gently and lengthen from head through heels.', 'Hold the long line while breathing steadily.'],
  }),
  makeExercise({
    id: 'bird-dog', name: 'Bird dog', sets: 3, target: 8, targetLabel: '8 / side', rest: 35, cameraMode: 'extension', equipment: 'bodyweight',
    view: 'Place the phone side-on at floor height', intro: 'Reach opposite arm and leg without letting your trunk turn.', muscles: 'Back · core · glutes',
    tips: ['Hands under shoulders; knees under hips.', 'Reach long, not high.', 'Keep both hip bones facing the floor.'],
    phaseCues: ['Start on all fours with a quiet, level back.', 'Slide opposite arm and leg away from your centre.', 'Reach long while keeping both hips facing down.'],
  }),
  makeExercise({
    id: 'dead-bug', name: 'Dead bug', sets: 3, target: 8, targetLabel: '8 / side', rest: 35, cameraMode: 'extension', equipment: 'bodyweight',
    view: 'Place the phone side-on at floor height', intro: 'Lower opposite arm and leg while your trunk stays quiet.', muscles: 'Deep core · hip flexors · coordination',
    tips: ['Stack knees over hips.', 'Keep the lower back gently connected.', 'Only move as far as your ribs stay down.'],
    phaseCues: ['Stack knees over hips and hands over shoulders.', 'Lower opposite arm and leg without lifting your ribs.', 'Reach long, then return smoothly to centre.'],
  }),
  makeExercise({
    id: 'goblet-squat', name: 'Goblet squat', sets: 3, target: 10, targetLabel: '10 reps', rest: 55, cameraMode: 'knee', equipment: 'dumbbells',
    view: 'Face the phone at a slight angle', intro: 'Hold one weight close and sit smoothly between your hips.', muscles: 'Quads · glutes · upper back',
    tips: ['Hold the weight close.', 'Track knees over your middle toes.', 'Leave two comfortable reps in reserve.'],
    phaseCues: ['Hold one dumbbell close to your chest.', 'Sit between your hips with knees tracking over toes.', 'Drive the floor away and finish tall.'],
  }),
  makeExercise({
    id: 'dumbbell-rdl', name: 'Dumbbell Romanian deadlift', sets: 3, target: 10, targetLabel: '10 reps', rest: 60, cameraMode: 'hip', equipment: 'dumbbells',
    view: 'Place the phone side-on', intro: 'Send your hips back while the weights stay close to your legs.', muscles: 'Hamstrings · glutes · back',
    tips: ['Soften your knees.', 'Keep weights close to your legs.', 'Stop while your back stays long.'],
    phaseCues: ['Stand tall with weights close to your thighs.', 'Send hips back as the weights slide down your legs.', 'Drive hips forward and finish tall, not leaned back.'],
  }),
  makeExercise({
    id: 'dumbbell-floor-press', name: 'Dumbbell floor press', sets: 3, target: 10, targetLabel: '10 reps', rest: 55, cameraMode: 'elbow', equipment: 'dumbbells',
    view: 'Place the phone side-on at floor height', intro: 'Press both dumbbells up while your shoulders stay anchored.', muscles: 'Chest · triceps · shoulders',
    tips: ['Plant feet and settle your ribs.', 'Let upper arms softly touch the floor.', 'Stack wrists above elbows.'],
    phaseCues: ['Lie down with weights stacked over your chest.', 'Lower until upper arms softly meet the floor.', 'Press up with wrists stacked above elbows.'],
  }),
  makeExercise({
    id: 'dumbbell-row', name: 'Supported dumbbell row', sets: 3, target: 10, targetLabel: '10 / side', rest: 50, cameraMode: 'elbow', equipment: 'dumbbells',
    view: 'Place the phone on your working-arm side', intro: 'Pull the dumbbell toward your hip without twisting your torso.', muscles: 'Lats · upper back · biceps',
    tips: ['Brace on a stable bench.', 'Keep your neck long.', 'Finish with elbow near your ribs.'],
    phaseCues: ['Brace one hand and let the working arm hang long.', 'Pull the weight toward your hip without twisting.', 'Pause with elbow near your ribs, then lower slowly.'],
  }),
  makeExercise({
    id: 'band-row', name: 'Resistance-band row', sets: 3, target: 12, targetLabel: '12 reps', rest: 45, cameraMode: 'elbow', equipment: 'resistance-band',
    view: 'Face the phone with the anchor safely behind it', intro: 'Pull both handles toward your ribs and pause with a tall chest.', muscles: 'Upper back · lats · rear shoulders',
    tips: ['Use a secure anchor.', 'Keep shoulders down.', 'Return slowly with tall posture.'],
    phaseCues: ['Use a secure anchor and begin with arms long.', 'Pull elbows back while your shoulders stay down.', 'Pause at your ribs, then return under control.'],
  }),
  makeExercise({
    id: 'bench-step-up', name: 'Bench step-up', sets: 3, target: 8, targetLabel: '8 / side', rest: 50, cameraMode: 'knee', equipment: 'bench',
    view: 'Place the phone at a slight side angle', intro: 'Drive through the whole foot on a stable low step.', muscles: 'Quads · glutes · balance',
    tips: ['Use a step that cannot move.', 'Track the working knee over toes.', 'Control the way down.'],
    phaseCues: ['Plant your whole working foot on a stable low step.', 'Drive through that foot as your body rises.', 'Stand tall on the step, then descend slowly.'],
  }),
  makeExercise({
    id: 'kettlebell-deadlift', name: 'Kettlebell deadlift', sets: 3, target: 10, targetLabel: '10 reps', rest: 55, cameraMode: 'hip', equipment: 'kettlebell',
    view: 'Place the phone side-on', intro: 'Push the floor away and stand tall with the bell close.', muscles: 'Glutes · hamstrings · back',
    tips: ['Set the bell between your feet.', 'Brace and keep your back long.', 'Finish without leaning backward.'],
    phaseCues: ['Set the bell between your feet and hinge to the handle.', 'Brace and push the floor away with a long back.', 'Stand tall with the bell close; do not lean back.'],
  }),
  makeExercise({
    id: 'barbell-squat', name: 'Barbell back squat', sets: 3, target: 8, targetLabel: '8 reps', rest: 75, cameraMode: 'knee', equipment: 'barbell',
    view: 'Place the phone at a rear three-quarter angle', intro: 'Brace, sit between your hips, and drive the bar straight up.', muscles: 'Quads · glutes · core',
    tips: ['Use rack safeties.', 'Keep the bar over mid-foot.', 'Stop if position changes or a rep grinds.'],
    phaseCues: ['Set the bar securely across your upper back and brace.', 'Descend with knees tracking over toes and chest steady.', 'Drive through mid-foot until hips and knees are tall.'],
  }),
  makeExercise({
    id: 'lat-pulldown', name: 'Lat pulldown', sets: 3, target: 10, targetLabel: '10 reps', rest: 55, cameraMode: 'elbow', equipment: 'cable-machine',
    view: 'Place the phone in front at a slight angle', intro: 'Pull the bar toward your upper chest without swinging.', muscles: 'Lats · upper back · biceps',
    tips: ['Secure your thighs.', 'Drive elbows down.', 'Return slowly until arms are long.'],
    phaseCues: ['Sit tall with arms long and shoulders relaxed.', 'Drive elbows down as the bar travels to upper chest.', 'Pause without leaning back, then return slowly.'],
  }),
  makeExercise({
    id: 'leg-press', name: 'Leg press', sets: 3, target: 10, targetLabel: '10 reps', rest: 70, cameraMode: 'knee', equipment: 'leg-press',
    view: 'Place the phone beside the machine', intro: 'Lower within a comfortable range, then press through your whole foot.', muscles: 'Quads · glutes · hamstrings',
    tips: ['Keep hips supported.', 'Track knees in line with toes.', 'Do not lock knees hard.'],
    phaseCues: ['Plant feet evenly and unlock the sled safely.', 'Lower until comfortable while hips stay on the pad.', 'Press through the whole foot without snapping knees straight.'],
  }),
  makeExercise({
    id: 'cable-chest-press', name: 'Standing cable chest press', sets: 3, target: 10, targetLabel: '10 reps', rest: 55, cameraMode: 'elbow', equipment: 'cable-machine',
    view: 'Place the phone side-on', intro: 'Press handles forward while your ribs and hips stay quiet.', muscles: 'Chest · shoulders · triceps',
    tips: ['Use a staggered stance.', 'Stack wrists over elbows.', 'Return slowly.'],
    phaseCues: ['Take a stable split stance with handles by your chest.', 'Press forward as your torso stays still.', 'Reach full comfortable extension, then return slowly.'],
  }),
  makeExercise({
    id: 'suspension-row', name: 'Suspension row', sets: 3, target: 10, targetLabel: '10 reps', rest: 50, cameraMode: 'elbow', equipment: 'suspension-trainer',
    view: 'Place the phone side-on with the anchor visible', intro: 'Keep a straight body line as you pull your chest to the handles.', muscles: 'Upper back · lats · biceps',
    tips: ['Check the anchor first.', 'Keep hips lifted.', 'Adjust foot position for difficulty.'],
    phaseCues: ['Lean back with arms long and body in one line.', 'Pull your chest toward the handles without dropping hips.', 'Pause with elbows by your ribs, then lower slowly.'],
  }),
  makeExercise({
    id: 'stability-ball-curl', name: 'Stability-ball hamstring curl', sets: 3, target: 10, targetLabel: '10 reps', rest: 50, cameraMode: 'hip', equipment: 'stability-ball',
    view: 'Place the phone side-on at floor height', intro: 'Keep hips lifted as your heels roll the ball toward you.', muscles: 'Hamstrings · glutes · core',
    tips: ['Centre heels on the ball.', 'Keep hips level.', 'Shorten the range if your back arches.'],
    phaseCues: ['Lie tall with heels on the ball and hips lifted.', 'Bend knees and roll the ball toward your hips.', 'Keep hips high, then lengthen the legs slowly.'],
  }),
  makeExercise({
    id: 'medicine-ball-press', name: 'Medicine-ball squat to press', sets: 3, target: 10, targetLabel: '10 reps', rest: 55, cameraMode: 'knee', equipment: 'medicine-ball',
    view: 'Face the phone at a slight angle', intro: 'Stand from the squat and press the ball overhead in one smooth motion.', muscles: 'Legs · shoulders · core',
    tips: ['Hold the ball close.', 'Use your legs to drive up.', 'Keep ribs down overhead.'],
    phaseCues: ['Hold the ball at your chest with feet planted.', 'Sit into a controlled squat while the ball stays close.', 'Stand and press overhead without flaring your ribs.'],
  }),
  makeExercise({
    id: 'stationary-bike', name: 'Stationary bike intervals', sets: 5, target: 45, targetLabel: '45 sec', rest: 30, cameraMode: 'knee', equipment: 'stationary-bike', finishLabel: 'Repeat',
    view: 'Place the phone where your side profile is visible', intro: 'Pedal smoothly at a brisk pace you can repeat each round.', muscles: 'Cardio · quads · glutes',
    tips: ['Keep a slight knee bend at the bottom.', 'Relax shoulders and hands.', 'Slow down for dizziness or unusual breathlessness.'],
    phaseCues: ['Set your seat, strap feet in, and begin easy.', 'Build to a brisk pace with smooth pedal strokes.', 'Finish the interval under control, then pedal easy.'],
  }),
  makeExercise({
    id: 'chin-tuck', name: 'Standing chin tuck', sets: 2, target: 8, targetLabel: '8 gentle reps', rest: 30, cameraMode: 'hold', equipment: 'bodyweight', finishLabel: 'Hold',
    view: 'Place the phone side-on at shoulder height', intro: 'Glide your head straight back without looking down.', muscles: 'Deep neck flexors · posture',
    tips: ['Make the movement small and pain-free.', 'Keep eyes level and shoulders relaxed.', 'Stop for dizziness, tingling, or sharp pain.'],
    phaseCues: ['Stand tall with head naturally stacked over shoulders.', 'Glide the chin straight back without tipping it down.', 'Hold gently for two seconds, then release.'],
  }),
  makeExercise({
    id: 'side-neck-isometric', name: 'Side neck isometric', sets: 2, target: 5, targetLabel: '5 × 5 sec / side', rest: 30, cameraMode: 'hold', equipment: 'bodyweight', finishLabel: 'Hold',
    view: 'Place the phone in front at chest height', intro: 'Press your head gently into your hand without letting it move.', muscles: 'Side neck · postural support',
    tips: ['Use light pressure only.', 'Keep head upright and shoulders down.', 'Stop for pain, tingling, headache, or dizziness.'],
    phaseCues: ['Sit tall with your head neutral and shoulders loose.', 'Place one palm above the ear without tilting.', 'Press gently into the hand for five seconds; no motion.'],
  }),
  makeExercise({
    id: 'upper-trap-stretch', name: 'Upper-trap stretch', sets: 2, target: 20, targetLabel: '20 sec / side', rest: 20, cameraMode: 'hold', equipment: 'bodyweight', finishLabel: 'Hold',
    view: 'Place the phone in front at chest height', intro: 'Anchor one shoulder and gently tilt your head away.', muscles: 'Upper traps · neck · shoulders',
    tips: ['Let gravity create the stretch.', 'Keep the anchored shoulder down.', 'Stop for sharp, electric, or dizzy sensations.'],
    phaseCues: ['Sit or stand tall with both shoulders relaxed.', 'Anchor one shoulder and begin tilting away.', 'Hold a mild stretch with the face still forward.'],
  }),
];

const exerciseCatalog = Object.fromEntries(exerciseList.map((exercise) => [exercise.id, exercise])) as Record<string, Exercise>;

function uniqueExercises(ids: string[]) {
  const seen = new Set<string>();
  return ids.flatMap((id) => {
    if (seen.has(id) || !exerciseCatalog[id]) return [];
    seen.add(id);
    return [exerciseCatalog[id]];
  });
}

export function buildWorkout(focus: FocusId, equipment: EquipmentId[]): Exercise[] {
  const has = (item: EquipmentId) => equipment.includes(item);
  const squat = has('barbell') ? 'barbell-squat' : has('leg-press') ? 'leg-press' : has('dumbbells') ? 'goblet-squat' : 'squat';
  const hinge = has('stability-ball') ? 'stability-ball-curl' : has('dumbbells') ? 'dumbbell-rdl' : has('kettlebell') ? 'kettlebell-deadlift' : 'glute-bridge';
  const press = has('cable-machine') ? 'cable-chest-press' : has('dumbbells') ? 'dumbbell-floor-press' : 'incline-pushup';
  const overhead = has('medicine-ball') ? 'medicine-ball-press' : press;
  const pull = has('cable-machine') ? 'lat-pulldown' : has('suspension-trainer') ? 'suspension-row' : has('dumbbells') ? 'dumbbell-row' : has('resistance-band') ? 'band-row' : 'bird-dog';
  const singleLeg = has('bench') ? 'bench-step-up' : 'reverse-lunge';
  const cardio = has('stationary-bike') ? 'stationary-bike' : singleLeg;

  const plans: Record<FocusId, string[]> = {
    legs: [squat, singleLeg, hinge, 'glute-bridge', 'forearm-plank'],
    chest: [press, overhead, 'incline-pushup', 'plank-rotation', 'forearm-plank'],
    back: [pull, hinge, 'bird-dog', 'forearm-plank', 'upper-trap-stretch'],
    neck: ['chin-tuck', 'side-neck-isometric', 'upper-trap-stretch', pull, 'bird-dog'],
    core: ['dead-bug', 'glute-bridge', 'plank-rotation', 'forearm-plank', has('stability-ball') ? 'stability-ball-curl' : 'bird-dog'],
    mobility: ['chin-tuck', 'upper-trap-stretch', 'bird-dog', 'glute-bridge', 'dead-bug'],
    cardio: [cardio, squat, singleLeg, 'plank-rotation', 'dead-bug'],
    'full-body': [squat, pull, press, singleLeg, 'forearm-plank'],
  };
  return uniqueExercises([
    ...plans[focus],
    'dead-bug',
    'bird-dog',
    'glute-bridge',
    'forearm-plank',
    'squat',
  ]).slice(0, 5);
}

export function getWorkoutStats(workout: Exercise[]) {
  const sets = workout.reduce((sum, exercise) => sum + exercise.sets, 0);
  const minutes = Math.max(14, Math.round(sets * 1.45));
  return { sets, minutes, moves: workout.length };
}

export const workout = buildWorkout('full-body', []);
export const totalSets = getWorkoutStats(workout).sets;
