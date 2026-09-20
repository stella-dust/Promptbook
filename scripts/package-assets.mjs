import fs from "node:fs/promises";
const stage = "dist/.package";
await fs.mkdir(stage, { recursive: true });
const names = await fs.readdir("dist");
for (const name of names)
  if (name !== ".package") await fs.rename(`dist/${name}`, `${stage}/${name}`);
await fs.mkdir("dist/projects/promptbook", { recursive: true });
for (const name of await fs.readdir(stage))
  await fs.rename(`${stage}/${name}`, `dist/projects/promptbook/${name}`);
await fs.rmdir(stage);
await fs.copyFile("public/_headers", "dist/_headers");
await fs.copyFile("dist/projects/promptbook/404.html", "dist/404.html");
console.log("Packaged static assets at /projects/promptbook");

await fs.mkdir("worker/generated", { recursive: true });
for (const [route, name] of [
  ["", "index"],
  ["/new", "new"],
  ["/edit", "edit"],
]) {
  await fs.copyFile(
    `dist/projects/promptbook/admin${route}/index.html`,
    `worker/generated/admin-${name}.html`,
  );
}
await fs.rm("dist/projects/promptbook/admin", { recursive: true });
console.log("Management HTML embedded into authenticated Worker only");
