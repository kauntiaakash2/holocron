import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Point2 = readonly number[];
type Point3 = [number, number, number];

/** Port of holocron-web.zip/holocron.js. Approximation, not screen-validated. */
export class HolocronModel {
  readonly root = new THREE.Group();
  readonly materials = this.makeMaterials();
  inner: THREE.Mesh | null = null;
  private readonly cache = new Map<string, THREE.BufferGeometry>();
  private disposed = false;

  constructor() {
    try {
      this.construct();
      this.batchStaticGeometry();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  private geometry(key: string, create: () => THREE.BufferGeometry) {
    let geometry = this.cache.get(key);
    if (!geometry) {
      geometry = create();
      this.cache.set(key, geometry);
    }
    return geometry;
  }
  private mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Object3D,
    x = 0,
    y = 0,
    z = 0,
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  private bar(
    parent: THREE.Object3D,
    a: Point3,
    b: Point3,
    radius: number,
    material: THREE.Material,
    radial = 8,
  ) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b);
    const direction = new THREE.Vector3().subVectors(end, start);
    const mesh = this.mesh(
      this.geometry(
        `bar:${radius}:${radial}`,
        () => new THREE.CylinderGeometry(radius, radius, 1, radial),
      ),
      material,
      parent,
    );
    mesh.scale.y = direction.length();
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    return mesh;
  }
  private panel(
    parent: THREE.Object3D,
    points: Point2[],
    depth: number,
    material: THREE.Material,
    z: number,
  ) {
    const geometry = this.geometry(
      `panel:${JSON.stringify(points)}:${depth}`,
      () => {
        const shape = new THREE.Shape();
        shape.moveTo(points[0][0], points[0][1]);
        points.slice(1).forEach((p) => shape.lineTo(p[0], p[1]));
        shape.closePath();
        return new THREE.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: true,
          bevelSize: 0.014,
          bevelThickness: 0.012,
          bevelSegments: 2,
          steps: 1,
        });
      },
    );
    return this.mesh(geometry, material, parent, 0, 0, z);
  }
  private polyRail(
    parent: THREE.Object3D,
    coords: Point2[],
    radius: number,
    material: THREE.Material,
    z: number,
  ) {
    for (let i = 0; i < coords.length; i++) {
      const a = coords[i],
        b = coords[(i + 1) % coords.length];
      this.bar(parent, [a[0], a[1], z], [b[0], b[1], z], radius, material);
    }
  }
  makeMaterials() {
    const metal = (c: number, roughness = 0.32) =>
      new THREE.MeshStandardMaterial({
        color: c,
        metalness: 0.92,
        roughness,
        envMapIntensity: 1,
      });
    return {
      gold: metal(0x967048),
      lightGold: metal(0xc09c65, 0.26),
      trim: metal(0x695033, 0.36),
      shade: metal(0x362b27, 0.46),
      core: new THREE.MeshPhysicalMaterial({
        color: 0x073b58,
        roughness: 0.21,
        metalness: 0.16,
        clearcoat: 0.95,
        clearcoatRoughness: 0.16,
        transparent: true,
        opacity: 0.94,
        side: THREE.DoubleSide,
      }),
      crystal: new THREE.MeshPhysicalMaterial({
        color: 0x0b6286,
        emissive: 0x064e76,
        emissiveIntensity: 0.34,
        metalness: 0.08,
        roughness: 0.22,
        transparent: true,
        opacity: 0.79,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      glow: new THREE.MeshBasicMaterial({
        color: 0x1bc9ed,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      darkBlue: new THREE.MeshStandardMaterial({
        color: 0x072333,
        emissive: 0x041d2b,
        emissiveIntensity: 0.22,
        roughness: 0.22,
        metalness: 0.12,
      }),
    };
  }
  construct() {
    const M = this.materials;
    this.mesh(
      this.geometry(
        "BoxGeometry(2.42,2.42,2.42)",
        () => new THREE.BoxGeometry(2.42, 2.42, 2.42),
      ),
      M.darkBlue,
      this.root,
    );
    this.mesh(
      this.geometry(
        "BoxGeometry(2.33,2.33,2.33)",
        () => new THREE.BoxGeometry(2.33, 2.33, 2.33),
      ),
      M.core,
      this.root,
    );
    this.inner = this.mesh(
      this.geometry(
        "IcosahedronGeometry(.76,1)",
        () => new THREE.IcosahedronGeometry(0.76, 1),
      ),
      M.glow,
      this.root,
    );
    this.inner.scale.set(1, 1, 1);
    for (let f = 0; f < 6; f++) {
      const g = new THREE.Group();
      this.root.add(g);
      // Faces are modeled outward along local +Z; orient their complete assemblies.
      if (f === 0) g.position.z = 1.23;
      if (f === 1) {
        g.position.z = -1.23;
        g.rotation.y = Math.PI;
      }
      if (f === 2) {
        g.position.x = 1.23;
        g.rotation.y = Math.PI / 2;
      }
      if (f === 3) {
        g.position.x = -1.23;
        g.rotation.y = -Math.PI / 2;
      }
      if (f === 4) {
        g.position.y = 1.23;
        g.rotation.x = -Math.PI / 2;
      }
      if (f === 5) {
        g.position.y = -1.23;
        g.rotation.x = Math.PI / 2;
      }
      // Recessed blue field and inner border.
      this.mesh(
        this.geometry(
          "PlaneGeometry(2.22,2.22)",
          () => new THREE.PlaneGeometry(2.22, 2.22),
        ),
        M.crystal,
        g,
        0,
        0,
        0.018,
      );
      const outer = [
        [-1.15, -1.15],
        [1.15, -1.15],
        [1.15, 1.15],
        [-1.15, 1.15],
      ];
      this.polyRail(g, outer, 0.077, M.gold, 0.18);
      const inner = [
        [-1.045, -1.045],
        [1.045, -1.045],
        [1.045, 1.045],
        [-1.045, 1.045],
      ];
      this.polyRail(g, inner, 0.027, M.lightGold, 0.19);
      // Face corner structural triangles; solid inset fills are real extruded geometry.
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) {
          const p = [
            [sx * 1.08, sy * 1.08],
            [sx * 0.46, sy * 1.08],
            [sx * 1.08, sy * 0.46],
          ];
          this.panel(g, p, 0.05, M.trim, 0.09);
          const q = [
            [sx * 1.01, sy * 1.01],
            [sx * 0.62, sy * 1.01],
            [sx * 1.01, sy * 0.62],
          ];
          this.panel(g, q, 0.018, M.gold, 0.157);
          this.bar(
            g,
            [sx * 0.44, sy * 1.065, 0.17],
            [sx * 1.065, sy * 0.44, 0.17],
            0.038,
            M.lightGold,
          );
        }
      // Distinctive 45-degree square lattice around the central circular roundel.
      const diamond = [
        [0, 1.005],
        [1.005, 0],
        [0, -1.005],
        [-1.005, 0],
      ];
      this.polyRail(g, diamond, 0.075, M.gold, 0.232);
      const diamondInner = [
        [0, 0.88],
        [0.88, 0],
        [0, -0.88],
        [-0.88, 0],
      ];
      this.polyRail(g, diamondInner, 0.026, M.lightGold, 0.249);
      // Four divided blue triangular windows within the diamond.
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const v = [
          [0.2, 0.2],
          [0.72, 0.1],
          [0.47, 0.47],
        ];
        const pts = v.map(([x, y]): Point2 => [
          x * Math.cos(a) - y * Math.sin(a),
          x * Math.sin(a) + y * Math.cos(a),
        ]);
        this.panel(g, pts, 0.012, M.core, 0.057);
      }
      // Central circular motif includes actual concentric raised rings.
      this.mesh(
        this.geometry(
          "CircleGeometry(.515,72)",
          () => new THREE.CircleGeometry(0.515, 72),
        ),
        M.crystal,
        g,
        0,
        0,
        0.169,
      );
      this.mesh(
        this.geometry(
          "RingGeometry(.44,.50,80)",
          () => new THREE.RingGeometry(0.44, 0.5, 80),
        ),
        M.shade,
        g,
        0,
        0,
        0.202,
      );
      this.mesh(
        this.geometry(
          "TorusGeometry(.535,.074,10,88)",
          () => new THREE.TorusGeometry(0.535, 0.074, 10, 88),
        ),
        M.gold,
        g,
        0,
        0,
        0.265,
      );
      this.mesh(
        this.geometry(
          "TorusGeometry(.405,.023,8,88)",
          () => new THREE.TorusGeometry(0.405, 0.023, 8, 88),
        ),
        M.lightGold,
        g,
        0,
        0,
        0.276,
      );
      this.mesh(
        this.geometry(
          "CircleGeometry(.355,72)",
          () => new THREE.CircleGeometry(0.355, 72),
        ),
        M.darkBlue,
        g,
        0,
        0,
        0.203,
      );
      this.mesh(
        this.geometry(
          "CircleGeometry(.325,72)",
          () => new THREE.CircleGeometry(0.325, 72),
        ),
        M.crystal,
        g,
        0,
        0,
        0.211,
      );
      this.mesh(
        this.geometry(
          "TorusGeometry(.255,.013,8,80)",
          () => new THREE.TorusGeometry(0.255, 0.013, 8, 80),
        ),
        M.trim,
        g,
        0,
        0,
        0.222,
      );
      // Four restrained reinforcing details, without invented sci-fi runes.
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        this.bar(
          g,
          [0.59 * Math.cos(a), 0.59 * Math.sin(a), 0.271],
          [0.78 * Math.cos(a), 0.78 * Math.sin(a), 0.27],
          0.027,
          M.trim,
        );
      }
      // Interior corner relief, behind primary lattice.
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) {
          this.bar(
            g,
            [sx * 0.91, sy * 0.88, 0.13],
            [sx * 0.82, sy * 0.92, 0.13],
            0.02,
            M.lightGold,
          );
        }
    }
    // Corner posts and edges establish coherent silhouette between adjacent faces.
    for (const axis of ["x", "y", "z"])
      for (const u of [-1, 1])
        for (const v of [-1, 1]) {
          const a: Point3 = [0, 0, 0],
            b: Point3 = [0, 0, 0];
          const rem = ["x", "y", "z"].filter((s) => s !== axis);
          a["xyz".indexOf(axis)] = -1.2;
          b["xyz".indexOf(axis)] = 1.2;
          a["xyz".indexOf(rem[0])] = u * 1.2;
          b["xyz".indexOf(rem[0])] = u * 1.2;
          a["xyz".indexOf(rem[1])] = v * 1.2;
          b["xyz".indexOf(rem[1])] = v * 1.2;
          this.bar(this.root, a, b, 0.085, M.gold, 8);
        }
    for (const x of [-1.2, 1.2])
      for (const y of [-1.2, 1.2])
        for (const z of [-1.2, 1.2]) {
          this.mesh(
            this.geometry(
              "OctahedronGeometry(.16,0)",
              () => new THREE.OctahedronGeometry(0.16, 0),
            ),
            M.lightGold,
            this.root,
            x,
            y,
            z,
          );
        }
  }
  /** One static mesh per material, excluding the animated internal core. */
  private batchStaticGeometry() {
    this.root.updateMatrixWorld(true);
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const oldMeshes: THREE.Mesh[] = [];
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object === this.inner) return;
      if (Array.isArray(object.material))
        throw new Error("Unexpected material array");
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      // Extrusions are non-indexed; normalize for safe merging with rails/rings.
      const normalized = geometry.index ? geometry.toNonIndexed() : geometry;
      if (normalized !== geometry) geometry.dispose();
      const bucket = buckets.get(object.material) || [];
      bucket.push(normalized);
      buckets.set(object.material, bucket);
      oldMeshes.push(object);
    });
    for (const [material, geometries] of buckets) {
      const merged = mergeGeometries(geometries, false);
      geometries.forEach((g) => g.dispose());
      if (!merged) throw new Error("Could not batch holocron geometry");
      this.mesh(merged, material, this.root);
    }
    oldMeshes.forEach((mesh) => mesh.removeFromParent());
    const innerGeometry = this.inner?.geometry;
    for (const geometry of this.cache.values())
      if (geometry !== innerGeometry) geometry.dispose();
    this.cache.clear();
    // Empty source face groups are no longer needed after baking their transforms.
    for (const object of [...this.root.children])
      if (object instanceof THREE.Group) this.root.remove(object);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const geometries = new Set<THREE.BufferGeometry>(this.cache.values());
    this.cache.clear();
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) geometries.add(object.geometry);
    });
    geometries.forEach((geometry) => geometry.dispose());
    Object.values(this.materials).forEach((material) => material.dispose());
    this.root.clear();
  }
}
