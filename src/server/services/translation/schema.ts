import { zSafe } from "@/utils";
import { z } from "zod";

export enum Translation_Backends {
  azure = "azure",
  openai = "openai",
}
const zodTranslation_Backends = z.nativeEnum(Translation_Backends);

export const Service_Translation_Schema = z.object({
  backend: zSafe(zodTranslation_Backends, Translation_Backends.azure),
  autoStart: zSafe(z.coerce.boolean(), false),
  inputField: zSafe(z.coerce.boolean(), true),
  azure: z.object({
    key: zSafe(z.coerce.string(), ""),
    location: zSafe(z.coerce.string(), ""),
    languageFrom: zSafe(z.coerce.string(), "en"),
    language: zSafe(z.coerce.string(), "en"),
    profanity: zSafe(z.enum(["Deleted", "Marked", "NoAction"]), "Marked"),
    interim: zSafe(z.coerce.boolean(), true)
  }).default({}),
  openai: z.object({
    apiKey: zSafe(z.coerce.string(), ""),
    baseUrl: zSafe(z.coerce.string(), "https://api.openai.com/v1"),
    model: zSafe(z.coerce.string(), "gpt-4o-mini"),
    language: zSafe(z.coerce.string(), "en"),
    interim: zSafe(z.coerce.boolean(), true),
    systemPrompt: zSafe(z.coerce.string(), "You are a professional, authentic machine translation engine.")
  }).default({})
}).default({});

export type Translation_State = z.infer<typeof Service_Translation_Schema>;
