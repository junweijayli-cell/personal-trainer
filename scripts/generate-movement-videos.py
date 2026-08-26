"""Generate Relay's original, looping movement-guide MP4 assets."""

from __future__ import annotations

import math
import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "videos"
WIDTH, HEIGHT = 720, 540
SCALE = 2
FPS = 24
SECONDS = 4
INK = "#171a17"
MUTED = "#777b73"
PAPER = "#eeece4"
CARD = "#f8f7f2"
LIME = "#d9ff43"
ORANGE = "#ff6737"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts" / name), size * SCALE)


def point(a: tuple[float, float], b: tuple[float, float], phase: float) -> tuple[int, int]:
    eased = phase * phase * (3 - 2 * phase)
    return (int((a[0] + (b[0] - a[0]) * eased) * SCALE), int((a[1] + (b[1] - a[1]) * eased) * SCALE))


def pos(value: tuple[float, float]) -> tuple[int, int]:
    return int(value[0] * SCALE), int(value[1] * SCALE)


def line(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], fill: str = INK, width: int = 18) -> None:
    draw.line(points, fill=fill, width=width * SCALE, joint="curve")
    radius = width * SCALE // 2
    for x, y in points[1:-1]:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def joint(draw: ImageDraw.ImageDraw, value: tuple[int, int], color: str = LIME, radius: int = 8) -> None:
    x, y = value
    r = radius * SCALE
    draw.ellipse((x - r, y - r, x + r, y + r), fill=color, outline=INK, width=3 * SCALE)


def head(draw: ImageDraw.ImageDraw, center: tuple[int, int]) -> None:
    x, y = center
    r = 25 * SCALE
    draw.ellipse((x - r, y - r, x + r, y + r), fill=INK)
    draw.arc((x - 13 * SCALE, y - 4 * SCALE, x + 13 * SCALE, y + 15 * SCALE), 15, 155, fill=LIME, width=3 * SCALE)


def base_frame(title: str, cue: str, index: int, phase: float) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (WIDTH * SCALE, HEIGHT * SCALE), PAPER)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((28 * SCALE, 25 * SCALE, 692 * SCALE, 515 * SCALE), radius=28 * SCALE, fill=CARD, outline="#d8d5cb", width=2 * SCALE)
    draw.rounded_rectangle((52 * SCALE, 49 * SCALE, 91 * SCALE, 88 * SCALE), radius=12 * SCALE, fill=LIME)
    draw.text((64 * SCALE, 57 * SCALE), f"{index:02d}", font=font(13, True), fill=INK)
    draw.text((108 * SCALE, 48 * SCALE), title.upper(), font=font(19, True), fill=INK)
    draw.text((109 * SCALE, 73 * SCALE), cue, font=font(11), fill=MUTED)
    draw.rounded_rectangle((554 * SCALE, 52 * SCALE, 666 * SCALE, 80 * SCALE), radius=14 * SCALE, outline="#c7c5bc", width=2 * SCALE)
    draw.text((576 * SCALE, 59 * SCALE), "FORM LOOP", font=font(9, True), fill=MUTED)
    draw.line((73 * SCALE, 472 * SCALE, 647 * SCALE, 472 * SCALE), fill="#d7d3c8", width=3 * SCALE)
    progress = 95 + int(520 * phase)
    draw.rounded_rectangle((95 * SCALE, 490 * SCALE, 625 * SCALE, 498 * SCALE), radius=4 * SCALE, fill="#ddd9cf")
    draw.rounded_rectangle((95 * SCALE, 490 * SCALE, progress * SCALE, 498 * SCALE), radius=4 * SCALE, fill=ORANGE)
    return image, draw


def squat(draw: ImageDraw.ImageDraw, phase: float) -> None:
    hip = point((370, 280), (335, 355), phase)
    shoulder = point((365, 190), (340, 265), phase)
    head_center = point((370, 140), (350, 215), phase)
    knee = point((370, 380), (430, 390), phase)
    ankle = point((370, 460), (390, 460), phase)
    elbow = point((340, 230), (300, 285), phase)
    wrist = point((310, 260), (270, 270), phase)
    draw.ellipse((300 * SCALE, 455 * SCALE, 445 * SCALE, 478 * SCALE), fill="#dedbd2")
    line(draw, [shoulder, hip], width=24)
    line(draw, [shoulder, elbow, wrist], width=14)
    line(draw, [hip, knee, ankle], width=20)
    line(draw, [ankle, pos((430, 460))], width=12)
    head(draw, head_center)
    joint(draw, knee)
    joint(draw, hip, ORANGE)


def reverse_lunge(draw: ImageDraw.ImageDraw, phase: float) -> None:
    hip = point((380, 275), (385, 345), phase)
    shoulder = point((380, 185), (380, 250), phase)
    head_center = point((380, 135), (380, 200), phase)
    front_knee = point((405, 375), (445, 390), phase)
    front_ankle = pos((430, 460))
    rear_knee = point((350, 375), (315, 420), phase)
    rear_ankle = point((335, 460), (245, 460), phase)
    elbow = point((350, 230), (350, 295), phase)
    wrist = point((400, 245), (410, 305), phase)
    draw.ellipse((220 * SCALE, 455 * SCALE, 490 * SCALE, 478 * SCALE), fill="#dedbd2")
    line(draw, [shoulder, hip], width=24)
    line(draw, [shoulder, elbow, wrist], width=14)
    line(draw, [hip, front_knee, front_ankle], width=20)
    line(draw, [hip, rear_knee, rear_ankle], fill="#3e423e", width=18)
    line(draw, [front_ankle, pos((475, 460))], width=11)
    line(draw, [rear_ankle, pos((285, 460))], fill="#3e423e", width=11)
    head(draw, head_center)
    joint(draw, front_knee)
    joint(draw, rear_knee, ORANGE)


