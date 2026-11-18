import * as T from 'three';
import { bake, beam, box, clay, pebbleGeometry, place, random, tau } from './craft';
import { groundHeight } from './terrain';

const plaster = clay('#f4e4bc');
const wood = clay('#674636');
const floorStone = clay('#948a75');
const bark = clay('#796047');
const blackGreen = clay('#38513f');
const tileColors = ['#a74836', '#b8543b', '#bb5d42', '#a44534', '#c36a4c'].map(color => clay(color));
const vector = (x: number, y: number, z: number) => new T.Vector3(x, y, z);

export function makeCottage(scene: T.Scene) {
  const house = new T.Group();
  house.position.set(-2.47, groundHeight(-2.47, -0.91) - 0.1, -0.91);
  house.rotation.y = 0.16;
  const siding = clay('#e3c99e');
  const door = clay('#3e7167');
  const brass = clay('#cb9d55');
  const chimney = clay('#ad705e');
  const sill = clay('#d3ac7a');
  const glass = clay('#53858a', { roughness: .35, emissive: '#ff9a36', emissiveIntensity: 0 });

  box(house, floorStone, 0, 0.10, 0, 2.21, 0.33, 1.64);
  box(house, plaster, 0, 0.92, 0, 2.10, 1.48, 1.52);
  for (const x of [-1.025, 1.025]) {
    for (const z of [-0.77, 0.77]) box(house, siding, x, 0.91, z, 0.115, 1.5, 0.095);
  }
  const gable = new T.Shape();
  gable.moveTo(-1.05, 1.65);
  gable.lineTo(1.05, 1.65);
  gable.lineTo(0, 2.53);
  gable.closePath();
  const gableGeometry = new T.ExtrudeGeometry(gable, { depth: 1.52, bevelEnabled: false });
  gableGeometry.translate(0, 0, -0.76);
  place(house, gableGeometry, plaster);
  for (let i = 0; i < 7; i++) {
    box(house, siding, 0, .36 + i * .17, -.762, 1.95, .014, .014);
    box(house, siding, 0, .36 + i * .17, .762, 1.95, .014, .014);
    box(house, siding, 1.052, .36 + i * .17, 0, .015, .015, 1.43);
    box(house, siding, -1.052, .36 + i * .17, 0, .015, .015, 1.43);
  }
  const rng = random(550);
  for (const side of [-1, 1]) {
    const pitch = -side * 0.681;
    box(house, wood, side * .60, 2.09, 0, 1.60, .13, 1.88).rotation.z = pitch;
    for (let row = 0; row < 7; row++) {
      const distance = 0.108 + row * 0.168;
      const zOffset = row % 2 === 0 ? 0.047 : 0;
      for (let column = 0; column < 10; column++) {
        const z = -0.846 + column * .179 + zOffset;
        const tile = box(house, tileColors[Math.floor(rng() * tileColors.length)],
          side * distance, 2.64 - 0.81 * distance, z, .231, .048 + rng() * .023, .175);
        tile.rotation.z = pitch;
      }
    }
    for (const z of [-0.94, 0.94]) {
      beam(house, wood, vector(0, 2.62, z), vector(side * 1.24, 1.60, z), 0.11);
    }
  }

  const ridge = new T.CylinderGeometry(.065, .065, 1.94, 9);
  place(house, ridge, tileColors[0], 0, 2.667).rotation.x = Math.PI / 2;
  box(house, chimney, -.61, 2.42, -.38, .31, .84, .32);
  for (let i = 0; i < 3; i++) box(house, sill, -.61, 2.37 + i * .137, -.38, .32, .018, .33);
  box(house, tileColors[0], -.61, 2.855, -.38, .39, .093, .39);
  box(house, wood, -.61, 2.907, -.38, .24, .017, .24);

  function windowPanel(parent: T.Group, x: number, y: number, z: number, w: number, h: number) {
    box(parent, wood, x, y, z, w + .105, h + .105, .08);
    box(parent, glass, x, y, z + .047, w, h, .035);
    box(parent, sill, x, y, z + .068, .034, h, .028);
    box(parent, sill, x, y + .018, z + .068, w, .031, .028);
    box(parent, sill, x, y - h * .5 - .037, z + .065, w + .15, .068, .18);
  }

  windowPanel(house, -.62, 1.04, .779, .43, .493);
  windowPanel(house, .643, 1.04, .779, .43, .493);
  windowPanel(house, 0, 1.99, .779, .25, .249);
  const rear = new T.Group();
  rear.rotation.y = Math.PI;
  house.add(rear);
  windowPanel(rear, -.28, 1.02, .779, .48, .45);
  const side = new T.Group();
  side.rotation.y = Math.PI / 2;
  house.add(side);
  windowPanel(side, -.055, 1.06, 1.062, .58, .55);

  box(house, wood, .035, .669, .80, .57, .98, .11);
  box(house, door, .035, .661, .865, .424, .84, .048);
  for (let i = -1; i <= 1; i++) box(house, blackGreen, .035 + i * .105, .66, .895, .012, .75, .012);
  place(house, new T.SphereGeometry(.037, 8, 6), brass, .176, .656, .911);
  box(house, floorStone, .03, .166, .98, .78, .18, .43);
  box(house, floorStone, .03, .075, 1.21, .81, .13, .22);

  const stems = clay('#648847');
  const petals = clay('#dd7958');
  const leaf = pebbleGeometry(17);
  for (const x of [-.63, .63]) {
    box(house, wood, x, .745, .888, .53, .15, .19);
    for (let i = -2; i <= 2; i++) {
      place(house, leaf, stems, x + i * .094, .827, .95, .065, .095, .062);
      place(house, leaf, petals, x + i * .094, .893 + rng() * .035, .96, .047, .042, .049);
    }
  }

  bake(house);
  const lamp = new T.PointLight('#ffb150', 0, 4.2, 1.9);
  lamp.position.set(0, .94, 1.22);
  house.add(lamp);
  scene.add(house);
  return { house, glass, lamp, darkGlass: new T.Color('#53858a'), litGlass: new T.Color('#ffb254') };
}

