// The room camera's arithmetic, apart from three.js so it can be tested (optics.test.ts).

/**
 * The vertical field of view, in degrees, of a lens (focal length and sensor width in
 * millimetres) on a picture `aspect` wide for its height. Blender fits the sensor's width to
 * the picture's longer side, and so does this, so the page frames the room as scene.py does.
 */
export function verticalFov(lens: number, sensor: number, aspect: number): number {
  const half = sensor / 2 / lens;
  return (2 * Math.atan(aspect >= 1 ? half / aspect : half) * 180) / Math.PI;
}

/**
 * How far in front of a flat screen (`width` by `height`, in metres) the camera stands for the
 * screen to take `fill` of the picture's tighter side: its height in a wide picture, its width
 * in a tall one. `fov` is the camera's vertical field of view in degrees.
 */
export function focusDistance(width: number, height: number, fov: number, aspect: number, fill: number): number {
  const tanV = Math.tan((fov * Math.PI) / 360);
  return Math.max(height / 2 / tanV, width / 2 / (tanV * aspect)) / fill;
}
