"""Render every Relay workout guide with the same realistic digital coach.

The ignored ``.video-tools/relay-avatar-base.blend`` file is a CC0-output
MakeHuman/MB-Lab character prepared with its IK rig. Run this script through
Blender 5.x. Pass an exercise slug after ``--`` to render a single clip.
"""

from __future__ import annotations

import math
import subprocess
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
BASE_AVATAR = ROOT / ".video-tools" / "relay-avatar-base.blend"
FRAME_DIR = ROOT / ".video-tools" / "virtual-coach-frames"
VIDEO_DIR = ROOT / "public" / "videos"
POSTER_DIR = ROOT / "public" / "exercises"
SOURCE_FPS = 12
OUTPUT_FPS = 24
END_FRAME = 49
SCALE = 0.42


def stand_pose():
    return {
        "pelvis": (0.0, 0.0, 1.93), "chest": (0.05, 0.0, 3.12),
        "head": (0.14, 0.0, 3.90),
        "knee_l": (0.02, -0.22, 1.05), "knee_r": (0.02, 0.22, 1.05),
        "ankle_l": (0.0, -0.22, 0.22), "ankle_r": (0.0, 0.22, 0.22),
        "elbow_l": (0.02, -0.52, 2.58), "elbow_r": (0.02, 0.52, 2.58),
        "wrist_l": (0.14, -0.52, 1.98), "wrist_r": (0.14, 0.52, 1.98),
    }


def squat_pose():
    return {
        "pelvis": (-0.62, 0.0, 1.26), "chest": (-0.26, 0.0, 2.36),
        "head": (0.01, 0.0, 3.10),
        "knee_l": (0.61, -0.27, 1.15), "knee_r": (0.61, 0.27, 1.15),
        "ankle_l": (0.0, -0.27, 0.22), "ankle_r": (0.0, 0.27, 0.22),
        "elbow_l": (0.34, -0.34, 2.23), "elbow_r": (0.34, 0.34, 2.23),
        "wrist_l": (0.75, -0.12, 2.28), "wrist_r": (0.75, 0.12, 2.28),
    }


def lunge_pose():
    return {
        "pelvis": (0.0, 0.0, 1.68), "chest": (0.02, 0.0, 2.88),
        "head": (0.12, 0.0, 3.65),
        "knee_l": (0.68, -0.23, 0.93), "knee_r": (-0.58, 0.23, 0.63),
        "ankle_l": (0.73, -0.23, 0.22), "ankle_r": (-1.28, 0.23, 0.22),
        "elbow_l": (0.27, -0.38, 2.61), "elbow_r": (0.27, 0.38, 2.61),
        "wrist_l": (0.61, -0.13, 2.78), "wrist_r": (0.61, 0.13, 2.78),
    }


def incline_pose(down=False):
    return {
        "pelvis": (-0.42, 0.0, 1.22),
        "chest": (0.54 if down else 0.38, 0.0, 1.49 if down else 1.67),
        "head": (1.20 if down else 1.02, 0.0, 1.57 if down else 1.93),
        "knee_l": (-1.12, -0.22, 0.74), "knee_r": (-1.12, 0.22, 0.74),
        "ankle_l": (-1.73, -0.22, 0.23), "ankle_r": (-1.73, 0.22, 0.23),
        "elbow_l": (0.84, -0.49, 1.20 if down else 1.55), "elbow_r": (0.84, 0.49, 1.20 if down else 1.55),
        "wrist_l": (1.25, -0.43, 1.39), "wrist_r": (1.25, 0.43, 1.39),
    }


def bridge_pose(up=False):
    return {
        "pelvis": (0.0, 0.0, 1.05 if up else 0.40), "chest": (-0.76, 0.0, 0.46),
        "head": (-1.48, 0.0, 0.50),
        "knee_l": (0.62, -0.25, 1.05), "knee_r": (0.62, 0.25, 1.05),
        "ankle_l": (1.10, -0.25, 0.22), "ankle_r": (1.10, 0.25, 0.22),
        "elbow_l": (-0.34, -0.56, 0.22), "elbow_r": (-0.34, 0.56, 0.22),
        "wrist_l": (0.18, -0.56, 0.18), "wrist_r": (0.18, 0.56, 0.18),
    }


