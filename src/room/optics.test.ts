import { describe, expect, it } from 'vitest';
import { focusDistance, verticalFov } from './optics';

const tan = (degrees: number) => Math.tan((degrees * Math.PI) / 360);

describe('the room camera', () => {
  it('fits the sensor to the longer side of the picture, as Blender does', () => {
    // the seat: 25 mm on a 36 mm sensor. Wide, the width spans the sensor.
    expect(tan(verticalFov(25, 36, 16 / 9)) * (16 / 9)).toBeCloseTo(18 / 25, 10);
    // tall, the height does, so a phone held upright sees no less of the room's height
    expect(tan(verticalFov(25, 36, 9 / 16))).toBeCloseTo(18 / 25, 10);
    expect(verticalFov(25, 36, 1)).toBeCloseTo(verticalFov(25, 36, 0.5), 10);
  });

  it('stands where the screen fills the given share of the tighter side', () => {
    const [width, height, fill] = [0.697, 0.392, 0.88];
    // a wide picture: the screen's height is the limit only when the picture is wider than the screen
    const wide = 2.4;
    const fovWide = verticalFov(25, 36, wide);
    const far = focusDistance(width, height, fovWide, wide, fill);
    expect(height / (2 * far * tan(fovWide))).toBeCloseTo(fill, 10);
    expect(width / (2 * far * tan(fovWide) * wide)).toBeLessThan(fill);
    // a tall picture: the width is
    const tall = 390 / 844;
    const fovTall = verticalFov(25, 36, tall);
    const near = focusDistance(width, height, fovTall, tall, fill);
    expect(width / (2 * near * tan(fovTall) * tall)).toBeCloseTo(fill, 10);
    expect(height / (2 * near * tan(fovTall))).toBeLessThan(fill);
  });
});
