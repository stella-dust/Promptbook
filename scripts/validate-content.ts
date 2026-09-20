import { readEntries } from "../src/lib/content";
console.log(
  `Validated ${readEntries().length} canonical records (templates and prototype excluded)`,
);
