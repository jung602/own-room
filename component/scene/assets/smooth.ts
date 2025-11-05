// Smooth blend operations for SDF (GLSL)

// Smooth Union - 두 도형을 부드럽게 합침
export const smoothUnionCode = `
  // Smooth Union
  float opSmoothUnion(float d1, float d2, float k) {
    float h = max(k - abs(d1 - d2), 0.0) / k;
    return min(d1, d2) - h * h * k * 0.25;
  }
`

// Smooth Subtraction - 하나의 도형을 다른 도형에서 부드럽게 뺌
export const smoothSubtractionCode = `
  // Smooth Subtraction
  float opSmoothSubtraction(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
    return mix(d2, -d1, h) + k * h * (1.0 - h);
  }
`

