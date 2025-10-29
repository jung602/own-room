import * as THREE from 'three'

// Room 상수들
export const ROOM_SIZE = 2.0          // 방 크기
export const WALL_THICKNESS = 0.01    // 벽/바닥 두께
export const CORNER_RADIUS = 0.3      // 모서리 라운드 반경
export const BLEND_STRENGTH = 0.15    // smooth union/subtract 블렌드 강도
export const MASK_THICKNESS = 1.0     // 마스킹 박스 두께
export const MASK_OFFSET = 0.5        // 마스킹 박스 오프셋 (벽/바닥으로부터의 거리)

// 5개의 평면(바닥 + 4개 벽)의 초기 위치
export const initialPlanePositions = [
  new THREE.Vector3(0, -2, 0),     // 바닥
  new THREE.Vector3(0, 0.10, 2.15), // 앞 벽 (dy:+0.10, dz:+0.15)
  new THREE.Vector3(0, 0.10, -2.15),// 뒤 벽 (dy:+0.10, dz:-0.15)
  new THREE.Vector3(-2.15, 0.10, 0),// 왼쪽 벽 (dx:-0.15, dy:+0.10)
  new THREE.Vector3(2.15, 0.10, 0), // 오른쪽 벽 (dx:+0.15, dy:+0.10)
]