export function makeMill(scene: T.Scene) {
  const mill = new T.Group();
  mill.position.set(2.48, groundHeight(2.48, -2.10) - 0.05, -2.10);
  mill.rotation.y = .32;
  const roof = clay('#b9864e', { flatShading: true });
  const linen = clay('#f5dfb5', { side: T.DoubleSide });
  const iron = clay('#433e38');
  place(mill, new T.CylinderGeometry(.78, .84, .21, 12), floorStone, 0, .04, 0);
  place(mill, new T.CylinderGeometry(.50, .69, 1.88, 14), plaster, 0, .91, 0);
  place(mill, new T.CylinderGeometry(.54, .55, .10, 14), wood, 0, 1.84, 0);
  place(mill, new T.SphereGeometry(1, 14, 8, 0, tau, 0, Math.PI / 2), roof,
    0, 1.89, 0, .65, .64, .66);
  box(mill, wood, -.05, .45, .59, .41, .72, .15).rotation.x = -.09;
  box(mill, blackGreen, -.05, .42, .688, .29, .60, .05).rotation.x = -.09;
  box(mill, wood, .39, 1.22, .392, .24, .32, .075).rotation.y = .7;
  box(mill, blackGreen, .428, 1.22, .434, .141, .217, .04).rotation.y = .7;
  box(mill, floorStone, -.05, .095, .76, .49, .14, .28);
  bake(mill);

  const rotor = new T.Group();
  rotor.position.set(0, 1.98, .79);
  rotor.rotation.z = .28;
  const axle = new T.CylinderGeometry(.15, .18, .4, 12);
  place(rotor, axle, wood).rotation.x = Math.PI / 2;
  place(rotor, new T.SphereGeometry(.119, 9, 6), iron, 0, 0, .23);
  for (let i = 0; i < 4; i++) {
    const arm = new T.Group();
    arm.rotation.z = i * Math.PI / 2;
    rotor.add(arm);
    box(arm, wood, 0, .84, 0, .093, 1.68, .101);
    box(arm, linen, -.233, 1.179, .005, .36, .92, .035);
    box(arm, wood, -.415, 1.18, .016, .043, .96, .072);
    for (let rung = 0; rung < 5; rung++) {
      box(arm, wood, -.229, .73 + rung * .226, .034, .42, .033, .043);
    }
  }
  bake(rotor);
  mill.add(rotor);
  scene.add(mill);
  return rotor;
}

