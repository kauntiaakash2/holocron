/** CPU projection of the actual procedural mesh. No WebGL/browser/CDN required. */
import * as THREE from "three";
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { HolocronModel } from "../components/holocron/HolocronModel";
const model = new HolocronModel();
model.root.rotation.set(-0.23, 0.55, 0.15);
model.root.updateMatrixWorld(true);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(5.9, 4.35, 7.7);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
const triangles: {
  depth: number;
  path: string;
  color: string;
  opacity: number;
}[] = [];
const key = new THREE.Vector3(-4, 7, 8).normalize(),
  fill = new THREE.Vector3(5, 0, -5).normalize();
const a = new THREE.Vector3(),
  b = new THREE.Vector3(),
  c = new THREE.Vector3(),
  normal = new THREE.Vector3(),
  center = new THREE.Vector3();
let meshCount = 0;
model.root.traverse((object) => {
  if (
    !(object instanceof THREE.Mesh) ||
    object === model.inner ||
    Array.isArray(object.material)
  )
    return;
  meshCount++;
  const material = object.material;
  if (!(material instanceof THREE.MeshStandardMaterial)) return;
  const positions = object.geometry.getAttribute("position"),
    index = object.geometry.index;
  for (let i = 0; i < (index ? index.count : positions.count); i += 3) {
    a.fromBufferAttribute(positions, index ? index.getX(i) : i).applyMatrix4(
      object.matrixWorld,
    );
    b.fromBufferAttribute(
      positions,
      index ? index.getX(i + 1) : i + 1,
    ).applyMatrix4(object.matrixWorld);
    c.fromBufferAttribute(
      positions,
      index ? index.getX(i + 2) : i + 2,
    ).applyMatrix4(object.matrixWorld);
    normal
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize();
    center
      .copy(a)
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);
    if (
      normal.dot(new THREE.Vector3().subVectors(camera.position, center)) <= 0
    )
      continue;
    const depth = center.clone().applyMatrix4(camera.matrixWorldInverse).z;
    const color = material.color
      .clone()
      .multiplyScalar(
        0.42 +
          Math.max(0, normal.dot(key)) * 0.9 +
          Math.max(0, normal.dot(fill)) * 0.4,
      );
    color.add(
      material.emissive.clone().multiplyScalar(material.emissiveIntensity),
    );
    const points = [a, b, c].map((p) => {
      p.project(camera);
      return `${((p.x + 1) * 320).toFixed(2)} ${((1 - p.y) * 320).toFixed(2)}`;
    });
    triangles.push({
      depth,
      path: `M${points.join("L")}Z`,
      color: "#" + color.getHexString(),
      opacity: material.opacity,
    });
  }
});
triangles.sort((a, b) => a.depth - b.depth);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">${triangles.map((t) => `<path d="${t.path}" fill="${t.color}" fill-opacity="${t.opacity}" stroke="${t.color}" stroke-width=".25" stroke-opacity="${t.opacity}"/>`).join("")}</svg>`;
await sharp(Buffer.from(svg), { density: 144 })
  .resize(640, 640)
  .webp({ quality: 90, alphaQuality: 100 })
  .toFile("public/media/holocron-fallback.webp");
await writeFile(
  "public/media/holocron-fallback.json",
  JSON.stringify(
    {
      source: "holocron-web.zip/holocron-web/holocron.js",
      method:
        "CPU-shaded projection of the integrated procedural model; not a WebGL render",
      size: [640, 640],
      staticMeshes: meshCount,
      visibleTriangles: triangles.length,
    },
    null,
    2,
  ) + "\n",
);
model.dispose();
console.log(
  `Derived fallback from ${meshCount} batched static meshes and ${triangles.length} visible triangles.`,
);
