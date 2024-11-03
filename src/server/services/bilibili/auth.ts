import { toast } from "react-toastify";
import { LOGIN_INFO } from "./schema";

// 验证登录信息是否存在
const isLogin = () => {
  const state = window.ApiServer.state.services.bilibili.data;
  return !!(state[LOGIN_INFO.uid] && 
           state[LOGIN_INFO.cookie] && 
           state[LOGIN_INFO.csrf]);
}

// 清除登陆信息
const clearInfo = () => {
  const state = window.ApiServer.state.services.bilibili.data;
  Object.values(LOGIN_INFO).forEach((key) => {
    state[key] = "";
  });
};

// 保存登录信息
const saveLoginInfo = (info: {[K in keyof typeof LOGIN_INFO]?: string}) => {
  const state = window.ApiServer.state.services.bilibili.data as any;
  Object.entries(info).forEach(([key, value]) => {
    if(value) state[key as keyof typeof LOGIN_INFO] = value;
    toast.info(`保存登录信息, ${key}:${value}`);
  });
}

export { isLogin, clearInfo, saveLoginInfo };
