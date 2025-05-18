import { tts } from "edge-tts";
import { isEmptyValue } from "../../../../utils";
import { TTS_State } from "../schema";
import { ITTSReceiver, ITTSService } from "../types";

export class TTS_EdgeService implements ITTSService {
  constructor(private bindings: ITTSReceiver) {}

  dispose(): void {}

  get state() {
    return window.ApiServer.state.services.tts.data.edge;
  }

  start(state: TTS_State): void {
    if (Object.values(this.state).some(isEmptyValue))
      return this.bindings.onStop("Options missing");
    this.bindings.onStart();
  }

  async play(value: string) {
    try {
      const buffer = await tts(value, {
        voice: this.state.voice,
        rate: this.state.rate,
        volume: this.state.volume,
      });

      window.ApiServer.sound.enqueueVoiceClip(buffer.buffer, {
        volume: parseFloat(this.state.volume) ?? 1,
        rate: parseFloat(this.state.rate) ?? 1,
        device_name: this.state.device,
      });
    } catch (e: any) {
      this.bindings.onStop(e?.message);
    }
  }

  stop(): void {
    this.bindings.onStop();
  }
}
