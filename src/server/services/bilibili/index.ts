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
import { listen } from "@tauri-apps/api/event";
import { LOGIN_INFO } from "./schema";

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

  get #state() {
    return window.ApiServer.state.services.bilibili;
  }

  async init() {
    try {
      console.info("Bilibili service init");
      // 检查登录状态
      if(await isLogin()) {
        await this.connect();
      }

      // 订阅状态变化
      subscribeKey(this.#state.data, "chatEnable", (value) => {
        if (value) {
          if(this.state.userInfo) this.connect();
        } else this.disconnect();
      });

      // 订阅消息源
      serviceSubscibeToSource(this.#state.data, "chatPostSource", (data) => {
        if (
          this.#state.data.chatPostLive &&
          this.state.status !== ServiceNetworkState.connected
        )
          return;
        this.#state.data.chatPostEnable &&
        this.#state.data.chatEnable &&
        this.#state.data.roomId &&
        !this.#state.data.chatPostLive &&
          data?.value &&
          data?.type === TextEventType.final &&
          this.sendMessage(data.value);
      });

      // 订阅输入
      serviceSubscibeToInput(this.#state.data, "chatPostInput", (data) => {
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
        this.#state.data.chatPostEnable &&
        !this.#state.data.chatPostLive &&
        this.#state.data.chatEnable &&
        this.#state.data.roomId &&
          this.sendMessage(data.value);
      });

    } catch (error) {
      console.error("Bilibili service init failed:", error);
      this.state.status = ServiceNetworkState.disconnected;
    }
  }
  private loginWindow?: Window | null;

  async login() {
    try {
      console.info('Bilibili login started');
      toast.info('开始登录B站');
            
      // 如果已经有登录窗口，先关闭
      if(this.loginWindow) {
        this.loginWindow.close();
      }

      // 获取二维码
      const resp = await getLoginUrlApi();
      console.info('Login URL response:', resp);
      
      if(!resp?.url) {
        console.error('Failed to get login URL');
        toast.error(`获取登录URL失败, ${JSON.stringify(resp)}`);
        return;
      }
      
      this.state.qrcodeKey = resp.qrcode_key;
      this.state.qrcodeUrl = resp.url;

      // 打开登录窗口
      this.loginWindow = window.open(
        `${window.location.origin}/oauth_bilibili.html`,
        'bilibili_login',
        'width=400,height=500,menubar=no,location=no,resizable=no,scrollbars=no,status=no'
      );

      if(!this.loginWindow) {
        console.error('Failed to open login window');
        return;
      }

      // 等待窗口加载完成后发送二维码URL
      this.loginWindow.onload = () => {
        toast.info(`二维码已发送, url:${this.state.qrcodeUrl}`);
        this.loginWindow?.postMessage({
          type: 'qrcode',
          url: this.state.qrcodeUrl
        }, '*');
      }
      
      // 开始轮询
      this.startQrcodeCheck();

      // 监听消息
      const handleMessage = (event: MessageEvent) => {
        if(event.data.type === 'bilibili_refresh_qrcode') {
          this.login();
        } else if(event.data.type === 'bilibili_login_success') {
          toast.success('登录成功');
          const params = new URLSearchParams(event.data.url.split('?')[1]);
          toast.info(`登录成功，保存, uid:${params.get('DedeUserID')}`);
          saveLoginInfo({
            uid: params.get('DedeUserID') || '',
            csrf: params.get('bili_jct') || '',
            cookie: `SESSDATA=${params.get('SESSDATA')}`,
          });
          toast.info('连接B站服务');
          this.connect();
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);
      
    } catch (error) {
      console.error("获取B站登录二维码失败:", error);
      toast.error(`获取B站登录二维码失败, ${error}`);
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

        // 发送状态到登录窗口
        this.loginWindow.postMessage({
          type: 'status',
          code: resp.code,
          loginInfo: resp.url
        }, '*');

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
  private isProcessing = false;  // 是否正在处理消息
  private shouldProcess = false; // 是否应该继续处理
  private isAddingMessage = false; // 消息添加锁

  // 启动消息处理
  private startMessageProcessing() {
    if (this.isProcessing) return;
    
    this.shouldProcess = true;
    this.processMessages();
  }

  // 停止消息处理
  private stopMessageProcessing() {
    this.shouldProcess = false;
  }

  // 处理消息队列
  private async processMessages() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.info('Message processing started');

    while (this.shouldProcess) {
      // 如果队列为空，等待一秒后继续检查
      if (this.messageQueue.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // 获取消息
      const message = this.messageQueue[0];
      const delay = parseInt(this.#state.data.chatSendDelay) || 5;

      try {
        console.info(`Sending message: ${message}, delay: ${delay}s`);
        
        // 发送消息
        await sendMessageApi({
          roomid: this.#state.data.roomId,
          msg: message
        });

        // 发送成功，移除消息
        this.messageQueue.shift();
        toast.success('发送B站弹幕成功');

        // 等待指定延迟
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
      } catch (error) {
        console.error('Failed to send message:', error);
        toast.error('发送B站弹幕失败');
        
        // 发送失败，移到队列末尾重试
        this.messageQueue.shift();
        this.messageQueue.push(message);
        
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    this.isProcessing = false;
    console.info('Message processing stopped');
  }

  // 添加消息到队列
  private async addToMessageQueue(message: string) {
    // 如果正在添加消息，等待
    while(this.isAddingMessage) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    try {
      this.isAddingMessage = true; // 获取锁

      // 截断消息(中英文混合长度计算)
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
      this.isAddingMessage = false; // 释放锁
    }
  }

  // 修改connect方法
  async connect() {
    try {
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

      // 启动消息处理
      this.startMessageProcessing();
    } catch (error) {
      console.error("连接B站服务失败:", error);
      toast.error('连接B站服务失败');
      this.state.status = ServiceNetworkState.disconnected;
    }
  }

  // 修改disconnect方法
  disconnect() {
    this.stopMessageProcessing();
    this.state.status = ServiceNetworkState.disconnected;
    if(this.qrcodeTimer) {
      clearInterval(this.qrcodeTimer);
    }
  }

  // 修改logout方法
  logout() {
    this.stopMessageProcessing();
    clearInfo();
    this.state.userInfo = null;
    this.state.status = ServiceNetworkState.disconnected;
    if(this.qrcodeTimer) {
      clearInterval(this.qrcodeTimer);
    }
  }

  // sendMessage方法保持不变
  async sendMessage(message: string) {
    if(!this.#state.data.roomId || !message) return;
    await this.addToMessageQueue(message);
  }
}

export default Service_Bilibili; 