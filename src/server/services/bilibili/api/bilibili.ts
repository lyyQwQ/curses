import { Body } from "@tauri-apps/api/http";
import { getQueryData } from ".";
import { LOGIN_URL_PREFIX, BASE_URL_PREFIX } from "../constants";
import { LOGIN_INFO } from "../schema";

// 获取登录url
const getLoginUrlApi = async () =>
  await getQueryData(`${LOGIN_URL_PREFIX}/qrcode/generate`, {
    returnError: true
  });

// 验证二维码是否被扫描
const verifyQrCodeApi = async (qrcode_key: string) =>
  await getQueryData(`${LOGIN_URL_PREFIX}/qrcode/poll`, {
    query: { qrcode_key },
    returnError: true
  });

// 验证登录信息是否有效
const validateLoginInfoApi = async () => {
  const state = window.ApiServer.state.services.bilibili.data;
  return await getQueryData(
    "https://api.vc.bilibili.com/link_setting/v1/link_setting/get",
    {
      method: "POST",
      body: Body.form({
        msg_notify: "1",
        show_unfollowed_msg: "1",
        build: "0",
        mobi_app: "web",
        csrf_token: state[LOGIN_INFO.csrf],
        csrf: state[LOGIN_INFO.csrf]
      }),
      headers: {
        cookie: state[LOGIN_INFO.cookie]
      },
      returnError: true
    }
  );
}

// 获取用户信息
const getUserInfoApi = async () => {
  const state = window.ApiServer.state.services.bilibili.data;
  return await getQueryData(`${BASE_URL_PREFIX}/x/web-interface/nav`, {
    headers: {
      cookie: state[LOGIN_INFO.cookie]
    },
  });
}

export {
  getLoginUrlApi,
  verifyQrCodeApi,
  validateLoginInfoApi,
  getUserInfoApi
};
