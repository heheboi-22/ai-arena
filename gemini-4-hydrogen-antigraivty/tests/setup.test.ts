import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

describe('project setup', () => {
  it('loads Three.js cleanly', () => {
    const vec = new THREE.Vector3(1, 2, 3);
    expect(vec.length()).toBeGreaterThan(3);
  });
});