def incline_pushup(draw: ImageDraw.ImageDraw, phase: float) -> None:
    hand = pos((235, 265))
    shoulder = point((315, 285), (265, 310), phase)
    hip = point((420, 355), (395, 370), phase)
    ankle = pos((575, 445))
    elbow = point((270, 270), (250, 335), phase)
    head_center = point((285, 245), (235, 275), phase)
    draw.rounded_rectangle((160 * SCALE, 270 * SCALE, 215 * SCALE, 465 * SCALE), radius=10 * SCALE, fill="#c8c4b8")
    draw.rounded_rectangle((145 * SCALE, 245 * SCALE, 235 * SCALE, 280 * SCALE), radius=10 * SCALE, fill=ORANGE)
    draw.ellipse((525 * SCALE, 443 * SCALE, 630 * SCALE, 472 * SCALE), fill="#dedbd2")
    line(draw, [shoulder, hip, ankle], width=23)
    line(draw, [shoulder, elbow, hand], width=14)
    line(draw, [ankle, pos((620, 445))], width=11)
    head(draw, head_center)
    joint(draw, elbow)
    joint(draw, shoulder, ORANGE)


def glute_bridge(draw: ImageDraw.ImageDraw, phase: float) -> None:
    shoulder = pos((255, 390))
    hip = point((380, 420), (400, 330), phase)
    knee = pos((525, 365))
    ankle = pos((575, 460))
    head_center = pos((205, 405))
    draw.ellipse((155 * SCALE, 444 * SCALE, 630 * SCALE, 476 * SCALE), fill="#dedbd2")
    line(draw, [shoulder, hip], width=25)
    line(draw, [hip, knee, ankle], width=21)
    line(draw, [shoulder, pos((345, 455))], fill="#3e423e", width=13)
    line(draw, [ankle, pos((625, 460))], width=11)
    head(draw, head_center)
    joint(draw, hip, ORANGE)
    joint(draw, knee)


def bird_dog(draw: ImageDraw.ImageDraw, phase: float) -> None:
    shoulder = pos((335, 320))
    hip = pos((435, 340))
    support_hand = pos((330, 450))
    support_knee = pos((455, 450))
    moving_hand = point((315, 430), (175, 290), phase)
    moving_foot = point((475, 445), (620, 325), phase)
    head_center = pos((285, 285))
    draw.ellipse((260 * SCALE, 445 * SCALE, 520 * SCALE, 477 * SCALE), fill="#dedbd2")
    line(draw, [shoulder, hip], width=25)
    line(draw, [shoulder, support_hand], fill="#3e423e", width=16)
    line(draw, [hip, support_knee], fill="#3e423e", width=19)
    line(draw, [shoulder, moving_hand], width=15)
    line(draw, [hip, moving_foot], width=19)
    head(draw, head_center)
    joint(draw, shoulder)
    joint(draw, hip, ORANGE)


def forearm_plank(draw: ImageDraw.ImageDraw, phase: float) -> None:
    shoulder = pos((305, 300))
    hip = point((425, 360), (425, 330), phase)
    ankle = pos((585, 390))
    elbow = pos((300, 405))
    wrist = pos((245, 405))
    head_center = pos((255, 265))
    draw.ellipse((210 * SCALE, 398 * SCALE, 640 * SCALE, 474 * SCALE), fill="#dedbd2")
    draw.line((shoulder[0], shoulder[1], ankle[0], ankle[1]), fill=ORANGE, width=5 * SCALE)
    line(draw, [shoulder, hip, ankle], width=24)
    line(draw, [shoulder, elbow, wrist], width=15)
    line(draw, [ankle, pos((630, 405))], width=11)
    head(draw, head_center)
    joint(draw, hip, ORANGE)
    joint(draw, shoulder)


EXERCISES = [
    ("squat", "Bodyweight squat", "Knees follow toes · whole foot down", squat),
    ("reverse-lunge", "Reverse lunge", "Step back · lower straight down", reverse_lunge),
    ("incline-pushup", "Incline push-up", "Body moves as one strong line", incline_pushup),
    ("glute-bridge", "Glute bridge", "Drive through feet · finish with glutes", glute_bridge),
    ("bird-dog", "Bird dog", "Reach long · keep hips quiet", bird_dog),
    ("forearm-plank", "Forearm plank", "Ribs tucked · hips in line", forearm_plank),
]


def generate(ffmpeg: str, slug: str, title: str, cue: str, renderer, index: int) -> None:
    target = OUTPUT / f"{slug}.mp4"
    command = [
        ffmpeg, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}",
        "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-profile:v", "main",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-crf", "22", str(target),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    assert process.stdin is not None
    for frame_index in range(FPS * SECONDS):
        time = frame_index / (FPS * SECONDS - 1)
        phase = (1 - math.cos(time * math.tau)) / 2
        image, draw = base_frame(title, cue, index, time)
        renderer(draw, phase)
        image = image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
        process.stdin.write(image.tobytes())
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError(f"ffmpeg failed for {slug}")


if __name__ == "__main__":
    import imageio_ffmpeg

    OUTPUT.mkdir(parents=True, exist_ok=True)
    executable = imageio_ffmpeg.get_ffmpeg_exe()
    for number, exercise in enumerate(EXERCISES, 1):
        generate(executable, *exercise, number)
        print(OUTPUT / f"{exercise[0]}.mp4")
