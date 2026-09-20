import fs from "node:fs/promises";
import Ajv from "ajv/dist/2020.js";
import formats from "ajv-formats";
import standalone from "ajv/dist/standalone/index.js";
import { compile } from "json-schema-to-typescript";
for (const name of ["entry", "submission"]) {
  const schema = JSON.parse(
    await fs.readFile(`contracts/${name}.schema.json`, "utf8"),
  );
  const ajv = new Ajv({
    code: { source: true, esm: true },
    strict: false,
    allErrors: true,
  });
  formats(ajv);
  await fs.mkdir("src/generated", { recursive: true });
  await fs.writeFile(
    `src/generated/${name}-validator.js`,
    standalone(ajv, ajv.compile(schema))
      .replaceAll(
        'require("ajv/dist/runtime/ucs2length").default',
        "ucs2length",
      )
      .replaceAll(
        'require("ajv-formats/dist/formats").fullFormats',
        "fullFormats",
      )
      .replace(
        /^/,
        '// @ts-nocheck\nimport ucs2Module from "ajv/dist/runtime/ucs2length.js";\nconst ucs2length=typeof ucs2Module === "function" ? ucs2Module : ucs2Module.default;\nimport { fullFormats } from "ajv-formats/dist/formats.js";\n',
      ),
  );
  await fs.writeFile(
    `src/generated/${name}.d.ts`,
    await compile(schema, "Entry", {
      ignoreMinAndMaxItems: true,
      bannerComment:
        "/* Generated from contracts/entry.schema.json. Do not edit. */",
    }),
  );
  console.log("Generated contract validator and types");
}
