import {
  ISTTReceiver,
  ISTTService
} from "../types";

import { isEmptyValue } from "../../../../utils";
import { STT_State } from "../schema";


export class STT_OpenaiService implements ISTTService {
  private audioChunks: Blob[] = [];
  private isRecording: boolean = false;
  private mediaRecorder: MediaRecorder | null = null;
  private lastAudioTime: number = 0;
  private silenceTimeoutId: NodeJS.Timeout | null = null;

  constructor(private bindings: ISTTReceiver) {}

  dispose(): void {
    this.stopRecording();
  }

  get state() {
    return window.ApiServer.state.services.stt.data.openai;
  }

  async start(state: STT_State): Promise<void> {
    if (isEmptyValue(this.state.apiKey)) {
      return this.bindings.onStop("[OpenAI STT] 选项缺失");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.isRecording = true;
      this.lastAudioTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          this.lastAudioTime = Date.now();
          this.resetSilenceTimeout();
        }
      };

      this.mediaRecorder.onstop = () => {
        this.sendAudioToOpenAI();
      };

      this.mediaRecorder.start(1000); // 每秒收集一次音频数据
      this.bindings.onStart();

      // 每5秒发送一次音频数据
      setInterval(() => {
        if (this.isRecording) {
          this.sendAudioToOpenAI();
        }
      }, 5000);

      this.resetSilenceTimeout();

    } catch (error) {
      this.bindings.onStop(`[OpenAI STT] ${error}`);
    }
  }

  private resetSilenceTimeout() {
    if (this.silenceTimeoutId) {
      clearTimeout(this.silenceTimeoutId);
    }
    const silenceTimeout = parseInt(this.state.silenceTimeout) * 1000;
    this.silenceTimeoutId = setTimeout(() => {
      if (Date.now() - this.lastAudioTime >= silenceTimeout) {
        this.stop();
      }
    }, silenceTimeout);
  }

  private async sendAudioToOpenAI() {
    if (this.audioChunks.length === 0) return;

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    this.audioChunks = [];

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', this.state.model || 'whisper-1');

    try {
      const response = await fetch(`${this.state.baseUrl || 'https://api.openai.com/v1'}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.state.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.text) {
        this.bindings.onFinal(data.text);
      }
    } catch (error) {
      console.error('[OpenAI STT] Error:', error);
    }
  }

  stop(): void {
    this.stopRecording();
    this.bindings.onStop();
  }

  private stopRecording() {
    this.isRecording = false;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.silenceTimeoutId) {
      clearTimeout(this.silenceTimeoutId);
      this.silenceTimeoutId = null;
    }
  }
}