// Vertex Shader
export const wallVertexShader = `
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vViewDir = worldPos.xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

// Fragment Shader
export const wallFragmentShader = `
  uniform float iTime;
  uniform vec2 iResolution;
  uniform vec3 uFloorPos;
  uniform vec3 uFrontWallPos;
  uniform vec3 uBackWallPos;
  uniform vec3 uLeftWallPos;
  uniform vec3 uRightWallPos;
  uniform float uFloorVisible;
  uniform float uFrontWallVisible;
  uniform float uBackWallVisible;
  uniform float uLeftWallVisible;
  uniform float uRightWallVisible;
  uniform vec3 uCameraPos;
  uniform sampler2D uTexture;
  uniform float uTexRepeat;
  
  // Sphere uniforms
  uniform int uSphereCount;
  uniform vec3 uSpherePositions[10];
  uniform float uSphereRadii[10];
  uniform float uSphereOperations[10]; // 0.0 = union, 1.0 = subtract
  
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  
  // SDF for thin box with rounded edges (모서리가 둥근 박스)
  float sdRoundBox(vec3 p, vec3 b, float r) {
    vec3 d = abs(p) - b;
    return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0)) - r;
  }
  
  // SDF for regular box (일반 박스)
  float sdBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
  }
  
  // SDF for sphere
  float sdSphere(vec3 p, float r) {
    return length(p) - r;
  }
  
  // Simple Union (without blending)
  float opUnion(float d1, float d2) {
    return min(d1, d2);
  }
  
  // Smooth Union
  float opSmoothUnion(float d1, float d2, float k) {
    float h = max(k - abs(d1 - d2), 0.0) / k;
    return min(d1, d2) - h * h * k * 0.25;
  }
  
  // Smooth Subtraction
  float opSmoothSubtraction(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
    return mix(d2, -d1, h) + k * h * (1.0 - h);
  }
  
  // Masking boxes map (바깥쪽 마스킹 박스들만 - 벽/바닥과 분리)
  float mapMaskingBoxes(vec3 pos) {
    // 아래 상수들은 walls.ts에서 export된 값들과 동일해야 함
    float roomSize = 2.0;    // ROOM_SIZE
    float maskThickness = 1.0; // MASK_THICKNESS
    float maskOffset = 0.5;   // MASK_OFFSET
    
    // 바닥 아래 마스킹 박스
    vec3 floorMaskP = pos - (uFloorPos - vec3(0.0, maskThickness * 0.5 + maskOffset, 0.0));
    float floorMask = sdBox(floorMaskP, vec3(roomSize, maskThickness, roomSize));
    
    // 앞 벽 바깥 마스킹 박스
    vec3 frontMaskP = pos - (uFrontWallPos + vec3(0.0, 0.0, maskThickness * 0.5 + maskOffset));
    float frontMask = sdBox(frontMaskP, vec3(roomSize, roomSize, maskThickness));
    
    // 뒤 벽 바깥 마스킹 박스
    vec3 backMaskP = pos - (uBackWallPos - vec3(0.0, 0.0, maskThickness * 0.5 + maskOffset));
    float backMask = sdBox(backMaskP, vec3(roomSize, roomSize, maskThickness));
    
    // 왼쪽 벽 바깥 마스킹 박스
    vec3 leftMaskP = pos - (uLeftWallPos - vec3(maskThickness * 0.5 + maskOffset, 0.0, 0.0));
    float leftMask = sdBox(leftMaskP, vec3(maskThickness, roomSize, roomSize));
    
    // 오른쪽 벽 바깥 마스킹 박스
    vec3 rightMaskP = pos - (uRightWallPos + vec3(maskThickness * 0.5 + maskOffset, 0.0, 0.0));
    float rightMask = sdBox(rightMaskP, vec3(maskThickness, roomSize, roomSize));
    
    // 모든 마스킹 박스를 union
    float d = floorMask;
    d = min(d, frontMask);
    d = min(d, backMask);
    d = min(d, leftMask);
    d = min(d, rightMask);
    
    return d;
  }
  
  // Scene Map
  float map(vec3 pos) {
    // 아래 상수들은 walls.ts에서 export된 값들과 동일해야 함
    float thickness = 0.01;  // WALL_THICKNESS
    float roomSize = 2.0;    // ROOM_SIZE
    float radius = 0.3;     // CORNER_RADIUS
    float largeValue = 1e10; // 렌더링하지 않을 때 사용할 큰 값
    
    // 바닥 (모서리가 둥근 얇은 수평 박스)
    vec3 floorP = pos - uFloorPos;
    float floor = uFloorVisible > 0.5 
      ? sdRoundBox(floorP, vec3(roomSize, thickness, roomSize), radius) 
      : largeValue;
    
    // 앞 벽 (모서리가 둥근 얇은 수직 박스)
    vec3 frontP = pos - uFrontWallPos;
    float frontWall = uFrontWallVisible > 0.5 
      ? sdRoundBox(frontP, vec3(roomSize, roomSize, thickness), radius) 
      : largeValue;
    
    // 뒤 벽
    vec3 backP = pos - uBackWallPos;
    float backWall = uBackWallVisible > 0.5 
      ? sdRoundBox(backP, vec3(roomSize, roomSize, thickness), radius) 
      : largeValue;
    
    // 왼쪽 벽
    vec3 leftP = pos - uLeftWallPos;
    float leftWall = uLeftWallVisible > 0.5 
      ? sdRoundBox(leftP, vec3(thickness, roomSize, roomSize), radius) 
      : largeValue;
    
    // 오른쪽 벽
    vec3 rightP = pos - uRightWallPos;
    float rightWall = uRightWallVisible > 0.5 
      ? sdRoundBox(rightP, vec3(thickness, roomSize, roomSize), radius) 
      : largeValue;
    
    // 모든 평면을 smooth union으로 합치기
    float k = 0.15;  // BLEND_STRENGTH - 블렌드 강도 (값이 클수록 더 부드러운 모서리)
    float d = floor;
    d = opSmoothUnion(d, frontWall, k);
    d = opSmoothUnion(d, backWall, k);
    d = opSmoothUnion(d, leftWall, k);
    d = opSmoothUnion(d, rightWall, k);
    
    // 먼저 벽/바닥만 저장
    float walls = d;
    
    // Add spheres
    for(int i = 0; i < 10; i++) {
      if(i >= uSphereCount) break;
      
      vec3 sphereP = pos - uSpherePositions[i];
      float sphere = sdSphere(sphereP, uSphereRadii[i]);
      
      // Check operation: 0.0 = union, 1.0 = subtract
      if(uSphereOperations[i] < 0.5) {
        // Union
        d = opSmoothUnion(d, sphere, k);
      } else {
        // Subtract
        d = opSmoothSubtraction(sphere, d, k);
      }
    }
    
    // 마스킹 박스로 벽/바닥이 아닌 모든 요소를 smooth subtract
    // 벽/바닥은 유지하고, sphere 등 추가 요소만 마스킹 박스로 잘라냄
    float maskBoxes = mapMaskingBoxes(pos);
    
    // d에서 walls를 빼면 sphere만 남음
    // sphere 부분에 대해서만 마스킹 박스로 smooth subtract
    if(d < walls) {
      // 추가된 요소가 있을 때만 마스킹 박스로 smooth subtract
      d = opSmoothSubtraction(maskBoxes, d, k);
    }
    
    return d;
  }
  
  // Calculate Normal
  vec3 calcNormal(vec3 pos) {
    const float ep = 0.0001;
    vec2 e = vec2(1.0, -1.0) * 0.5773;
    return normalize(
      e.xyy * map(pos + e.xyy * ep) +
      e.yyx * map(pos + e.yyx * ep) +
      e.yxy * map(pos + e.yxy * ep) +
      e.xxx * map(pos + e.xxx * ep)
    );
  }
  
  // Soft Shadow
  float calcSoftshadow(vec3 ro, vec3 rd, float tmin, float tmax, float k) {
    float res = 1.0;
    float t = tmin;
    for(int i = 0; i < 50; i++) {
      float h = map(ro + rd * t);
      res = min(res, k * h / t);
      t += clamp(h, 0.02, 0.20);
      if(res < 0.005 || t > tmax) break;
    }
    return clamp(res, 0.0, 1.0);
  }
  
  void main() {
    // Ray setup
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vViewDir);
    
    float t = 0.0;
    float cameraDistance = length(uCameraPos);
    float tMax = max(50.0, cameraDistance * 2.0); // 카메라가 멀어질수록 더 멀리까지 레이마칭
    
    // Room과 sphere를 레이마칭 (마스킹 박스는 이미 map() 함수 내에서 처리됨)
    for(int i = 0; i < 128; i++) {
      vec3 p = ro + rd * t;
      float h = map(p);
      if(h < 0.001 || t > tMax) break;
      t += h;
    }
    
    // 배경은 투명하게
    vec3 col = vec3(1.0);
    float alpha = 0.0;
    
    if(t < tMax) {
      vec3 pos = ro + rd * t;
      vec3 nor = calcNormal(pos);
      vec3 lig = normalize(vec3(1.0, 1.5, -0.5));
      
      // 기존 렌더링 로직
      // Diffuse lighting
      float dif = clamp(dot(nor, lig), 0.0, 1.0);
      
      // Soft shadow
      float sha = calcSoftshadow(pos + nor * 0.001, lig, 0.01, 3.0, 16.0);
      
      // Ambient
      float amb = 0.5 + 0.5 * nor.y;
      
      // Planar UV based on dominant axis of normal
      vec2 uv;
      vec3 an = abs(nor);
      if(an.y > an.x && an.y > an.z) {
        uv = pos.xz; // floor/ceiling
      } else if(an.x > an.z) {
        uv = pos.zy; // left/right
      } else {
        uv = pos.xy; // front/back
      }
      // Normalize and tile
      uv = uv * (uTexRepeat * 0.1);
      uv = fract(uv);
      vec3 tex = texture2D(uTexture, uv).rgb;
      
      // Final color
      col = tex * (amb * 0.5 + dif * sha);
      
      // Gamma correction
      col = sqrt(col);
      
      alpha = 1.0;
    }
    
    gl_FragColor = vec4(col, alpha);
  }
`

