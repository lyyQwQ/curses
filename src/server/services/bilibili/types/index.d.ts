import { FetchOptions } from "@tauri-apps/api/http";

export type SetInterval = ReturnType<typeof setInterval>;

export type Rewrite<T, U> = Omit<T, keyof U> & U;

export interface SendMessage {
  roomid: string;
  msg: string;
  dm_type?: string;
  isInitiative?: boolean;
}

export type Stream = {
  type: string;
  url: string;
  ext: string;
};

export interface BilibiliResponse<T = any> {
  code: number;
  message?: string;
  msg?: string;
  data: T;
}

export interface BilibiliUserInfo {
  uid: number;
  uname: string;
  face: string;  // 头像URL
  isLogin: boolean;
  money: number;
  vipType: number;
  vipStatus: number;
  // ... 其他可能的用户信息字段
}

export interface QRCodeResponse {
  url: string;
  qrcode_key: string;
}

export interface RoomInfo {
  room_id: number;
  uid: number;
  title: string;
  cover: string;
  live_status: number;
  online: number;
  // ... 其他直播间信息字段
}

export interface GiftInfo {
  id: number;
  name: string;
  price: number;
  gif: string;
  // ... 其他礼物信息字段
}

export interface EmojiInfo {
  emoji: string;
  url: string;
  // ... 其他表情信息字段
}
