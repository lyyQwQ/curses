import {
  IServiceInterface,
  ServiceNetworkState,
  TextEvent,
  TextEventSource
} from "@/types";
import { serviceSubscibeToInput } from "@/utils";
import { toast } from "react-toastify";
import { proxy } from "valtio";
import { Translation_Backends } from "./schema";
import { Translation_AzureService } from "./services/azure";
import { Translation_OpenAIService } from "./services/openai";
import {
  ITranslationReceiver,
  ITranslationService,
  ITranslationServiceConstructor,
} from "./types";

// network jitter
// track events with ++
// skip late resps

// todo constructor
const backends: {
  [k in Translation_Backends]: ITranslationServiceConstructor;
} = {
  [Translation_Backends.azure]: Translation_AzureService,
  [Translation_Backends.openai]: Translation_OpenAIService,
};

class Service_Translation implements IServiceInterface, ITranslationReceiver {
  lib = proxy<{ azure: { label: string; value: string }[] }>({
    azure: [],
  });

  serviceState = proxy({
    status: ServiceNetworkState.disconnected,
    error: "",
  });
  #id = 0;

  #serviceInstance!: ITranslationService;
  get data() {
    return window.ApiServer.state.services.translation.data;
  }

  async loadAzure() {
    try {
      const azureResp = await fetch(
        "https://api.cognitive.microsofttranslator.com/languages?api-version=3.0"
      );
      const json: {
        translation: {
          [key: string]: {
            name: string;
            nativeName: string;
            dir: string;
          };
        };
      } = await azureResp.json();
      if (!json || !("translation" in json)) return;
      this.lib.azure = Object.keys(json.translation).map((k) => ({
        label: json.translation[k].nativeName,
        value: k,
      }));
    } catch (error) {}
  }

  async loadOpenAI() {
    const openaiResp = await fetch("https://api.openai.com/v1/models");
    const json = await openaiResp.json();
    console.log(json);
  }

  init(): void {
    this.loadAzure();
    this.loadOpenAI();
    if (this.data.autoStart)
      this.start();
      
    window.ApiShared.pubsub.subscribeText(
      TextEventSource.stt,
      (e) => e && this.translate(e)
    );

    serviceSubscibeToInput(
      window.ApiServer.state.services.translation.data,
      "inputField",
      (e) => e && this.translate(e)
    );
  }

  #setStatus(value: ServiceNetworkState) {
    this.serviceState.status = value;
  }

  // #region ITranslationReceiver
  onStart(): void {
    this.#setStatus(ServiceNetworkState.connected);
  }
  onStop(error: string): void {
    if (error) {
      toast(error, { type: "error", autoClose: false });
      this.serviceState.error = error;
    }
    this.#setStatus(ServiceNetworkState.disconnected);
  }
  onTranslation(id: number, e: TextEvent, value: string): void {
    // ignore late results
    if (this.#id - 1 !== id) return;
    window.ApiShared.pubsub.publishText(TextEventSource.translation, {
      value,
      type: e.type,
    });
  }
  // #endregion

  stop() {
    if (!this.#serviceInstance) return;
    this.#serviceInstance.stop();
  }
  start() {
    this.stop();
    this.serviceState.error = "";

    let backend = this.data.backend;
    if (!(backend in backends)) {
      return;
    }
    this.#serviceInstance = new backends[backend](this);

    if (!this.#serviceInstance) return;
    this.#setStatus(ServiceNetworkState.connecting);
    this.#serviceInstance.start(this.data);
  }

  translate(text: TextEvent) {
    if (
      !this.#serviceInstance ||
      this.serviceState.status !== ServiceNetworkState.connected
    )
      return;
    this.#serviceInstance.translate(this.#id, text);
    this.#id++;
  }
}

export default Service_Translation;