def high_plank_pose(rotated=False):
    pose = {
        "pelvis": (-0.45, 0.0, 1.03), "chest": (0.33, 0.0, 1.09),
        "head": (1.04, 0.0, 1.16),
        "knee_l": (-1.10, -0.22, 0.55), "knee_r": (-1.10, 0.22, 0.55),
        "ankle_l": (-1.70, -0.22, 0.22), "ankle_r": (-1.70, 0.22, 0.22),
        "elbow_l": (0.49, -0.40, 0.59), "elbow_r": (0.49, 0.40, 0.59),
        "wrist_l": (0.58, -0.38, 0.17), "wrist_r": (0.58, 0.38, 0.17),
    }
    if rotated:
        pose.update({
            "chest": (0.30, 0.05, 1.20), "head": (1.00, 0.04, 1.32),
            "elbow_r": (0.24, 0.18, 1.90), "wrist_r": (0.12, 0.12, 2.49),
        })
    return pose


def forearm_plank_pose(breathe=False):
    lift = 0.035 if breathe else 0.0
    return {
        "pelvis": (-0.45, 0.0, 0.94 + lift), "chest": (0.30, 0.0, 1.02 + lift),
        "head": (0.98, 0.0, 1.10 + lift),
        "knee_l": (-1.10, -0.22, 0.52), "knee_r": (-1.10, 0.22, 0.52),
        "ankle_l": (-1.70, -0.22, 0.22), "ankle_r": (-1.70, 0.22, 0.22),
        "elbow_l": (0.50, -0.43, 0.18), "elbow_r": (0.50, 0.43, 0.18),
        "wrist_l": (1.00, -0.43, 0.14), "wrist_r": (1.00, 0.43, 0.14),
    }


EXERCISES = {
    "squat": {"poses": [(1, stand_pose()), (25, stand_pose()), (49, squat_pose()), (73, stand_pose()), (97, stand_pose())], "target": (0.08, 0.08, 0.91), "camera": (3.4, -4.3, 2.00)},
    "reverse-lunge": {"poses": [(1, stand_pose()), (25, stand_pose()), (49, lunge_pose()), (73, stand_pose()), (97, stand_pose())], "target": (0.06, 0.08, 0.90), "camera": (3.6, -4.4, 2.00)},
    "incline-pushup": {"poses": [(1, incline_pose()), (25, incline_pose()), (49, incline_pose(True)), (73, incline_pose()), (97, incline_pose())], "target": (0, 0, 0.58), "camera": (4.0, -3.0, 1.50), "prop": "bench"},
    "glute-bridge": {"poses": [(1, bridge_pose()), (25, bridge_pose()), (49, bridge_pose(True)), (73, bridge_pose()), (97, bridge_pose())], "target": (0, 0, 0.42), "camera": (3.9, -2.9, 1.32), "prop": "mat", "look": "up"},
    "plank-rotation": {"poses": [(1, high_plank_pose()), (25, high_plank_pose()), (49, high_plank_pose(True)), (73, high_plank_pose()), (97, high_plank_pose())], "target": (0, 0, 0.55), "camera": (4.0, -3.0, 1.46), "prop": "mat"},
    "forearm-plank": {"poses": [(1, forearm_plank_pose()), (25, forearm_plank_pose(True)), (49, forearm_plank_pose()), (73, forearm_plank_pose(True)), (97, forearm_plank_pose())], "target": (0, 0, 0.48), "camera": (4.0, -2.9, 1.38), "prop": "mat"},
}