export function makeTrees(scene: T.Scene) {
  const rng = random(812);
  const foliage = ['#4c744c', '#628d56', '#789b61', '#5a875e', '#769957'].map(color => clay(color, { flatShading: true }));
  const trunk = new T.CylinderGeometry(.67, 1, 1, 7);
  const crown = [pebbleGeometry(18, 1), pebbleGeometry(90, 1), pebbleGeometry(37, 1)];
  const trees = [
    [-4.03, -2.37, 1.96], [-3.01, -2.87, 1.67], [-0.96, -2.89, 2.34],
    [-0.18, -3.42, 1.59], [0.92, -2.48, 1.4], [-4.82, -0.79, 1.81],
    [-4.57, 0.48, 1.21], [-3.41, 1.77, 1.49], [-3.9, 2.36, 1.05],
    [3.73, -2.27, 1.37], [4.46, -1.33, 1.18], [4.59, 0.0, 0.8],
    [3.66, 2.63, 0.95], [-1.47, 3.16, .91],
  ];
  return trees.map(([x, z, height], index) => {
    const tree = new T.Group();
    tree.position.set(x, groundHeight(x, z) - .045, z);
    const radius = height * (.22 + rng() * .095);
    place(tree, trunk, bark, 0, height * .33, 0, radius * .17, height * .66, radius * .17);
    if (index % 3 === 0 || index === 7) {
      const green = foliage[index % foliage.length];
      place(tree, crown[0], green, 0, height * .76, 0, radius, height * .35, radius * .94);
      place(tree, crown[1], green, -radius * .48, height * .66, .041, radius * .7, height * .24, radius * .76);
      place(tree, crown[2], foliage[(index + 1) % foliage.length], radius * .48, height * .79,
        -radius * .28, radius * .72, height * .24, radius * .68);
    } else {
      for (let tier = 0; tier < 3; tier++) {
        const width = radius * (1.07 - tier * .24);
        const tip = new T.CylinderGeometry(.018, width, height * (.46 - tier * .034), 8, 2);
        const position = tip.attributes.position;
        for (let i = 0; i < position.count; i++) {
          const px = position.getX(i);
          const py = position.getY(i);
          const pz = position.getZ(i);
          const wave = 1 + .11 * Math.sin(px * 24 + pz * 27 + tier);
          position.setXYZ(i, px * wave + py * .15, py + px * .12 - pz * .09, pz * wave);
        }
        tip.computeVertexNormals();
        place(tree, tip, foliage[(index + tier) % foliage.length], 0, height * (.43 + tier * .215), 0)
          .rotation.y = rng() * tau;
      }
    }
    bake(tree);
    scene.add(tree);
    return { tree, phase: rng() * tau, flexibility: 0.72 + rng() * .4 };
  });
}

export function makeClouds(scene: T.Scene, material: T.MeshStandardMaterial) {
  const rng = random(24);
  const puff = new T.IcosahedronGeometry(1, 3);
  return [
    [-8.3, 2.2, -4.4, .91], [1.25, 3.98, -8.5, .83],
    [6.55, 2.65, -3.3, 1.03], [6.1, -1.1, 3.4, .59], [-5.7, -2.61, 2.6, .73],
  ].map(([x, y, z, scale]) => {
    const cloud = new T.Group();
    for (let i = 0; i < 6; i++) {
      const height = (0.28 + Math.sin(i / 5 * Math.PI) * .28) * scale;
      place(cloud, puff, material, (i - 2.5) * .38 * scale, height * rng() * .61, (rng() - .5) * .26,
        (.48 + rng() * .22) * scale, height, (.48 + rng() * .3) * scale);
    }
    bake(cloud);
    cloud.children.forEach(object => { object.castShadow = false; object.receiveShadow = false; });
    cloud.position.set(x, y, z);
    scene.add(cloud);
    return { cloud, x, y, z, phase: rng() * tau };
  });
}
