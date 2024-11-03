import { TextEvent, TextEventType } from "@/types";
import { isObjectVaid } from "@/utils";
import { Translation_State } from "../schema";
import {
  ITranslationReceiver,
  ITranslationService
} from "../types";


export class Translation_OpenAIService implements ITranslationService {
  constructor(private receiver: ITranslationReceiver) {}

  dispose(): void {}

  start(state: Translation_State): void {
    if (!isObjectVaid(this.state))
      return this.receiver.onStop("[OpenAI translator] 选项缺失");
    this.receiver.onStart();
  }

  get state() {
    return window.ApiServer.state.services.translation.data.openai;
  }

  async translate(id: number, text: TextEvent) {
    if (text.type === TextEventType.interim && !this.state.interim)
      return;
    
    const apiKey = this.state.apiKey;
    const baseUrl = this.state.baseUrl || "https://api.openai.com/v1";
    const model = this.state.model || "gpt-4o-mini";

    const endpoint = `${baseUrl}/chat/completions`;
    
    const prompt = `Translate the following source text to ${this.state.language}, Output translation directly without any additional text.\nSource Text: ${text.value}\nTranslated Text:`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: this.state.systemPrompt },
            { role: "user", content: prompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const translatedText = data.choices[0].message.content.trim();

      this.receiver.onTranslation(id, text, translatedText);
    } catch (error) {
      console.error("OpenAI translation error:", error);
    }
  }

  stop(): void {
    this.receiver.onStop();
  }
}
