import { IServiceInterface, ServiceNetworkState, TextEventType } from "@/types";
import { proxy } from "valtio";
import { subscribeKey } from "valtio/utils";
import { serviceSubscibeToInput, serviceSubscibeToSource } from "../../../utils";
import { isLogin, clearInfo, saveLoginInfo } from "./auth";
import { getLoginUrlApi, getUserInfoApi, validateLoginInfoApi, verifyQrCodeApi } from "./api/bilibili";
import { sendMessageApi } from "./api/live";
import NiceModal from "@ebay/nice-modal-react";
import { toast } from "react-toastify";
import { invoke } from "@tauri-apps/api";
import { listen, Event as TauriEvent, UnlistenFn } from "@tauri-apps/api/event";
import { LOGIN_INFO } from "./schema";
import { WebviewWindow } from '@tauri-apps/api/window';

export class Service_Bilibili implements IServiceInterface {
  constructor() {}

  state = proxy<{
    status: ServiceNetworkState;
    userInfo: any | null;
    qrcodeKey: string;
    qrcodeUrl: string;
    qrcodeStatus: number;
  }>({
    status: ServiceNetworkState.disconnected,
    userInfo: null,
    qrcodeKey: "",
    qrcodeUrl: "",
    qrcodeStatus: 86101
  });

  qrcodeTimer?: NodeJS.Timeout;
  private unlistenChildEvents?: UnlistenFn | null;

