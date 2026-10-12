import { z } from "zod";

export const databaseUrlSchema = z
  .url({ protocol: /^postgres(ql)?$/ })
  .default("postgresql://postgres:postgres@localhost:15432/tacto");
