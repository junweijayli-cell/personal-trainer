import type {Exercise} from './workout-data';
// Chinese counterparts of each movement's existing key cue.
const cues:Record<string,string>={
  squat:'膝盖与脚尖保持同一方向。', 'reverse-lunge':'屈膝向下，身体不要前倾。',
  'incline-pushup':'从耳朵到脚跟保持一条直线。', 'glute-bridge':'抬起髋部，让肩膀、髋部和膝盖成一直线。',
  'plank-rotation':'胸部和髋部一起转动。', 'forearm-plank':'收住肋骨，臀部轻轻发力。',
  'bird-dog':'向远处伸展，不要抬得过高。', 'dead-bug':'让下背部轻轻贴住地面。',
  'goblet-squat':'膝盖对准脚趾中间的方向。', 'dumbbell-rdl':'让哑铃靠近双腿移动。',
  'dumbbell-floor-press':'让上臂轻轻触地。', 'dumbbell-row':'保持颈部自然伸长。',
  'band-row':'放松肩膀，不要耸肩。', 'bench-step-up':'支撑腿的膝盖对准脚尖方向。',
  'kettlebell-deadlift':'收紧躯干，保持背部自然伸展。', 'barbell-squat':'让杠铃保持在脚掌中部上方。',
  'lat-pulldown':'将肘部向下拉。', 'leg-press':'膝盖与脚尖保持同一方向。',
  'cable-chest-press':'手腕与肘部保持对齐。', 'suspension-row':'保持髋部抬起。',
  'stability-ball-curl':'保持髋部水平。', 'medicine-ball-press':'用双腿发力向上推。',
  'stationary-bike':'放松肩膀和双手。', 'chin-tuck':'目视前方，放松肩膀。',
  'side-neck-isometric':'头部保持直立，肩膀放松下沉。', 'upper-trap-stretch':'保持固定侧的肩膀下沉。',
};
export function coachExerciseCue(exercise:Exercise,language:'en'|'zh') {
  return language==='zh'?cues[exercise.id]??'保持稳定，均匀呼吸。':exercise.tips[1];
}