  get #state() {
    return window.ApiServer.state.services.bilibili;
  }

  private loginWindow?: WebviewWindow | null;

  private async cleanupLoginWindowResources() {
    console.log("cleanupLoginWindowResources called.");
    if (this.unlistenChildEvents) {
      console.log("Cleaning up bilibili_child_event listener.");
      this.unlistenChildEvents();
      this.unlistenChildEvents = null;
    }
    this.stopQrcodeCheck();
    if (this.loginWindow) {
        console.log("Setting loginWindow to null in cleanupLoginWindowResources.");
        this.loginWindow = null; 
    }
  }

  async init() {
    try {
      console.info("Bilibili service init");
      if(await isLogin()) {
        await this.connect();
      }

      subscribeKey(this.#state.data, "chatEnable" as any, (value) => {
        if (value) {
          if(this.state.userInfo) this.connect();
        } else this.disconnect();
      });

      serviceSubscibeToSource(this.#state.data as any, "chatPostSource", (data) => {
        if (
          this.#state.data.chatPostLive &&
          this.state.status !== ServiceNetworkState.connected
        )
          return;
        if(this.#state.data.chatPostEnable &&
        this.#state.data.chatEnable &&
        this.#state.data.roomId &&
        !this.#state.data.chatPostLive &&
          data?.value &&
          data?.type === TextEventType.final) {
            this.sendMessage(data.value);
          }
      });

      serviceSubscibeToInput(this.#state.data as any, "chatPostInput", (data) => {
        if (
          this.#state.data.chatPostLive &&
          this.state.status !== ServiceNetworkState.connected
        ) {
          return;
        }
        if (!data?.value) {
          return;
        }
        if (data?.type !== TextEventType.final) {
          return;
        }
        if (this.#state.data.chatPostEnable &&
        !this.#state.data.chatPostLive &&
        this.#state.data.chatEnable &&
        this.#state.data.roomId){
          this.sendMessage(data.value);
        }
      });

    } catch (error) {
      console.error("Bilibili service init failed:", error);
      this.state.status = ServiceNetworkState.disconnected;
    }
  }

  async login() {
    try {
      console.info('Bilibili login started');
      toast.info('开始登录B站');

      if (this.unlistenChildEvents) {
        console.log("login(): Found existing unlistenChildEvents, cleaning up before new login attempt.");
        this.unlistenChildEvents();
        this.unlistenChildEvents = null;
      }
            
      if (this.loginWindow) {
        try {
          console.info('Bilibili login window may be open, attempting to set focus.');
          await this.loginWindow.setFocus();
          console.info('Bilibili login window already open, focused.');
          return; 
        } catch (e) {
          console.warn('Failed to focus existing login window, will try to close and reopen.', e);
          try { 
            await this.loginWindow.close(); 
            console.log("Existing login window closed successfully before reopening.");
          } catch (closeError) { 
            console.warn('Error closing previous window instance before reopening', closeError); 
          }
          await this.cleanupLoginWindowResources();
          this.loginWindow = null;
        }
      }

      const resp = await getLoginUrlApi();
      console.info('Login URL response:', JSON.stringify(resp));
      
      if(!resp?.url || !resp?.qrcode_key) {
        console.error('Failed to get login URL or qrcode_key');
        toast.error(`获取登录URL或凭证失败, ${JSON.stringify(resp)}`);
        return;
      }
      
      this.state.qrcodeKey = resp.qrcode_key;
      this.state.qrcodeUrl = resp.url;

      const isDev = import.meta.env.DEV;
      const pageUrl = isDev 
        ? new URL('/oauth_bilibili.html', window.location.origin).toString()
        : 'oauth_bilibili.html';
      
      console.info(`Attempting to open Bilibili login window with URL: ${pageUrl}`);

      this.loginWindow = new WebviewWindow('bilibili_login_auth_window', {
        url: pageUrl,
        title: 'Bilibili 扫码登录',
        width: 400,
        height: 550,
        resizable: false,
        minimizable: true,
        maximizable: false,
        decorations: true,
        center: true,
        alwaysOnTop: false,
      });

      this.unlistenChildEvents = await listen('bilibili_child_event', (event: TauriEvent<any>) => {
        console.log(`Received 'bilibili_child_event'. Window Label: ${event.windowLabel}, Event: ${JSON.stringify(event.payload)}`);

        if (!this.loginWindow || event.windowLabel !== this.loginWindow.label) {
          console.warn(`'bilibili_child_event' ignored: window label mismatch or loginWindow is null. Received: ${event.windowLabel}, Expected: ${this.loginWindow?.label}`);
          return;
        }

        const childEventPayload = event.payload as { type: string, payload?: any };
        console.log(`Processing 'bilibili_child_event' type: ${childEventPayload.type}`);

        switch (childEventPayload.type) {
          case 'ready':
            console.log("'bilibili_child_event:ready' received from login window.");
            if (this.loginWindow && this.state.qrcodeUrl) {
              console.log('Login window is ready, emitting bilibili-init-qrcode with URL:', this.state.qrcodeUrl);
              this.loginWindow.emit('bilibili-init-qrcode', {
                type: 'qrcode',
                url: this.state.qrcodeUrl
              }).then(() => {
                console.info(`QR code emitted to login window after ready signal: ${this.state.qrcodeUrl}`);
                toast.info(`二维码已发送至登录窗口`);
              }).catch(err => {
                console.error('Failed to emit bilibili-init-qrcode after ready signal:', err);
                toast.error('无法发送二维码至已就绪的登录窗口');
              });
            } else {
              let errorMsg = "'bilibili_child_event:ready' received, but cannot send QR code: ";
              if (!this.state.qrcodeUrl) errorMsg += "qrcodeUrl is missing. ";
              if (!this.loginWindow) errorMsg += "loginWindow is missing.";
              console.warn(errorMsg);
              toast.error(errorMsg);
            }
            break;
          case 'refresh_qrcode':
            console.log("'bilibili_child_event:refresh_qrcode' received. Re-initiating login.");
            toast.info('收到刷新二维码请求，正在重新获取...');
            this.login();
            break;
          case 'login_success':
            console.log("'bilibili_child_event:login_success' received with payload:", JSON.stringify(childEventPayload.payload));
            toast.success('登录成功 (来自登录窗口事件)');
            const loginUrl = childEventPayload.payload?.url;
            if (typeof loginUrl !== 'string') {
                console.error('Login success event did not contain a valid URL string in payload.url', childEventPayload.payload);
                toast.error('登录成功，但未能获取到有效的登录信息URL');
                return;
            }
            const params = new URLSearchParams(loginUrl.split('?')[1]);
            const uid = params.get('DedeUserID');
            const csrf = params.get('bili_jct');
            const sessdata = params.get('SESSDATA');

            if (uid && csrf && sessdata) {
              toast.info(`登录信息提取成功，保存中... UID: ${uid}`);
              console.log(`Saving login info: UID=${uid}, CSRF present, SESSDATA present`);
              saveLoginInfo({
                uid: uid,
                csrf: csrf,
                cookie: `SESSDATA=${sessdata}`,
              });
              this.connect();
              if (this.loginWindow) {
                console.log("Closing login window after successful login and connection attempt.");
                this.loginWindow.close().catch(closeErr => console.warn("Error closing login window post-success:", closeErr));
              }
            } else {
              toast.error('登录信息不完整，请重试');
              console.error('Incomplete login info received from login_success event:', loginUrl);
            }
            break;
          default:
            console.warn(`Received unknown 'bilibili_child_event' type: ${childEventPayload.type}`, JSON.stringify(childEventPayload));
        }
      });
      console.log("'bilibili_child_event' listener setup complete.");

      this.loginWindow.once('tauri://created', async () => {
        console.log('Bilibili login window (tauri://created) successful.');
        toast.info('登录窗口已创建');
      });

      this.loginWindow.once('tauri://error', async (e) => {
        console.error('Failed to create Bilibili login window (tauri://error):', e);
        toast.error(`无法打开B站登录窗口: ${e?.payload || JSON.stringify(e)}`);
        await this.cleanupLoginWindowResources();
        this.loginWindow = null;
      });
      
      this.loginWindow.onCloseRequested(async (event) => {
          console.log('Bilibili login window close requested by user or system. Cleaning up resources.');
          await this.cleanupLoginWindowResources();
          console.log('Login window close requested handler finished.');
      });
      
      this.startQrcodeCheck();

    } catch (error) {
      console.error("获取B站登录二维码或打开窗口失败:", error);
      toast.error(`处理B站登录失败: ${String(error)}`);
      if (this.loginWindow) {
        console.warn("Error in login function, attempting to close login window if it exists.");
        try { 
            await this.loginWindow.close(); 
        } catch (e) {
            console.warn("Error closing login window during error handling in login():", e);
        }
      }
      await this.cleanupLoginWindowResources();
      this.loginWindow = null;
    }
  }

  private startQrcodeCheck() {
    if(this.qrcodeTimer) {
      clearInterval(this.qrcodeTimer);
    }
    
    this.qrcodeTimer = setInterval(async () => {
      if(!this.state.qrcodeKey || !this.loginWindow) {
        clearInterval(this.qrcodeTimer);
        return;
      }
      
      try {
        const resp = await verifyQrCodeApi(this.state.qrcodeKey);
        this.state.qrcodeStatus = resp.code;

        this.loginWindow?.emit('bilibili-status-update', {
          type: 'status',
          code: resp.code,
          loginInfo: resp.url
        });

        if(resp.code === 0) {
          clearInterval(this.qrcodeTimer);
        }
      } catch (error) {
        console.error("检查扫码状态失败:", error);
        toast.error('检查扫码状态失败');
      }
    }, 3000);
  }

  private messageQueue: string[] = [];
  private isProcessing = false;
  private shouldProcess = false;
  private isAddingMessage = false;

  private startMessageProcessing() {
    if (this.isProcessing) return;
    
    this.shouldProcess = true;
    this.processMessages();
  }

  private stopMessageProcessing() {
    this.shouldProcess = false;
  }

  private async processMessages() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.info('Message processing started');

    while (this.shouldProcess) {
      if (this.messageQueue.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const message = this.messageQueue[0];
      const delay = parseInt(this.#state.data.chatSendDelay) || 5;

      try {
        console.info(`Sending message: ${message}, delay: ${delay}s`);
        
        await sendMessageApi({
          roomid: this.#state.data.roomId,
          msg: message
        });

        this.messageQueue.shift();
        toast.success('发送B站弹幕成功');

        await new Promise(resolve => setTimeout(resolve, delay * 1000));
      } catch (error) {
        console.error('Failed to send message:', error);
        toast.error('发送B站弹幕失败');
        
        this.messageQueue.shift();
        this.messageQueue.push(message);
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    this.isProcessing = false;
    console.info('Message processing stopped');
  }

  private async addToMessageQueue(message: string) {
    while(this.isAddingMessage) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    try {
      this.isAddingMessage = true;

      const getMessageLength = (str: string) => {
        let length = 0;
        for(let i = 0; i < str.length; i++) {
          length += str.charCodeAt(i) > 127 ? 1 : 1;
        }
        return length;
      };

      const MAX_LENGTH = 20;
      let remainingMessage = message;
      
      while(remainingMessage.length > 0) {
        if(getMessageLength(remainingMessage) > MAX_LENGTH) {
          const chunk = remainingMessage.slice(0, MAX_LENGTH);
          remainingMessage = remainingMessage.slice(MAX_LENGTH);
          this.messageQueue.push(chunk);
          console.info('Message chunk added to queue:', chunk);
          toast.info(`消息超过${MAX_LENGTH}字,已分段发送`);
        } else {
          this.messageQueue.push(remainingMessage);
          console.info('Final message chunk added to queue:', remainingMessage);
          remainingMessage = '';
        }
      }

    } finally {
      this.isAddingMessage = false;
    }
  }

  async connect() {
    try {
      console.log("Bilibili service: connect() called.");
      this.state.status = ServiceNetworkState.connecting;
      
      const valid = await validateLoginInfoApi();
      if(!valid) {
        this.logout();
        return;
      }

      const userInfo = await getUserInfoApi();
      if(!userInfo) {
        this.logout();
        return;
      }

      this.state.userInfo = userInfo;
      this.state.status = ServiceNetworkState.connected;

      this.startMessageProcessing();
    } catch (error) {
      console.error("连接B站服务失败:", error);
      toast.error('连接B站服务失败');
      this.state.status = ServiceNetworkState.disconnected;
    }
  }

  disconnect() {
    console.log("Bilibili service: disconnect() called.");
    this.stopMessageProcessing();
    this.state.status = ServiceNetworkState.disconnected;
    if(this.qrcodeTimer) {
        console.log("disconnect(): Clearing qrcodeTimer.");
        clearInterval(this.qrcodeTimer);
        this.qrcodeTimer = undefined;
    }
  }

  logout() {
    console.log("Bilibili service: logout() called.");
    this.stopMessageProcessing();
    clearInfo();
    this.state.userInfo = null;
    this.state.status = ServiceNetworkState.disconnected;
    if(this.qrcodeTimer) {
        console.log("logout(): Clearing qrcodeTimer.");
        clearInterval(this.qrcodeTimer);
        this.qrcodeTimer = undefined;
    }
  }

  async sendMessage(message: string) {
    if(!this.#state.data.roomId || !message) return;
    await this.addToMessageQueue(message);
  }

  private stopQrcodeCheck() {
    if (this.qrcodeTimer) {
      clearInterval(this.qrcodeTimer);
      this.qrcodeTimer = undefined;
      console.log('QR code polling stopped via stopQrcodeCheck().');
    }
  }
}

export default Service_Bilibili; 