def material(name, color, roughness=0.62, metallic=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return mat


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def world_point(pose, key):
    forward, side, z = pose[key]
    return Vector((-side * SCALE, -forward * SCALE, z * SCALE))


def leg_point(pose, key):
    pelvis = pose["pelvis"]
    point = pose[key]
    base = world_point(pose, "pelvis")
    forward = point[0] - pelvis[0]
    side = point[1] - pelvis[1]
    absolute_z = point[2] * SCALE
    return Vector((base.x - side * 0.56, base.y - forward * 0.56, absolute_z))


def add_cube(name, location, scale, mat, bevel=0.06):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new("Soft edges", "BEVEL")
    modifier.width = bevel
    modifier.segments = 3
    return obj


def dress_coach(body):
    body.data.materials[0] = material("Relay lashes", (0.008, 0.004, 0.002, 1), 0.78)
    body.data.materials[2] = material("Relay pupils", (0.004, 0.003, 0.002, 1), 0.38)
    body.data.materials[3] = material("Relay eye whites", (0.82, 0.78, 0.68, 1), 0.44)
    body.data.materials[4] = material("Relay cornea", (0.72, 0.68, 0.58, 1), 0.30)
    body.data.materials[5] = material("Relay brown irises", (0.10, 0.035, 0.012, 1), 0.36)
    shirt = material("Relay compression shirt", (0.009, 0.012, 0.016, 1), 0.54)
    shorts = material("Relay training shorts", (0.005, 0.006, 0.008, 1), 0.62)
    sock = material("Warm white socks", (0.74, 0.75, 0.71, 1), 0.78)
    lime = material("Relay lime trainers", (0.50, 0.96, 0.025, 1), 0.48)
    sole = material("Relay orange soles", (0.96, 0.28, 0.035, 1), 0.64)
    hair = material("Dark brown hair", (0.018, 0.007, 0.003, 1), 0.82)
    for mat in (shirt, shorts, sock, lime, sole, hair):
        body.data.materials.append(mat)
    indices = {"shirt": len(body.data.materials) - 6, "shorts": len(body.data.materials) - 5, "sock": len(body.data.materials) - 4, "lime": len(body.data.materials) - 3, "sole": len(body.data.materials) - 2, "hair": len(body.data.materials) - 1}
    group_names = {group.index: group.name for group in body.vertex_groups}
    for polygon in body.data.polygons:
        center = sum((body.data.vertices[index].co for index in polygon.vertices), Vector()) / len(polygon.vertices)
        scores = {}
        for index in polygon.vertices:
            for assignment in body.data.vertices[index].groups:
                name = group_names.get(assignment.group, "")
                scores[name] = scores.get(name, 0.0) + assignment.weight
        dominant = max(scores, key=scores.get) if scores else ""
        if dominant == "head" and center.z > 1.74:
            polygon.material_index = indices["hair"]
        elif dominant.startswith(("spine", "breast", "clavicle")) or (dominant.startswith("upperarm") and center.z > 1.34):
            polygon.material_index = indices["shirt"]
        elif dominant == "pelvis" or (dominant.startswith("thigh") and center.z > 0.69):
            polygon.material_index = indices["shorts"]
        elif dominant.startswith("calf") and center.z < 0.30:
            polygon.material_index = indices["sock"]
        elif dominant.startswith(("foot", "toes")):
            polygon.material_index = indices["sole" if center.z < 0.045 else "lime"]


def move_control(rig, name, target, frame):
    control = rig.pose.bones[name]
    matrix = control.matrix.copy()
    matrix.translation = target
    control.matrix = matrix
    control.keyframe_insert("location", frame=frame)


def rotate_control(rig, name, angle, frame):
    control = rig.pose.bones[name]
    control.rotation_mode = "XYZ"
    control.rotation_euler.x = angle
    control.keyframe_insert("rotation_euler", frame=frame)


def keyframe_pose(scene, rig, pose, frame, look="forward"):
    scene.frame_set(frame)
    move_control(rig, "IK_control_hip_pos", world_point(pose, "pelvis"), frame)
    for side in ("L", "R"):
        suffix = side.lower()
        ankle = leg_point(pose, f"ankle_{suffix}")
        knee = leg_point(pose, f"knee_{suffix}")
        elbow = world_point(pose, f"elbow_{suffix}")
        wrist = world_point(pose, f"wrist_{suffix}")
        move_control(rig, f"IK_control_ft_{side}", ankle, frame)
        move_control(rig, f"IK_control_kn_{side}", knee, frame)
        move_control(rig, f"IK_control_a_{side}", wrist, frame)
        move_control(rig, f"IK_control_ebw_{side}", elbow, frame)

    pelvis, chest = pose["pelvis"], pose["chest"]
    vertical = chest[2] - pelvis[2]
    if abs(vertical) < 0.02:
        vertical = 0.02 if vertical >= 0 else -0.02
    lean = math.atan2(chest[0] - pelvis[0], vertical)
    rotate_control(rig, "IK_control_lsp", lean * 0.72, frame)
    rotate_control(rig, "IK_control_usp", lean, frame)
    head = world_point(pose, "head")
    look_target = head + (Vector((0, 0, 1.0)) if look == "up" else Vector((0, -1.0, 0.04)))
    move_control(rig, "IK_control_hd", look_target, frame)


def setup_scene(name, config):
    bpy.ops.wm.open_mainfile(filepath=str(BASE_AVATAR))
    for object_name in ("Cube", "Light", "Camera"):
        obj = bpy.data.objects.get(object_name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)
    scene = bpy.context.scene
    body = bpy.data.objects["m_ca01"]
    rig = bpy.data.objects["m_ca01_skeleton"]
    rig.hide_render = True
    for modifier in body.modifiers:
        if modifier.type == "SUBSURF":
            modifier.levels = 1
            modifier.render_levels = 1
    dress_coach(body)

    scene.frame_start = 1
    scene.frame_end = END_FRAME
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 540
    scene.render.resolution_percentage = 100
    scene.render.fps = SOURCE_FPS
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"
    frames = FRAME_DIR / name
    frames.mkdir(parents=True, exist_ok=True)
    for stale_frame in frames.glob("frame_*.png"):
        stale_frame.unlink()
    scene.render.filepath = str(frames / "frame_")
    scene.world.color = (0.38, 0.30, 0.22)
    if scene.world.use_nodes:
        background = scene.world.node_tree.nodes.get("Background")
        background.inputs["Color"].default_value = (0.22, 0.16, 0.105, 1)
        background.inputs["Strength"].default_value = 0.72

    studio = material("Warm seamless studio", (0.72, 0.61, 0.47, 1), 0.78)
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
    bpy.context.object.data.materials.append(studio)
    add_cube("Studio backdrop", (0, 3.4, 3.5), (15.0, 0.08, 3.5), studio, 0.05)
    if config.get("prop") == "mat":
        add_cube("Training mat", (0, 0, 0.045), (0.82, 1.30, 0.045), material("Training mat", (0.08, 0.085, 0.075, 1), 0.86), 0.08)
    elif config.get("prop") == "bench":
        bench = material("Bench", (0.06, 0.055, 0.05, 1), 0.76)
        add_cube("Bench pad", (0, -0.62, 0.54), (0.42, 0.33, 0.10), bench, 0.09)
        add_cube("Bench stem", (0, -0.62, 0.28), (0.08, 0.08, 0.23), bench, 0.04)
        add_cube("Bench foot", (0, -0.62, 0.08), (0.32, 0.12, 0.06), bench, 0.04)

    bpy.ops.object.light_add(type="AREA", location=(-3.0, -4.5, 5.5))
    key = bpy.context.object
    key.data.energy = 950
    key.data.shape = "DISK"
    key.data.size = 4.0
    key.data.color = (1.0, 0.70, 0.44)
    look_at(key, config["target"])
    bpy.ops.object.light_add(type="AREA", location=(3.8, -2.0, 3.5))
    fill = bpy.context.object
    fill.data.energy = 700
    fill.data.size = 3.0
    fill.data.color = (0.76, 0.85, 1.0)
    look_at(fill, config["target"])
    bpy.ops.object.light_add(type="AREA", location=(-2.0, 2.4, 3.6))
    rim = bpy.context.object
    rim.data.energy = 900
    rim.data.size = 2.5
    rim.data.color = (0.67, 1.0, 0.22)
    look_at(rim, config["target"])

    bpy.ops.object.camera_add(location=config["camera"])
    camera = bpy.context.object
    camera.data.lens = 66
    look_at(camera, config["target"])
    scene.camera = camera

    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    for source_frame, pose in config["poses"]:
        frame = int(round(1 + (source_frame - 1) * 0.5))
        keyframe_pose(scene, rig, pose, frame, config.get("look", "forward"))
    bpy.ops.object.mode_set(mode="OBJECT")
    scene.frame_set(25)
    return scene


def render_exercise(name, config, poster_only=False):
    print(f"RELAY_RENDER_START {name}", flush=True)
    scene = setup_scene(name, config)
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    POSTER_DIR.mkdir(parents=True, exist_ok=True)
    if not poster_only:
        bpy.ops.render.render(animation=True)
        ffmpeg = next((ROOT / ".video-tools" / "imageio_ffmpeg" / "binaries").glob("ffmpeg*.exe"))
        subprocess.run([
            str(ffmpeg), "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(SOURCE_FPS),
            "-i", str(FRAME_DIR / name / "frame_%04d.png"), "-an", "-c:v", "libx264",
            "-vf", f"minterpolate=fps={OUTPUT_FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,format=yuv420p",
            "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            str(VIDEO_DIR / f"{name}.mp4"),
        ], check=True)
    scene.frame_set(25)
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 92
    scene.render.filepath = str(POSTER_DIR / f"{name}.jpg")
    bpy.ops.render.render(write_still=True)
    print(f"RELAY_RENDER_DONE {name}", flush=True)


def main():
    requested = None
    poster_only = False
    if "--" in sys.argv:
        trailing = sys.argv[sys.argv.index("--") + 1:]
        requested = trailing[0] if trailing else None
        poster_only = "poster" in trailing[1:]
    selected = {requested: EXERCISES[requested]} if requested else EXERCISES
    for exercise_name, config in selected.items():
        render_exercise(exercise_name, config, poster_only)


if __name__ == "__main__":
    main()
