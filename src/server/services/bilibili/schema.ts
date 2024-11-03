import { TextEventSource, zodTextEventSource } from "@/types";
import { zSafe } from "@/utils";
import { z } from "zod";

// 登录信息相关的schema
export const LOGIN_INFO = {
  uid: "uid",
  cookie: "cookie", 
  csrf: "csrf",
  avatar: "avatar",
  uname: "username"
} as const;

// Bilibili服务的配置schema
export const Service_Bilibili_Schema = z.object({
  // 登录信息
  [LOGIN_INFO.uid]: zSafe(z.string(), ""),
  [LOGIN_INFO.cookie]: zSafe(z.string(), ""),
  [LOGIN_INFO.csrf]: zSafe(z.string(), ""),
  [LOGIN_INFO.avatar]: zSafe(z.string(), ""),
  [LOGIN_INFO.uname]: zSafe(z.string(), ""),
  
  // 聊天功能配置
  chatPostSource: zSafe(zodTextEventSource, TextEventSource.stt),
  chatEnable: zSafe(z.boolean(), false),
  chatPostEnable: zSafe(z.boolean(), false),
  chatPostLive: zSafe(z.boolean(), false),
  chatPostInput: zSafe(z.boolean(), false),
  chatReceiveEnable: zSafe(z.boolean(), false),
  chatSendDelay: zSafe(z.string(), "0"),
  
  // 直播间配置
  roomId: zSafe(z.string(), ""),
  roomTitle: zSafe(z.string(), ""),
  
  // GPT配置
  gptToken: zSafe(z.string(), ""),
  gptEnable: zSafe(z.boolean(), false),
  gptAutoReply: zSafe(z.boolean(), false),
  
  // 自动回复配置
  autoReplyEnable: zSafe(z.boolean(), false),
  autoReplyRules: zSafe(z.record(z.string(), z.string()), {}),
  
  // 显示设置
  showActionButton: zSafe(z.boolean(), true),
  autoStart: zSafe(z.boolean(), false),
}).default({});

export type Bilibili_State = z.infer<typeof Service_Bilibili_Schema>; 